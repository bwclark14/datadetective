import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUESTS } from '../js/quests/index.js';
import { startQuest, markAnswer, parseCaseCode, caseCode } from '../js/quest-engine.js';
import { parseSQL, toSQL } from '../js/query-model.js';
import { makeRunner } from './helpers.js';
import { featuresFor, featuresUsed, LEVELS } from '../js/levels.js';

const SEEDS = Array.from({ length: 200 }, (_, i) => 1000 + i * 37);

// Re-run an ordered answer with a different tie-break; if the order changes, the question is unfair.
function tieBreakVariant(sql, table, dir) {
  const tb = `rowid ${dir}`;
  if (/\bLIMIT\b/i.test(sql)) return sql.replace(/\s+LIMIT\s+/i, `, ${tb} LIMIT `);
  return `${sql}, ${tb}`;
}

test('there are at least 8 quests, two with 10 questions', () => {
  assert.ok(QUESTS.length >= 8);
  assert.equal(QUESTS.filter(q => q.questions.length === 10).length, 2);
  assert.ok(QUESTS.some(q => /environment/i.test(q.kind)));
});

for (const quest of QUESTS) {
  test(`${quest.title}: every question works for 200 seeds`, () => {
    const prompts = new Set();
    for (const seed of SEEDS) {
      const db = makeRunner();
      const run = startQuest(quest, seed, db);
      assert.equal(run.tables.length, 1, 'single table quests for now');
      for (const q of run.questions) {
        assert.ok(q.answerResult.rows.length > 0, `${q.id} seed ${seed}`);
        assert.equal(q.hints.length, 3, `${q.id} has 3 hints`);
        // The model answer must mark itself correct.
        assert.ok(markAnswer(q, q.answer, db).correct, `${q.id} seed ${seed} self-check`);
        // Ordered questions must not depend on how ties happen to fall.
        if (q.orderMatters && /ORDER BY/i.test(q.answer) && !/GROUP BY/i.test(q.answer)) {
          const table = run.tables[0].name;
          for (const dir of ['ASC', 'DESC']) {
            const alt = db.run(tieBreakVariant(q.answer, table, dir));
            assert.ok(!alt.error, alt.error);
            assert.deepEqual(alt.rows, q.answerResult.rows, `${q.id} seed ${seed} has ties in its sort order`);
          }
        }
        // Every model answer can be shown as blocks (so Blocks mode can always reach it).
        const parsed = parseSQL(q.answer);
        assert.ok(parsed.ok, `${q.id}: ${parsed.reason}`);
        assert.ok(markAnswer(q, toSQL(parsed.query), db).correct, `${q.id} via blocks`);
        prompts.add(q.prompt);
      }
    }
    assert.ok(prompts.size > quest.questions.length, 'questions vary between seeds');
  });
}

test('detective quests always have exactly one culprit', () => {
  for (const id of ['missing-trophy', 'phantom-login']) {
    const quest = QUESTS.find(q => q.id === id);
    const culprits = new Set();
    for (const seed of SEEDS) {
      const run = startQuest(quest, seed, makeRunner());
      const last = run.questions[run.questions.length - 1];
      assert.equal(last.answerResult.rows.length, 1);
      assert.equal(last.answerResult.rows[0][0], run.ctx.culprit);
      culprits.add(run.ctx.culprit);
    }
    assert.ok(culprits.size > 20, `${id}: culprit changes between seeds`);
  }
});

test('quests are progressive: each uses only its level, and introduces its new feature', () => {
  const levels = QUESTS.map(q => q.level);
  assert.deepEqual(levels, [1, 1, 2, 3, 4, 5, 6, 6], 'quests in level order');
  for (const quest of QUESTS) {
    const allowed = featuresFor(quest.level);
    const usedAcrossQuest = new Set();
    for (const seed of SEEDS.slice(0, 40)) {
      const run = startQuest(quest, seed, makeRunner());
      for (const q of run.questions) {
        const parsed = parseSQL(q.answer);
        for (const f of featuresUsed(parsed.query)) {
          assert.ok(allowed.has(f), `${quest.id} (level ${quest.level}) question ${q.id} uses ${f}`);
          usedAcrossQuest.add(f);
        }
        for (const h of q.hints) {
          const hintBad = { orderBy: /ORDER BY/, limit: /LIMIT/, distinct: /DISTINCT/, functions: /\b(COUNT|MIN|MAX|AVG|SUM)\(/, groupBy: /GROUP BY/ };
          for (const [f, re] of Object.entries(hintBad)) {
            if (!allowed.has(f)) assert.ok(!re.test(h), `${quest.id} ${q.id} hint mentions ${f}`);
          }
        }
      }
    }
    const adds = LEVELS.find(l => l.level === quest.level).adds;
    if (adds && QUESTS.find(q => q.level === quest.level) === quest) {
      assert.ok(usedAcrossQuest.has(adds), `${quest.id} should introduce ${adds}`);
    }
  }
});

test('same seed gives the same quest', () => {
  for (const quest of QUESTS) {
    const a = startQuest(quest, 4242, makeRunner()), b = startQuest(quest, 4242, makeRunner());
    assert.deepEqual(a.questions.map(q => q.prompt), b.questions.map(q => q.prompt));
    assert.deepEqual(a.tables, b.tables);
  }
});

test('case codes round-trip', () => {
  const quest = QUESTS[1];
  const parsed = parseCaseCode(caseCode(quest, 4821), QUESTS);
  assert.equal(parsed.quest, quest);
  assert.equal(parsed.seed, 4821);
  assert.equal(parseCaseCode('river - 12', QUESTS).seed, 12);
  assert.equal(parseCaseCode('nonsense', QUESTS), null);
});

test('marking rejects data changes', () => {
  const run = startQuest(QUESTS[3], 1, makeRunner());
  const r = markAnswer(run.questions[0], 'DELETE FROM games', makeRunner());
  assert.equal(r.correct, false);
  assert.match(r.message, /SELECT/);
});

// Builds a playable quest from a quest file and a seed, and marks answers.
// `db` is anything with load(tableDefs) and run(sql) -> { columns, rows } | { error }.

import { makeRng } from './rng.js';
import { compareResults } from './marking.js';
import { checkReadOnly } from './query-model.js';

const MAX_TRIES = 40;

function usable(res) {
  if (!res || res.error || !res.rows.length) return false;
  return res.rows.some(r => r.some(x => x !== null));
}

export function startQuest(quest, seed, db) {
  const rng = makeRng(seed);
  const { tables, ctx } = quest.generate(rng.fork('data'));
  db.load(tables);
  const questions = quest.questions.map((def, i) => {
    let lastError = 'no rows';
    for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
      const q = def.build(rng.fork(`${def.id}:${attempt}`), ctx);
      const res = db.run(q.answer);
      if (usable(res) && (!q.check || q.check(res))) {
        return { ...q, id: def.id, number: i + 1, orderMatters: !!q.orderMatters, answerResult: res };
      }
      lastError = res.error || 'answer did not pass its checks';
    }
    throw new Error(`${quest.id}: could not build question "${def.id}" (${lastError})`);
  });
  return { quest, seed, code: caseCode(quest, seed), tables, ctx, questions };
}

export function caseCode(quest, seed) { return `${quest.code}-${seed}`; }

export function parseCaseCode(text, quests) {
  const m = /^\s*([A-Za-z]+)\s*-\s*(\d{1,9})\s*$/.exec(text || '');
  if (!m) return null;
  const quest = quests.find(q => q.code === m[1].toUpperCase());
  return quest ? { quest, seed: Number(m[2]) } : null;
}

export function markAnswer(question, pupilSQL, db) {
  const safe = checkReadOnly(pupilSQL);
  if (!safe.ok) return { correct: false, kind: 'error', message: safe.reason, result: null };
  const result = db.run(pupilSQL);
  const verdict = compareResults(result, question.answerResult, { orderMatters: question.orderMatters, pupilSQL });
  return { ...verdict, result };
}

export function starsFor(hintsUsed) { return hintsUsed === 0 ? 3 : hintsUsed === 1 ? 2 : 1; }

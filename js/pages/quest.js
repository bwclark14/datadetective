import { findQuest, QUESTS } from '../quests/index.js';
import { startQuest, markAnswer, starsFor } from '../quest-engine.js';
import { randomSeed } from '../rng.js';
import { createDb } from '../db.js';
import { createEditor, MODES } from '../editor/editor.js';
import { recordFinish, getPref, setPref } from '../progress.js';
import { el, topbar, renderResult, params, fatal } from '../ui.js';
import { checkReadOnly } from '../query-model.js';
import { friendlyError } from '../marking.js';

const main = document.querySelector('main');
document.body.prepend(topbar('home'));

function modeSettings() {
  const raw = params().get('mode');
  const ids = MODES.map(m => m.id);
  const locked = raw ? raw.split(',').map(s => s.trim().toLowerCase()).filter(m => ids.includes(m)) : [];
  if (locked.length) return { modes: locked, mode: locked[0], locked: true };
  const pref = getPref('mode', 'blocks');
  return { modes: ids, mode: ids.includes(pref) ? pref : 'blocks', locked: false };
}

function starsText(n, max = 3) {
  return el('span', { class: 'stars', 'aria-label': `${n} of ${max} stars` }, '★'.repeat(n), el('span', { class: 'off' }, '★'.repeat(max - n)));
}

async function start() {
  const p = params();
  const quest = findQuest(p.get('q')) || QUESTS[0];
  let seed = Number(p.get('seed'));
  if (!Number.isInteger(seed) || seed <= 0) {
    seed = randomSeed();
    p.set('q', quest.id); p.set('seed', String(seed));
    history.replaceState(null, '', `?${p}`);
  }
  document.title = `${quest.title} — Data Detective`;
  main.replaceChildren(el('p', { class: 'muted' }, 'Opening the case file…'));

  let db, run;
  try {
    db = await createDb();
    run = startQuest(quest, seed, db);
  } catch (e) {
    fatal(main, e.message);
    return;
  }

  const table = run.tables[0];
  const progress = run.questions.map(() => ({ hints: 0, stars: 0, solved: false }));
  let current = 0;

  // ---- left column ----
  const steps = el('ol', { class: 'steps', 'aria-label': 'Questions' });
  const questionPanel = el('section', { class: 'panel question', 'aria-live': 'polite' });
  const briefing = el('details', { class: 'panel briefing', open: true },
    el('summary', {}, 'Case briefing'), el('div', { html: quest.intro(run.ctx) }));
  const peekBody = el('div');
  const peek = el('details', { class: 'panel peek' },
    el('summary', {}, `Look at the ${table.name} table`), peekBody);
  peek.addEventListener('toggle', () => {
    if (!peek.open || peekBody.childElementCount) return;
    peekBody.append(el('p', { class: 'columns-list' },
      table.columns.map(c => `${c.name} (${c.type})`).join(', ')));
    const sample = el('div');
    renderResult(sample, db.run(`SELECT * FROM ${table.name} LIMIT 8`), { caption: 'First 8 records' });
    peekBody.append(sample, el('p', { class: 'muted' }, `The table has ${table.rows.length} records in total.`));
  });

  const side = el('div', { class: 'case-side' },
    el('div', { class: 'case-head' },
      el('h1', {}, quest.title),
      el('span', { class: 'case-code', title: 'Case code — enter it on the home page to reopen this exact case' }, run.code)),
    steps, questionPanel, briefing, peek);

  // ---- right column ----
  const editorHost = el('div', { class: 'panel' });
  const resultBox = el('div');
  const resultPanel = el('section', { class: 'panel result-panel', 'aria-live': 'polite' }, el('h2', {}, 'Results'), resultBox);
  const settings = modeSettings();
  const editor = createEditor(editorHost, {
    tables: [{ name: table.name, columns: table.columns }],
    modes: settings.modes,
    mode: settings.mode,
    onRun: () => runQuery(),
    onModeChange: m => { if (!settings.locked) setPref('mode', m); },
  });
  const feedback = el('div', { class: 'feedback' });
  editor.actions.append(
    el('button', { class: 'btn btn-primary', type: 'button', onclick: () => check() }, 'Check answer'),
    el('button', { class: 'btn', type: 'button', onclick: () => runQuery() }, 'Run query'),
    el('button', { class: 'btn btn-quiet', type: 'button', onclick: () => { editor.clear(); renderResult(resultBox, null); } }, 'Clear'),
  );
  resultBox.append(el('p', { class: 'muted' }, 'Run your query to see what it finds.'));

  main.replaceChildren(el('div', { class: 'workspace' }, side, el('div', { style: 'display:grid;gap:16px' }, editorHost, resultPanel)));

  function renderSteps() {
    steps.replaceChildren(...run.questions.map((q, i) => el('li', {
      class: progress[i].solved ? 'done' : i === current ? 'current' : '',
      'aria-current': i === current ? 'step' : null,
      'aria-label': `Question ${i + 1}${progress[i].solved ? ', solved' : ''}`,
    }, String(i + 1))));
  }

  function renderQuestion() {
    const q = run.questions[current];
    const pr = progress[current];
    const hintList = el('ol', {}, q.hints.slice(0, pr.hints).map(h => el('li', { html: h })));
    const hintBtn = el('button', {
      class: 'btn btn-small', type: 'button', disabled: pr.hints >= q.hints.length || pr.solved ? true : null,
      onclick: () => { pr.hints++; renderQuestion(); },
    }, pr.hints >= q.hints.length ? 'No more hints' : `Show a hint (${q.hints.length - pr.hints} left)`);
    const nextBtn = pr.solved
      ? el('button', { class: 'btn btn-primary', type: 'button', onclick: next }, current < run.questions.length - 1 ? 'Next question' : 'Close the case')
      : null;
    questionPanel.replaceChildren(...[
      el('h2', {}, `Question ${current + 1} of ${run.questions.length}`),
      el('p', { class: 'prompt', html: q.prompt }),
      pr.solved ? el('p', {}, starsText(pr.stars), ` Solved${pr.hints ? ` with ${pr.hints} hint${pr.hints === 1 ? '' : 's'}` : ' without hints'}.`) : null,
      feedback,
      el('div', { class: 'hints' }, hintBtn, pr.hints ? hintList : null),
      nextBtn ? el('p', { style: 'margin-top:12px' }, nextBtn) : null,
    ].filter(Boolean));
    renderSteps();
  }

  function runQuery() {
    const { sql, error } = editor.getSQL();
    if (error) { renderResult(resultBox, { error }); return null; }
    const safe = checkReadOnly(sql);
    if (!safe.ok) { renderResult(resultBox, { error: safe.reason }); return null; }
    const res = db.run(sql);
    renderResult(resultBox, res.error ? { error: friendlyError(res.error) } : res);
    return sql;
  }

  function check() {
    const q = run.questions[current];
    const pr = progress[current];
    const { sql, error } = editor.getSQL();
    if (error) { feedback.replaceChildren(el('div', { class: 'notice warn' }, error)); return; }
    const verdict = markAnswer(q, sql, db);
    renderResult(resultBox, verdict.result && !verdict.result.error ? verdict.result : { error: verdict.message });
    if (verdict.correct) {
      if (!pr.solved) { pr.solved = true; pr.stars = starsFor(pr.hints); }
      feedback.replaceChildren(el('div', { class: 'notice good', role: 'status' }, 'Correct! Your query finds exactly the right records.'));
    } else {
      feedback.replaceChildren(el('div', { class: verdict.kind === 'error' ? 'notice bad' : 'notice warn', role: 'status' }, verdict.message));
    }
    renderQuestion();
  }

  function next() {
    feedback.replaceChildren();
    if (current < run.questions.length - 1) {
      current++;
      briefing.open = false;
      renderQuestion();
      questionPanel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return;
    }
    finish();
  }

  function finish() {
    const total = progress.reduce((s, p) => s + p.stars, 0);
    const max = run.questions.length * 3;
    recordFinish(quest.id, total, max);
    const newSeed = randomSeed();
    questionPanel.replaceChildren(
      el('h2', {}, 'Case closed'),
      el('p', { class: 'finish' }, el('span', { class: 'stars' }, `★ ${total}`), ` out of ${max} stars`),
      el('div', { html: quest.outro(run.ctx) }),
      el('p', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-top:12px' },
        el('a', { class: 'btn btn-primary', href: `quest.html?q=${quest.id}&seed=${newSeed}${params().get('mode') ? `&mode=${params().get('mode')}` : ''}` }, 'Play a new case'),
        el('a', { class: 'btn', href: 'index.html' }, 'Choose another quest')),
    );
    current = run.questions.length;
    renderSteps();
  }

  renderQuestion();
}

start();

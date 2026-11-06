import { QUESTS } from '../quests/index.js';
import { parseCaseCode } from '../quest-engine.js';
import { getProgress } from '../progress.js';
import { el, topbar } from '../ui.js';
import { chipElement } from '../editor/chips.js';
import { tilesFromSQL, markTables } from '../query-model.js';

function starsLine(best, max) {
  if (!max) return el('span', { class: 'muted' }, 'Not played yet');
  return el('span', { class: 'stars', 'aria-label': `Best: ${best} of ${max} stars` },
    `★ ${best}`, el('span', { class: 'muted' }, ` / ${max}`));
}

function questCard(q) {
  const p = getProgress(q.id);
  const max = q.questions.length * 3;
  return el('li', { class: 'quest', 'data-colour': q.colour },
    el('span', { class: 'kind' }, q.kind),
    el('h3', {}, q.title),
    el('p', {}, q.blurb),
    el('div', { class: 'quest-foot' },
      el('div', {},
        el('div', { class: 'skills' }, `${q.questions.length} questions: ${q.skills.join(', ')}`),
        starsLine(p.best, p.completed ? max : 0)),
      el('a', { class: 'btn btn-primary', href: `quest.html?q=${q.id}` }, p.completed ? 'Play a new case' : 'Start')));
}

function render() {
  document.body.prepend(topbar('home'));
  const main = document.querySelector('main');

  const strip = el('div', { class: 'tape-strip', 'aria-hidden': 'true' },
    markTables(tilesFromSQL("SELECT name FROM visitors WHERE shoe_size = 7"), ['visitors']).map(c => {
      const node = chipElement(c);
      node.removeAttribute('tabindex'); node.removeAttribute('role'); node.removeAttribute('data-drag');
      return node;
    }));

  const codeInput = el('input', { type: 'text', placeholder: 'RIVER-4821', 'aria-label': 'Case code', autocomplete: 'off' });
  const codeMsg = el('span', { class: 'muted', 'aria-live': 'polite' });
  const replay = el('form', {
    class: 'replay',
    onsubmit: e => {
      e.preventDefault();
      const found = parseCaseCode(codeInput.value, QUESTS);
      if (!found) { codeMsg.textContent = 'That code isn\'t recognised. Codes look like RIVER-4821.'; return; }
      location.href = `quest.html?q=${found.quest.id}&seed=${found.seed}`;
    },
  }, el('label', { for: 'case-code' }, 'Have a case code?'), Object.assign(codeInput, { id: 'case-code' }),
  el('button', { class: 'btn', type: 'submit' }, 'Open case'), codeMsg);

  main.append(
    el('section', { class: 'hero' },
      strip,
      el('h1', {}, 'Solve cases by asking the data the right questions.'),
      el('p', { class: 'lede' }, 'Build real SQL queries by dragging pieces into place, then switch to typing when you\'re ready. Every case is different, so no two people get the same answers.'),
      el('div', { class: 'hero-actions' },
        el('a', { class: 'btn btn-primary', href: `quest.html?q=${QUESTS[0].id}` }, `Start with ${QUESTS[0].title}`),
        replay)),
    el('div', { class: 'section-head' }, el('h2', {}, 'Quests'), el('p', {}, 'Each one uses a single table.')),
    el('ul', { class: 'quest-list' }, QUESTS.map(questCard)),
    el('section', { class: 'panel mydata-callout' },
      el('div', {},
        el('h2', {}, 'Query your own data'),
        el('p', {}, 'Load a CSV file — a class survey, sports results, anything with rows and columns — or fetch live Scottish weather and electricity data, and explore it with the same editor.')),
      el('a', { class: 'btn btn-primary', href: 'mydata.html' }, 'Open My data')),
    el('section', { class: 'panel teacher' },
      el('h2', {}, 'For teachers'),
      el('dl', {},
        el('dt', {}, 'Level'), el('dd', {}, 'Fourth Level Computing Science: SELECT, FROM, WHERE, AND/OR/NOT, comparisons, LIKE, ORDER BY, LIMIT, DISTINCT, COUNT/MIN/MAX/AVG/SUM and GROUP BY.'),
        el('dt', {}, 'Editing modes'), el('dd', {}, 'Pupils can switch between Blocks, Tiles and Type. To fix the mode for a lesson, add ?mode=blocks (or tiles, type) to the page address — e.g. quest.html?q=river-watch&mode=blocks. Use ?mode=blocks,tiles to allow two.'),
        el('dt', {}, 'Case codes'), el('dd', {}, 'Each quest shows a code like RIVER-4821. Entering it here reopens exactly that case, so a pupil can show you their version.'),
        el('dt', {}, 'Marking'), el('dd', {}, 'Answers are marked by comparing results with a model answer, so any correct query passes. Hints reduce the stars available.'),
        el('dt', {}, 'Privacy'), el('dd', {}, 'Everything runs in the browser. No accounts, nothing uploaded. Stars are saved in this browser only.'))),
  );
}

render();

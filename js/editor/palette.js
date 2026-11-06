// The tray of chips pupils drag from.
import { el } from '../ui.js';
import { chipElement, paletteChips } from './chips.js';
import { isNumberText } from '../csv.js';

export function parseValueInput(raw) {
  const text = String(raw).trim();
  if (!text) return null;
  const quoted = /^(['"])(.*)\1$/s.exec(text);
  if (quoted) return { t: 'value', value: quoted[2], vtype: 'text' };
  if (/^(true|false)$/i.test(text)) return { t: 'value', value: /^true$/i.test(text), vtype: 'boolean' };
  if (isNumberText(text)) return { t: 'value', value: Number(text), vtype: 'number' };
  return { t: 'value', value: text, vtype: 'text' };
}

// `features` limits which pieces are offered (see js/levels.js); undefined means everything.
export function renderPalette({ mode, fields, tables, values, dnd, onAddValue, features, tab, onTab }) {
  const chips = paletteChips(fields, tables);
  const has = f => !features || features.has(f);
  const functions = chips.functions.filter(c => (c.t === 'distinct' ? has('distinct') : has('functions')));
  const keywordFeature = { 'ORDER BY': 'orderBy', LIMIT: 'limit', 'GROUP BY': 'groupBy' };
  const keywords = chips.keywords.filter(c => c.t !== 'kw' || !keywordFeature[c.kw] || has(keywordFeature[c.kw]));
  const group = (label, list) => el('div', { class: 'palette-group', role: 'group', 'aria-label': label },
    el('span', { class: 'label' }, label),
    list.map(chip => chipElement(chip, { dnd, payload: { chip } })));

  const input = el('input', {
    type: 'text', placeholder: 'Type a value', 'aria-label': 'Type a value to make a value chip',
    onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); add(); } },
  });
  const add = () => {
    const chip = parseValueInput(input.value);
    if (!chip) { input.focus(); return; }
    onAddValue(chip);
  };

  // Groups of pieces. On small screens only one group shows at a time, picked with tabs.
  const groups = [
    mode === 'tiles' ? ['Keywords', group('Keywords', keywords)] : null,
    ['Fields', el('div', { class: 'palette-stack' }, group('Table', chips.tables), group('Fields', chips.fields))],
    functions.length ? [has('functions') ? 'Functions' : 'Extras', group(has('functions') ? 'Functions' : 'Extras', functions)] : null,
    ['Compare', group('Compare', chips.compare)],
    ['Logic', group('Logic', chips.logic)],
    has('orderBy') ? ['Sort', group('Sort', chips.sort)] : null,
    ['Values', el('div', { class: 'palette-group', role: 'group', 'aria-label': 'Values' },
      el('span', { class: 'label' }, 'Values'),
      el('div', { class: 'value-maker' },
        input,
        el('button', { class: 'btn btn-small', type: 'button', onclick: add }, 'Make value'),
        values.map(chip => chipElement(chip, { dnd, payload: { chip } }))))],
  ].filter(Boolean);
  const active = groups.some(([name]) => name === tab) ? tab : groups[0][0];
  const panels = groups.map(([name, node]) => el('div', { class: 'palette-panel', 'data-tab': name, 'data-active': String(name === active) }, node));
  const tabs = el('div', { class: 'palette-tabs', role: 'tablist', 'aria-label': 'Kinds of piece' }, groups.map(([name]) => el('button', {
    type: 'button', role: 'tab', 'aria-selected': String(name === active),
    onclick: e => {
      onTab?.(name);
      const pal = e.currentTarget.closest('.palette');
      pal.querySelectorAll('.palette-tabs [role=tab]').forEach(b => b.setAttribute('aria-selected', String(b === e.currentTarget)));
      pal.querySelectorAll('.palette-panel').forEach(pn => pn.setAttribute('data-active', String(pn.dataset.tab === name)));
    },
  }, name)));

  return el('div', { class: 'palette', 'aria-label': 'Query pieces' },
    tabs,
    panels,
    el('p', { class: 'palette-tip' }, 'Drag a piece into place, or tap it and then tap where it should go. Numbers are made as numbers; anything else becomes text. Put quotes round a number to make it text.'),
  );
}

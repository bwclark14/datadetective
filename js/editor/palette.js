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
export function renderPalette({ mode, fields, tables, values, dnd, onAddValue, features }) {
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

  return el('div', { class: 'palette', 'aria-label': 'Query pieces' },
    mode === 'tiles' ? group('Keywords', keywords) : null,
    group('Table', chips.tables),
    group('Fields', chips.fields),
    functions.length ? group(has('functions') ? 'Functions' : 'Extras', functions) : null,
    group('Compare', chips.compare),
    group('Logic', chips.logic),
    has('orderBy') ? group('Sort', chips.sort) : null,
    el('div', { class: 'palette-group' },
      el('span', { class: 'label' }, 'Values'),
      el('div', { class: 'value-maker' },
        input,
        el('button', { class: 'btn btn-small', type: 'button', onclick: add }, 'Make value'),
        values.map(chip => chipElement(chip, { dnd, payload: { chip } })))),
    el('p', { class: 'palette-tip' }, 'Drag a piece into place, or tap it and then tap where it should go. Numbers are made as numbers; anything else becomes text. Put quotes round a number to make it text.'),
  );
}

// Builds the label-tape element for a chip.
import { chipText, AGGREGATES } from '../query-model.js';
import { el } from '../ui.js';
import { isNumericType } from '../types.js';

const KIND_NAMES = {
  field: 'field', star: 'all fields', agg: 'function', distinct: 'DISTINCT', table: 'table', op: 'comparison',
  logic: 'logic word', paren: 'bracket', value: 'value', dir: 'sort direction', kw: 'keyword', comma: 'comma', raw: 'piece',
};

export function describeChip(chip) {
  const text = chip.t === 'value' ? `${chipText(chip)} (${chip.vtype})` : chipText(chip);
  return `${text} ${KIND_NAMES[chip.t] || ''}`.trim();
}

/**
 * @param chip     the chip data
 * @param opts     { placed, fields, onRemove, onArgChange, dnd, payload }
 */
export function chipElement(chip, opts = {}) {
  const node = el('div', {
    class: 'chip', role: 'button', tabindex: '0',
    'data-kind': chip.t, 'data-drag': '',
    'aria-label': `${describeChip(chip)}${opts.placed ? ' (placed — Delete to remove)' : ''}`,
  });
  if (opts.placed) node.setAttribute('data-chip', '');

  if (chip.t === 'agg' && opts.placed) {
    const select = el('select', { 'aria-label': `What ${chip.fn} works on` });
    const choices = chip.fn === 'COUNT' ? ['*', ...opts.fields.map(f => f.name)]
      : opts.fields.filter(f => isNumericType(f.type)).map(f => f.name).concat(opts.fields.filter(f => !isNumericType(f.type)).map(f => f.name));
    if (!choices.includes(chip.arg)) choices.unshift(chip.arg);
    for (const c of choices) select.append(el('option', { value: c, selected: c === chip.arg ? true : null }, c));
    select.addEventListener('change', () => opts.onArgChange(select.value));
    node.append(`${chip.fn}(`, select, ')');
  } else if (chip.t === 'agg' && !opts.placed) {
    node.append(`${chip.fn}( )`);
  } else {
    node.append(chipText(chip));
  }

  if (opts.placed && opts.onRemove) {
    node.append(el('button', {
      class: 'chip-x', type: 'button', tabindex: '-1', 'aria-hidden': 'true',
      onclick: e => { e.stopPropagation(); opts.onRemove(); },
    }, '×'));
  }
  if (opts.dnd) opts.dnd.register(node, opts.payload);
  return node;
}

export function paletteChips(fields, tables) {
  return {
    tables: tables.map(t => ({ t: 'table', name: t.name })),
    fields: [...fields.map(f => ({ t: 'field', name: f.name })), { t: 'star' }],
    functions: [...AGGREGATES.map(fn => ({ t: 'agg', fn, arg: fn === 'COUNT' ? '*' : null })), { t: 'distinct' }],
    compare: ['=', '<>', '<', '>', '<=', '>=', 'LIKE'].map(op => ({ t: 'op', op })),
    logic: [{ t: 'logic', op: 'AND' }, { t: 'logic', op: 'OR' }, { t: 'logic', op: 'NOT' }, { t: 'paren', p: '(' }, { t: 'paren', p: ')' }],
    sort: [{ t: 'dir', dir: 'ASC' }, { t: 'dir', dir: 'DESC' }],
    keywords: ['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'LIMIT'].map(kw => ({ t: 'kw', kw })).concat([{ t: 'comma' }]),
  };
}

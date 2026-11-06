// The query editor: Blocks, Tiles and Type modes sharing one query.
import {
  emptyQuery, toSQL, parseSQL, isQueryComplete, tilesFromSQL, sqlFromTiles, markTables,
  chipText, CLAUSES, CLAUSE_LABEL,
} from '../query-model.js';
import { el, highlightSQL } from '../ui.js';
import { createDnd } from './dnd.js';
import { chipElement, describeChip } from './chips.js';
import { renderPalette } from './palette.js';
import { isNumericType } from '../types.js';

export const MODES = [
  { id: 'blocks', label: 'Blocks' },
  { id: 'tiles', label: 'Tiles' },
  { id: 'type', label: 'Type' },
];

const ACCEPTS = {
  select: ['field', 'star', 'agg', 'distinct'],
  from: ['table'],
  where: ['field', 'op', 'logic', 'paren', 'value'],
  groupBy: ['field'],
  orderBy: ['field', 'dir'],
  limit: ['value'],
};
const PLACEHOLDER = {
  select: 'Drop fields, * or functions here',
  from: 'Drop the table here',
  where: 'Optional: drop a field, a comparison and a value',
  groupBy: 'Drop the field to group by',
  orderBy: 'Drop a field, then ASC or DESC',
  limit: 'Drop a number value',
};
const OPTIONAL = ['where', 'groupBy', 'orderBy', 'limit'];
const CLAUSE_FEATURE = { groupBy: 'groupBy', orderBy: 'orderBy', limit: 'limit' };

function queryToTiles(q) {
  const tiles = [];
  const pushList = (list, commas) => list.forEach((c, i) => {
    if (commas && i > 0 && !(c.t === 'dir')) tiles.push({ t: 'comma' });
    tiles.push(c);
  });
  if (q.select.length || q.from.length) {
    tiles.push({ t: 'kw', kw: 'SELECT' });
    const distinct = q.select.filter(c => c.t === 'distinct');
    tiles.push(...distinct);
    pushList(q.select.filter(c => c.t !== 'distinct'), true);
  }
  if (q.from.length) { tiles.push({ t: 'kw', kw: 'FROM' }, ...q.from); }
  if (q.where.length) { tiles.push({ t: 'kw', kw: 'WHERE' }, ...q.where); }
  if (q.groupBy.length) { tiles.push({ t: 'kw', kw: 'GROUP BY' }); pushList(q.groupBy, true); }
  if (q.orderBy.length) { tiles.push({ t: 'kw', kw: 'ORDER BY' }); pushList(q.orderBy, true); }
  if (q.limit.length) { tiles.push({ t: 'kw', kw: 'LIMIT' }, ...q.limit); }
  return tiles;
}

/**
 * @param host  element to render into
 * @param opts  { tables: [{name, columns}], modes: ['blocks','tiles','type'], mode, onRun, onModeChange }
 */
export function createEditor(host, opts) {
  const allowed = (opts.modes && opts.modes.length ? opts.modes : MODES.map(m => m.id));
  // opts.features: a Set of extra SQL features this activity allows (js/levels.js). Undefined = all.
  const clauseAllowed = c => !opts.features || !CLAUSE_FEATURE[c] || opts.features.has(CLAUSE_FEATURE[c]);
  const state = {
    mode: allowed.includes(opts.mode) ? opts.mode : allowed[0],
    query: emptyQuery(),
    tiles: [],
    text: '',
    tables: opts.tables || [],
    values: [],
    open: new Set(['where']),
    notice: null,
  };

  const live = el('div', { class: 'visually-hidden', 'aria-live': 'polite' });
  const actions = el('div', { class: 'editor-actions' });
  const footer = el('div', { class: 'editor-footer' });
  const body = el('div', { class: 'editor-body' });
  const root = el('section', { class: 'editor', 'aria-label': 'Query editor' });
  host.replaceChildren(root);

  const announce = msg => { live.textContent = ''; setTimeout(() => { live.textContent = msg; }, 20); };
  const fields = () => state.tables.flatMap(t => t.columns);

  const dnd = createDnd(root, {
    accepts: (zone, payload) => {
      const kind = payload.chip.t;
      if (zone === 'tiles') return true;
      if (!ACCEPTS[zone]?.includes(kind)) return false;
      if (zone === 'limit') return payload.chip.vtype === 'number';
      if (zone === 'select' && kind === 'distinct') return !state.query.select.some(c => c.t === 'distinct') || payload.from?.zone === 'select';
      return true;
    },
    onDrop: drop,
    onRemove: payload => { listFor(payload.from.zone).splice(payload.from.index, 1); render(); },
    describe: p => describeChip(p.chip),
    describeZone: z => (z === 'tiles' ? 'the query line' : CLAUSE_LABEL[z]),
    announce,
  });

  function listFor(zone) { return zone === 'tiles' ? state.tiles : state.query[zone]; }

  function withDefaults(chip) {
    const c = { ...chip };
    if (c.t === 'agg' && !c.arg) {
      const num = fields().find(f => isNumericType(f.type));
      c.arg = (num || fields()[0] || { name: '*' }).name;
    }
    return c;
  }

  function drop(payload, zone, index) {
    const chip = withDefaults(payload.chip);
    if (payload.from) listFor(payload.from.zone).splice(payload.from.index, 1);
    const list = listFor(zone);
    if (zone === 'from' || zone === 'limit') list.splice(0, list.length, chip);
    else if (zone === 'select' && chip.t === 'distinct') list.unshift(chip);
    else {
      list.splice(Math.min(index, list.length), 0, chip);
      if (zone === 'select') {
        const d = list.findIndex(c => c.t === 'distinct');
        if (d > 0) list.unshift(...list.splice(d, 1));
      }
    }
    if (OPTIONAL.includes(zone)) state.open.add(zone);
    render();
  }

  // ---------- mode switching ----------

  function currentSQL() {
    if (state.mode === 'blocks') return toSQL(state.query);
    if (state.mode === 'tiles') return sqlFromTiles(state.tiles);
    return state.text;
  }

  function switchTo(mode) {
    if (mode === state.mode) return;
    state.notice = null;
    const from = state.mode;
    if (mode === 'blocks') {
      const text = from === 'tiles' ? sqlFromTiles(state.tiles) : state.text;
      const parsed = parseSQL(text);
      if (!parsed.ok) {
        state.notice = { reason: parsed.reason, target: mode };
        render();
        return;
      }
      state.query = parsed.query;
      for (const z of OPTIONAL) if (state.query[z].length) state.open.add(z);
    } else if (mode === 'tiles') {
      if (from === 'blocks') state.tiles = queryToTiles(state.query);
      else {
        try { state.tiles = markTables(tilesFromSQL(state.text), state.tables.map(t => t.name)); }
        catch (e) { state.notice = { reason: e.message, target: mode }; render(); return; }
      }
    } else {
      state.text = from === 'blocks'
        ? (isQueryComplete(state.query) || state.query.where.length ? toSQL(state.query).replace(/…/g, '') : '')
        : sqlFromTiles(state.tiles);
    }
    state.mode = mode;
    opts.onModeChange?.(mode);
    render();
    announce(`${mode} mode`);
  }

  function forceSwitch(mode) {
    state.notice = null;
    if (mode === 'blocks') state.query = emptyQuery();
    if (mode === 'tiles') state.tiles = [];
    state.mode = mode;
    opts.onModeChange?.(mode);
    render();
  }

  // ---------- rendering ----------

  function renderBlocks() {
    const q = state.query;
    const rows = CLAUSES.filter(c => q[c].length || (clauseAllowed(c) && (!OPTIONAL.includes(c) || state.open.has(c)))).map(clause => {
      const zone = el('div', {
        class: 'zone', 'data-zone': clause, 'data-placeholder': PLACEHOLDER[clause],
        tabindex: '0', role: 'group', 'aria-label': `${CLAUSE_LABEL[clause]}: ${PLACEHOLDER[clause]}`,
      });
      q[clause].forEach((chip, index) => zone.append(chipElement(chip, {
        placed: true, fields: fields(), dnd, payload: { chip, from: { zone: clause, index } },
        onRemove: () => { q[clause].splice(index, 1); render(); },
        onArgChange: arg => { q[clause][index] = { ...chip, arg }; render(); },
      })));
      const closer = OPTIONAL.includes(clause) && !q[clause].length
        ? el('button', { type: 'button', title: `Hide ${CLAUSE_LABEL[clause]}`, 'aria-label': `Hide ${CLAUSE_LABEL[clause]}`, onclick: () => { state.open.delete(clause); render(); } }, '×')
        : null;
      return el('div', { class: 'clause' }, el('div', { class: 'clause-name' }, closer, CLAUSE_LABEL[clause]), zone);
    });
    const hidden = OPTIONAL.filter(c => clauseAllowed(c) && !state.open.has(c) && !q[c].length);
    return el('div', {},
      el('div', { class: 'clauses' }, rows),
      hidden.length ? el('div', { class: 'add-clauses' }, hidden.map(c =>
        el('button', { type: 'button', onclick: () => { state.open.add(c); render(); } }, `+ ${CLAUSE_LABEL[c]}`))) : null,
      el('pre', { class: 'sql-preview', 'aria-label': 'Your query as SQL', html: highlightSQL(toSQL(q)) }));
  }

  function renderTiles() {
    const zone = el('div', {
      class: 'zone tile-line', 'data-zone': 'tiles', tabindex: '0', role: 'group',
      'data-placeholder': 'Build your query here, in order: SELECT … FROM …',
      'aria-label': 'Query line',
    });
    state.tiles.forEach((chip, index) => zone.append(chipElement(chip, {
      placed: true, fields: fields(), dnd, payload: { chip, from: { zone: 'tiles', index } },
      onRemove: () => { state.tiles.splice(index, 1); render(); },
      onArgChange: arg => { state.tiles[index] = { ...chip, arg }; render(); },
    })));
    return el('div', {}, zone,
      el('pre', { class: 'sql-preview', 'aria-label': 'Your query as SQL', html: highlightSQL(sqlFromTiles(state.tiles)) || ' ' }));
  }

  function renderType() {
    const layer = el('pre', { class: 'code-layer', 'aria-hidden': 'true' });
    const area = el('textarea', {
      spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off',
      'aria-label': 'Type your SQL query', placeholder: 'SELECT … FROM …',
    });
    area.value = state.text;
    const sync = () => { layer.innerHTML = `${highlightSQL(area.value)}\n`; layer.scrollTop = area.scrollTop; };
    area.addEventListener('input', () => { state.text = area.value; sync(); });
    area.addEventListener('scroll', sync);
    area.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); opts.onRun?.(); }
    });
    sync();
    const tableHelp = state.tables.map(t => `${t.name}: ${t.columns.map(c => c.name).join(', ')}`).join('; ');
    return el('div', {},
      el('div', { class: 'code-box' }, layer, area),
      el('p', { class: 'palette-tip' }, `Fields in ${tableHelp}.${opts.featureText ? ` This activity uses ${opts.featureText}.` : ''} Press Ctrl + Enter to run.`));
  }

  function render() {
    const focusKey = document.activeElement && root.contains(document.activeElement)
      ? document.activeElement.dataset?.zone || (document.activeElement.tagName === 'TEXTAREA' ? 'textarea' : null) : null;
    const modeSwitch = allowed.length > 1
      ? el('div', { class: 'mode-switch', role: 'group', 'aria-label': 'How to build your query' },
        MODES.filter(m => allowed.includes(m.id)).map(m => el('button', {
          type: 'button', 'aria-pressed': String(state.mode === m.id), onclick: () => switchTo(m.id),
        }, m.label)))
      : null;
    const notice = state.notice
      ? el('div', { class: 'notice warn switch-notice', role: 'alert' },
        el('span', {}, `This query can't be shown as ${state.notice.target}: ${state.notice.reason}`),
        el('button', { class: 'btn btn-small', type: 'button', onclick: () => { state.notice = null; render(); } }, `Stay in ${state.mode}`),
        el('button', { class: 'btn btn-small btn-quiet', type: 'button', onclick: () => forceSwitch(state.notice.target) }, `Start ${state.notice.target} from scratch`))
      : null;
    const head = el('div', { class: 'editor-head' }, el('h2', {}, 'Build your query'), modeSwitch);
    const palette = state.mode === 'type' ? null : renderPalette({
      mode: state.mode, fields: fields(), tables: state.tables, values: state.values, dnd, features: opts.features,
      tab: state.paletteTab, onTab: t => { state.paletteTab = t; },
      onAddValue: chip => {
        state.values = [chip, ...state.values.filter(v => chipText(v) !== chipText(chip))].slice(0, 12);
        render();
        announce(`Made ${describeChip(chip)}. Drag it into place, or tap it then tap where it goes.`);
      },
    });
    const main = state.mode === 'blocks' ? renderBlocks() : state.mode === 'tiles' ? renderTiles() : renderType();
    body.replaceChildren(main);
    root.replaceChildren(...[head, notice, body, palette, actions, footer, live].filter(Boolean));
    if (focusKey === 'textarea') root.querySelector('textarea')?.focus();
    else if (focusKey) root.querySelector(`[data-zone="${focusKey}"]`)?.focus();
    opts.onChange?.();
  }

  render();

  return {
    actions,
    footer,
    get mode() { return state.mode; },
    getSQL() {
      if (state.mode === 'blocks') {
        if (!isQueryComplete(state.query)) return { error: 'Add something to SELECT and a table to FROM first.' };
        return { sql: toSQL(state.query) };
      }
      const sql = currentSQL().trim();
      return sql ? { sql } : { error: 'Your query is empty. Start with SELECT.' };
    },
    setTables(tables) { state.tables = tables; render(); },
    clear() {
      state.query = emptyQuery(); state.tiles = []; state.text = ''; state.notice = null;
      state.open = new Set(['where']);
      render();
    },
    setMode(mode) { if (allowed.includes(mode)) switchTo(mode); },
  };
}

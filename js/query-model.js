// The query being built, in a form all three editor modes share.
//
// A "chip" is one piece of a query:
//   {t:'field', name}            {t:'star'}             {t:'distinct'}
//   {t:'agg', fn, arg}           arg is '*' or a field name
//   {t:'table', name}            {t:'op', op}           =, <>, <, >, <=, >=, LIKE
//   {t:'logic', op}              AND, OR, NOT           {t:'paren', p}  ( or )
//   {t:'value', value, vtype}    vtype 'number' | 'text' | 'boolean'
//   {t:'dir', dir}               ASC, DESC
// Tiles mode also uses {t:'kw', kw} for clause keywords and {t:'comma'}.
//
// A Blocks query is { select, from, where, groupBy, orderBy, limit }, each a list of chips.

export const CLAUSES = ['select', 'from', 'where', 'groupBy', 'orderBy', 'limit'];
export const CLAUSE_LABEL = {
  select: 'SELECT', from: 'FROM', where: 'WHERE',
  groupBy: 'GROUP BY', orderBy: 'ORDER BY', limit: 'LIMIT',
};
export const AGGREGATES = ['COUNT', 'MIN', 'MAX', 'AVG', 'SUM'];
export const OPERATORS = ['=', '<>', '<', '>', '<=', '>=', 'LIKE'];

const KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'GROUP', 'ORDER', 'BY', 'LIMIT', 'AND', 'OR', 'NOT',
  'LIKE', 'ASC', 'DESC', 'DISTINCT', 'AS', 'JOIN', 'ON', 'IN', 'IS', 'NULL',
  'BETWEEN', 'HAVING', 'UNION', 'TABLE', 'INSERT', 'UPDATE', 'DELETE', 'DROP',
  'CREATE', 'ALTER', 'VALUES', 'INTO', 'SET', 'CASE', 'WHEN', 'THEN', 'ELSE',
  'END', 'INNER', 'LEFT', 'RIGHT', 'OUTER', 'CROSS', 'OFFSET', 'WITH', 'INDEX',
  'PRIMARY', 'KEY', 'DEFAULT', 'CHECK', 'EXISTS', 'ALL', 'ANY', 'GLOB', 'ESCAPE', 'TRUE', 'FALSE',
]);

export function isSqlKeyword(word) { return KEYWORDS.has(String(word).toUpperCase()); }

export function emptyQuery() {
  return { select: [], from: [], where: [], groupBy: [], orderBy: [], limit: [] };
}

export function quoteIdent(name) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) && !isSqlKeyword(name)
    ? name
    : `"${String(name).replace(/"/g, '""')}"`;
}

export function quoteValue(chip) {
  if (chip.vtype === 'number') return String(chip.value);
  if (chip.vtype === 'boolean') return chip.value ? 'TRUE' : 'FALSE';
  return `'${String(chip.value).replace(/'/g, "''")}'`;
}

export function chipText(chip) {
  switch (chip.t) {
    case 'field': return quoteIdent(chip.name);
    case 'table': return quoteIdent(chip.name);
    case 'star': return '*';
    case 'distinct': return 'DISTINCT';
    case 'agg': return chip.arg ? `${chip.fn}(${chip.arg === '*' ? '*' : quoteIdent(chip.arg)})` : `${chip.fn}( )`;
    case 'op': return chip.op;
    case 'logic': return chip.op;
    case 'paren': return chip.p;
    case 'value': return quoteValue(chip);
    case 'dir': return chip.dir;
    case 'kw': return chip.kw;
    case 'comma': return ',';
    case 'raw': return chip.text;
    default: return '?';
  }
}

// ---------- Blocks -> SQL ----------

export function toSQL(q) {
  const lines = [];
  const distinct = q.select.some(c => c.t === 'distinct');
  const items = q.select.filter(c => c.t !== 'distinct');
  lines.push(`SELECT ${distinct ? 'DISTINCT ' : ''}${items.length ? items.map(chipText).join(', ') : '…'}`);
  lines.push(`FROM ${q.from.length ? chipText(q.from[0]) : '…'}`);
  if (q.where.length) lines.push(`WHERE ${q.where.map(chipText).join(' ')}`);
  if (q.groupBy.length) lines.push(`GROUP BY ${q.groupBy.map(chipText).join(', ')}`);
  if (q.orderBy.length) lines.push(`ORDER BY ${orderByText(q.orderBy)}`);
  if (q.limit.length) lines.push(`LIMIT ${q.limit.map(chipText).join(' ')}`);
  return lines.join('\n');
}

function orderByText(chips) {
  const parts = [];
  for (const c of chips) {
    if (c.t === 'dir' && parts.length) parts[parts.length - 1] += ` ${c.dir}`;
    else parts.push(chipText(c));
  }
  return parts.join(', ');
}

export function isQueryComplete(q) {
  return q.select.some(c => c.t !== 'distinct') && q.from.length > 0;
}

// ---------- Tokenising ----------

export function tokenize(sql) {
  const tokens = [];
  let i = 0;
  const s = String(sql);
  const prevAllowsSign = () => {
    const p = tokens[tokens.length - 1];
    return !p || ['op', 'comma', 'lparen', 'word'].includes(p.type) && !(p.type === 'word' && !isSqlKeyword(p.text));
  };
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '-' && s[i + 1] === '-') { while (i < s.length && s[i] !== '\n') i++; continue; }
    if (ch === '/' && s[i + 1] === '*') {
      const end = s.indexOf('*/', i + 2);
      i = end === -1 ? s.length : end + 2;
      continue;
    }
    if (ch === "'") {
      let j = i + 1, out = '';
      for (;;) {
        if (j >= s.length) throw new SyntaxError('A text value is missing its closing quote mark \'.');
        if (s[j] === "'") {
          if (s[j + 1] === "'") { out += "'"; j += 2; continue; }
          break;
        }
        out += s[j++];
      }
      tokens.push({ type: 'string', text: s.slice(i, j + 1), value: out });
      i = j + 1;
      continue;
    }
    if (ch === '"' || ch === '`' || ch === '[') {
      const close = ch === '[' ? ']' : ch;
      let j = i + 1, out = '';
      for (;;) {
        if (j >= s.length) throw new SyntaxError(`A name is missing its closing ${close}.`);
        if (s[j] === close) {
          if (close !== ']' && s[j + 1] === close) { out += close; j += 2; continue; }
          break;
        }
        out += s[j++];
      }
      tokens.push({ type: 'ident', text: s.slice(i, j + 1), value: out });
      i = j + 1;
      continue;
    }
    const num = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(s.slice(i));
    const negNum = ch === '-' && prevAllowsSign() && /^-(?:\d+\.?\d*|\.\d+)/.exec(s.slice(i));
    if (num || negNum) {
      const text = (num || negNum)[0];
      tokens.push({ type: 'number', text, value: Number(text) });
      i += text.length;
      continue;
    }
    const word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i));
    if (word) { tokens.push({ type: 'word', text: word[0] }); i += word[0].length; continue; }
    const two = s.slice(i, i + 2);
    if (['<=', '>=', '<>', '!=', '=='].includes(two)) { tokens.push({ type: 'op', text: two }); i += 2; continue; }
    if ('=<>'.includes(ch)) { tokens.push({ type: 'op', text: ch }); i++; continue; }
    if (ch === ',') { tokens.push({ type: 'comma', text: ',' }); i++; continue; }
    if (ch === '(') { tokens.push({ type: 'lparen', text: '(' }); i++; continue; }
    if (ch === ')') { tokens.push({ type: 'rparen', text: ')' }); i++; continue; }
    if (ch === '*') { tokens.push({ type: 'star', text: '*' }); i++; continue; }
    if (ch === ';') { tokens.push({ type: 'semi', text: ';' }); i++; continue; }
    tokens.push({ type: 'other', text: ch });
    i++;
  }
  return tokens;
}

// ---------- SQL -> Blocks ----------

class Unsupported extends Error {}

export function parseSQL(text) {
  let tokens;
  try { tokens = tokenize(text); } catch (e) { return { ok: false, reason: e.message }; }
  while (tokens.length && tokens[tokens.length - 1].type === 'semi') tokens.pop();
  if (!tokens.length) return { ok: true, query: emptyQuery() };

  let i = 0;
  const peek = () => tokens[i];
  const isWord = (t, w) => t && t.type === 'word' && t.text.toUpperCase() === w;
  const atClauseStart = () => {
    const t = peek();
    if (!t) return true;
    if (isWord(t, 'FROM') || isWord(t, 'WHERE') || isWord(t, 'LIMIT')) return true;
    return (isWord(t, 'GROUP') || isWord(t, 'ORDER')) && isWord(tokens[i + 1], 'BY');
  };
  const identName = t => {
    if (!t) return null;
    if (t.type === 'ident') return t.value;
    if (t.type === 'word' && !isSqlKeyword(t.text)) return t.text;
    return null;
  };
  const fail = msg => { throw new Unsupported(msg); };
  const q = emptyQuery();

  try {
    if (tokens.some(t => t.type === 'semi')) fail('Only one query at a time can be shown as blocks.');
    if (!isWord(peek(), 'SELECT')) fail('Block queries start with SELECT.');
    i++;
    if (isWord(peek(), 'DISTINCT')) { q.select.push({ t: 'distinct' }); i++; }

    // SELECT list
    while (peek() && !atClauseStart()) {
      const t = peek();
      if (t.type === 'star') { q.select.push({ t: 'star' }); i++; }
      else if (t.type === 'word' && AGGREGATES.includes(t.text.toUpperCase()) && tokens[i + 1]?.type === 'lparen') {
        const fn = t.text.toUpperCase();
        i += 2;
        let arg;
        if (peek()?.type === 'star') { arg = '*'; i++; }
        else if (isWord(peek(), 'DISTINCT')) fail(`${fn}(DISTINCT …) isn't available as a block.`);
        else {
          arg = identName(peek());
          if (!arg) fail(`Put a field name inside ${fn}( ).`);
          i++;
        }
        if (fn !== 'COUNT' && arg === '*') fail(`${fn}(*) doesn't work — ${fn} needs a field name.`);
        if (peek()?.type !== 'rparen') fail(`${fn}( ) is missing its closing bracket.`);
        i++;
        q.select.push({ t: 'agg', fn, arg });
      } else {
        const name = identName(t);
        if (!name) fail(`"${t.text}" can't go in the SELECT list as a block.`);
        q.select.push({ t: 'field', name });
        i++;
      }
      if (isWord(peek(), 'AS')) fail('Renaming columns with AS isn\'t available as blocks.');
      if (peek()?.type === 'comma') { i++; if (atClauseStart()) fail('There is a comma with nothing after it in SELECT.'); }
      else if (peek() && !atClauseStart()) fail(`Expected a comma or FROM after "${tokens[i - 1].text}".`);
    }

    if (!isWord(peek(), 'FROM')) {
      if (!peek()) return { ok: true, query: q };
      fail('FROM should come after the SELECT list.');
    }
    i++;
    const table = identName(peek());
    if (!table) fail('Put a table name after FROM.');
    q.from.push({ t: 'table', name: table });
    i++;
    if (peek()?.type === 'comma' || isWord(peek(), 'JOIN') || isWord(peek(), 'INNER') || isWord(peek(), 'LEFT')) {
      fail('Using more than one table isn\'t available as blocks yet.');
    }

    if (isWord(peek(), 'WHERE')) {
      i++;
      while (peek() && !atClauseStart()) {
        const t = peek();
        const up = t.type === 'word' ? t.text.toUpperCase() : '';
        if (t.type === 'string') q.where.push({ t: 'value', value: t.value, vtype: 'text' });
        else if (t.type === 'number') q.where.push({ t: 'value', value: t.value, vtype: 'number' });
        else if (up === 'TRUE' || up === 'FALSE') q.where.push({ t: 'value', value: up === 'TRUE', vtype: 'boolean' });
        else if (t.type === 'op') q.where.push({ t: 'op', op: t.text === '!=' ? '<>' : t.text === '==' ? '=' : t.text });
        else if (up === 'LIKE') q.where.push({ t: 'op', op: 'LIKE' });
        else if (['AND', 'OR', 'NOT'].includes(up)) q.where.push({ t: 'logic', op: up });
        else if (t.type === 'lparen') q.where.push({ t: 'paren', p: '(' });
        else if (t.type === 'rparen') q.where.push({ t: 'paren', p: ')' });
        else if (identName(t)) q.where.push({ t: 'field', name: identName(t) });
        else fail(`"${t.text}" isn't available as a block in WHERE.`);
        i++;
      }
    }

    if (isWord(peek(), 'GROUP')) {
      i += 2;
      while (peek() && !atClauseStart()) {
        const name = identName(peek());
        if (!name) fail(`"${peek().text}" can't go in GROUP BY as a block.`);
        q.groupBy.push({ t: 'field', name });
        i++;
        if (peek()?.type === 'comma') i++;
        else if (isWord(peek(), 'HAVING')) fail('HAVING isn\'t available as blocks yet.');
        else if (peek() && !atClauseStart()) fail(`Expected a comma after "${tokens[i - 1].text}" in GROUP BY.`);
      }
    }

    if (isWord(peek(), 'ORDER')) {
      i += 2;
      while (peek() && !atClauseStart()) {
        const t = peek();
        if (t.type === 'word' && AGGREGATES.includes(t.text.toUpperCase()) && tokens[i + 1]?.type === 'lparen') {
          fail('Sorting by a COUNT or AVG isn\'t available as a block — try Type mode.');
        }
        const name = identName(t);
        if (!name) fail(`"${t.text}" can't go in ORDER BY as a block.`);
        q.orderBy.push({ t: 'field', name });
        i++;
        if (isWord(peek(), 'ASC') || isWord(peek(), 'DESC')) { q.orderBy.push({ t: 'dir', dir: peek().text.toUpperCase() }); i++; }
        if (peek()?.type === 'comma') i++;
        else if (peek() && !atClauseStart()) fail(`Expected a comma after "${tokens[i - 1].text}" in ORDER BY.`);
      }
    }

    if (isWord(peek(), 'LIMIT')) {
      i++;
      if (peek()?.type !== 'number') fail('LIMIT needs a number.');
      q.limit.push({ t: 'value', value: peek().value, vtype: 'number' });
      i++;
    }

    if (peek()) fail(`"${peek().text}" can't be shown as a block here.`);
    return { ok: true, query: q };
  } catch (e) {
    if (e instanceof Unsupported) return { ok: false, reason: e.message };
    throw e;
  }
}

// ---------- Tiles ----------

export function tilesFromSQL(text) {
  const tokens = tokenize(text).filter(t => t.type !== 'semi');
  const tiles = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const up = t.type === 'word' ? t.text.toUpperCase() : '';
    const next = tokens[i + 1];
    if ((up === 'GROUP' || up === 'ORDER') && next?.type === 'word' && next.text.toUpperCase() === 'BY') {
      tiles.push({ t: 'kw', kw: `${up} BY` }); i++;
    } else if (['SELECT', 'FROM', 'WHERE', 'LIMIT'].includes(up)) tiles.push({ t: 'kw', kw: up });
    else if (up === 'DISTINCT') tiles.push({ t: 'distinct' });
    else if (AGGREGATES.includes(up) && next?.type === 'lparen'
      && (tokens[i + 2]?.type === 'star' || tokens[i + 2]?.type === 'word' || tokens[i + 2]?.type === 'ident')
      && tokens[i + 3]?.type === 'rparen') {
      const a = tokens[i + 2];
      tiles.push({ t: 'agg', fn: up, arg: a.type === 'star' ? '*' : (a.type === 'ident' ? a.value : a.text) });
      i += 3;
    } else if (['AND', 'OR', 'NOT'].includes(up)) tiles.push({ t: 'logic', op: up });
    else if (up === 'LIKE') tiles.push({ t: 'op', op: 'LIKE' });
    else if (up === 'ASC' || up === 'DESC') tiles.push({ t: 'dir', dir: up });
    else if (t.type === 'op') tiles.push({ t: 'op', op: t.text === '!=' ? '<>' : t.text });
    else if (t.type === 'string') tiles.push({ t: 'value', value: t.value, vtype: 'text' });
    else if (t.type === 'number') tiles.push({ t: 'value', value: t.value, vtype: 'number' });
    else if (up === 'TRUE' || up === 'FALSE') tiles.push({ t: 'value', value: up === 'TRUE', vtype: 'boolean' });
    else if (t.type === 'comma') tiles.push({ t: 'comma' });
    else if (t.type === 'star') tiles.push({ t: 'star' });
    else if (t.type === 'lparen') tiles.push({ t: 'paren', p: '(' });
    else if (t.type === 'rparen') tiles.push({ t: 'paren', p: ')' });
    else if (t.type === 'ident') tiles.push({ t: 'field', name: t.value });
    else if (t.type === 'word' && !isSqlKeyword(t.text)) tiles.push({ t: 'field', name: t.text });
    else tiles.push({ t: 'raw', text: t.text });
  }
  return tiles;
}

export function sqlFromTiles(tiles) {
  let out = '';
  for (const tile of tiles) {
    const text = chipText(tile);
    if (!out) out = text;
    else if (text === ',' || text === ')' || out.endsWith('(')) out += text;
    else out += ` ${text}`;
  }
  return out;
}

// Tables named in a FROM, used to turn "field" tiles into "table" tiles for display.
export function markTables(tiles, tableNames) {
  const names = new Set(tableNames.map(n => n.toLowerCase()));
  return tiles.map((tile, idx) => (tile.t === 'field' && names.has(tile.name.toLowerCase())
    && tiles[idx - 1]?.t === 'kw' && tiles[idx - 1].kw === 'FROM')
    ? { t: 'table', name: tile.name } : tile);
}

// ---------- Safety ----------

export function checkReadOnly(sql) {
  let tokens;
  try { tokens = tokenize(sql); } catch (e) { return { ok: false, reason: e.message }; }
  while (tokens.length && tokens[tokens.length - 1].type === 'semi') tokens.pop();
  if (!tokens.length) return { ok: false, reason: 'The query is empty. Start with SELECT.' };
  if (tokens.some(t => t.type === 'semi')) return { ok: false, reason: 'Run one query at a time (remove the extra ;).' };
  const first = tokens[0].type === 'word' ? tokens[0].text.toUpperCase() : '';
  if (first !== 'SELECT' && first !== 'WITH') {
    return { ok: false, reason: `Data Detective only reads data, so queries must start with SELECT${first ? ` (not ${first})` : ''}.` };
  }
  const banned = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 'ATTACH', 'DETACH', 'PRAGMA', 'VACUUM', 'REPLACE'];
  const bad = tokens.find(t => t.type === 'word' && banned.includes(t.text.toUpperCase()));
  if (bad) return { ok: false, reason: `${bad.text.toUpperCase()} changes data, so it isn't allowed here.` };
  return { ok: true };
}

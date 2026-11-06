// Compares a pupil's results with the model answer's results.
// Results look like { columns: [...], rows: [[...], ...] } or { error: '...' }.

function normValue(v) {
  if (v === null || v === undefined) return 'n:';
  if (typeof v === 'number' || typeof v === 'bigint') {
    const n = Number(v);
    return `#:${Math.abs(n) < 1e-9 ? 0 : Number(n.toFixed(6))}`;
  }
  return `s:${v}`;
}

// Column order and names don't matter, so each row becomes a sorted list of values.
function rowKey(row) { return row.map(normValue).sort().join('\u0001'); }

function countKeys(keys) {
  const m = new Map();
  for (const k of keys) m.set(k, (m.get(k) || 0) + 1);
  return m;
}

function sameMultiset(a, b) {
  if (a.length !== b.length) return false;
  const ma = countKeys(a);
  for (const [k, n] of countKeys(b)) if (ma.get(k) !== n) return false;
  return true;
}

export function friendlyError(message) {
  const m = String(message || '');
  let r;
  if ((r = /no such column: ([\w."]+)/i.exec(m))) return `There's no field called "${r[1]}". Check the spelling, or put text values in quotes.`;
  if ((r = /no such table: ([\w."]+)/i.exec(m))) return `There's no table called "${r[1]}". Check the table name after FROM.`;
  if ((r = /near "([^"]+)": syntax error/i.exec(m))) return `SQLite got confused near "${r[1]}". Check the order of your clauses and that each part is complete.`;
  if (/incomplete input/i.test(m)) return 'The query stops too early — something is missing at the end.';
  if (/misuse of aggregate/i.test(m)) return 'COUNT, MIN, MAX, AVG and SUM can\'t go in WHERE. Use them in SELECT.';
  if (/unrecognized token/i.test(m)) return `There's a character SQLite doesn't understand: ${m.replace(/^.*unrecognized token:\s*/i, '')}`;
  if (/ambiguous column/i.test(m)) return 'A field name could belong to more than one table.';
  if (/wrong number of arguments/i.test(m)) return 'A function has the wrong number of things inside its brackets.';
  return m || 'Something went wrong running that query.';
}

/**
 * @param pupil   pupil result
 * @param answer  model answer result
 * @param opts    { orderMatters, pupilSQL }
 * @returns { correct, message, kind }
 */
export function compareResults(pupil, answer, opts = {}) {
  if (pupil.error) return { correct: false, kind: 'error', message: friendlyError(pupil.error) };
  if (answer.error) return { correct: false, kind: 'internal', message: `The model answer failed: ${answer.error}` };

  const pRows = pupil.rows, aRows = answer.rows;
  const pCols = pupil.columns.length, aCols = answer.columns.length;
  const usedStar = /select\s+(distinct\s+)?\*/i.test(opts.pupilSQL || '');

  if (pCols === aCols) {
    const pKeys = pRows.map(rowKey), aKeys = aRows.map(rowKey);
    if (sameMultiset(pKeys, aKeys)) {
      if (!opts.orderMatters || pKeys.every((k, i) => k === aKeys[i])) {
        return { correct: true, kind: 'correct', message: 'Correct!' };
      }
      return { correct: false, kind: 'order', message: 'Nearly! You have the right results, but the question asks for them in a particular order. Check your ORDER BY.' };
    }
  }

  if (pRows.length === aRows.length && pCols !== aCols) {
    if (usedStar && aCols < pCols) {
      return { correct: false, kind: 'columns', message: `The right number of records — but * shows every field. The question only wants ${aCols} field${aCols === 1 ? '' : 's'}.` };
    }
    return { correct: false, kind: 'columns', message: `The right number of records, but you have ${pCols} column${pCols === 1 ? '' : 's'} and the answer has ${aCols}. Check what you SELECT.` };
  }

  if (pRows.length > aRows.length) {
    return { correct: false, kind: 'too-many', message: `You have ${pRows.length} row${pRows.length === 1 ? '' : 's'}; the answer has ${aRows.length}. Your query lets too many records through — check your WHERE${aRows.length <= 10 ? ' or LIMIT' : ''}.` };
  }
  if (pRows.length < aRows.length) {
    return { correct: false, kind: 'too-few', message: `You have ${pRows.length} row${pRows.length === 1 ? '' : 's'}; the answer has ${aRows.length}. Your query is too strict — check your WHERE conditions and spelling of values.` };
  }
  if (pCols !== aCols) {
    return { correct: false, kind: 'columns', message: `You have ${pCols} column${pCols === 1 ? '' : 's'}; the answer has ${aCols}. Check what you SELECT.` };
  }
  return { correct: false, kind: 'values', message: 'The right number of rows and columns, but the values are different. Check your conditions and which fields you chose.' };
}

// Turns a table definition into SQL statements. Shared by the browser and the tests.
// A table definition: { name, columns: [{ name, type }], rows: [[...]] }
// type is 'text', 'integer', 'real', 'date', 'time', 'boolean', or 'number' (used by quests).
// Values must already be converted (see types.js): dates/times as text, booleans as 1/0.

import { quoteIdent } from './query-model.js';

export function literal(v, type) {
  if (v === null || v === undefined || v === '') return 'NULL';
  if (['number', 'integer', 'real', 'boolean'].includes(type)) {
    const n = Number(v);
    return Number.isFinite(n) ? String(n) : 'NULL';
  }
  return `'${String(v).replace(/'/g, "''")}'`;
}

export function tableStatements(def, batchSize = 400) {
  const sqlType = { number: 'NUMERIC', integer: 'INTEGER', real: 'REAL', boolean: 'INTEGER' };
  const cols = def.columns.map(c => `${quoteIdent(c.name)} ${sqlType[c.type] || 'TEXT'}`);
  const out = [
    `DROP TABLE IF EXISTS ${quoteIdent(def.name)}`,
    `CREATE TABLE ${quoteIdent(def.name)} (${cols.join(', ')})`,
  ];
  for (let i = 0; i < def.rows.length; i += batchSize) {
    const values = def.rows.slice(i, i + batchSize)
      .map(r => `(${def.columns.map((c, j) => literal(r[j], c.type)).join(', ')})`);
    out.push(`INSERT INTO ${quoteIdent(def.name)} VALUES ${values.join(', ')}`);
  }
  return out;
}

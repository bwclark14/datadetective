// Turns a table definition into SQL statements. Shared by the browser and the tests.
// A table definition: { name, columns: [{ name, type: 'number' | 'text' }], rows: [[...]] }

import { quoteIdent } from './query-model.js';

export function literal(v, type) {
  if (v === null || v === undefined || v === '') return 'NULL';
  if (type === 'number') {
    const n = Number(v);
    return Number.isFinite(n) ? String(n) : 'NULL';
  }
  return `'${String(v).replace(/'/g, "''")}'`;
}

export function tableStatements(def, batchSize = 400) {
  const cols = def.columns.map(c => `${quoteIdent(c.name)} ${c.type === 'number' ? 'NUMERIC' : 'TEXT'}`);
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

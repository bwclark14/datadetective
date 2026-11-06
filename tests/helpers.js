// A database runner backed by Node's built-in SQLite, with the same shape as js/db.js.
import { DatabaseSync } from 'node:sqlite';
import { tableStatements } from '../js/sql-util.js';

export function makeRunner(tables = []) {
  const db = new DatabaseSync(':memory:');
  const load = defs => { for (const def of defs) for (const s of tableStatements(def)) db.exec(s); };
  load(tables);
  const run = sql => {
    try {
      const stmt = db.prepare(sql);
      const columns = stmt.columns().map(c => c.name);
      stmt.setReturnArrays(true);
      return { columns, rows: stmt.all() };
    } catch (e) {
      return { error: e.message };
    }
  };
  return { run, load };
}

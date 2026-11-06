// SQLite in the browser via sql.js. Nothing is sent to a server.
import { tableStatements } from './sql-util.js';

export const SQLJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3';
let sqlPromise;

function loadSqlJs() {
  if (!sqlPromise) {
    if (typeof window.initSqlJs !== 'function') {
      return Promise.reject(new Error('The database engine (sql.js) did not load. Check your internet connection and refresh the page.'));
    }
    sqlPromise = window.initSqlJs({ locateFile: file => `${SQLJS_CDN}/${file}` });
  }
  return sqlPromise;
}

export async function createDb() {
  const SQL = await loadSqlJs();
  let db = new SQL.Database();
  const tables = new Map();
  return {
    load(defs) {
      for (const def of defs) {
        for (const s of tableStatements(def)) db.run(s);
        tables.set(def.name, def);
      }
    },
    drop(name) { db.run(`DROP TABLE IF EXISTS "${name.replace(/"/g, '""')}"`); tables.delete(name); },
    reset() { db.close(); db = new SQL.Database(); tables.clear(); },
    tables() { return [...tables.values()]; },
    run(sql) {
      let stmt;
      try {
        stmt = db.prepare(sql);
        const columns = stmt.getColumnNames();
        const rows = [];
        while (stmt.step()) rows.push(stmt.get());
        return { columns, rows };
      } catch (e) {
        return { error: e.message };
      } finally {
        if (stmt) stmt.free();
      }
    },
  };
}

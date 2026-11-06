import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toSQL, parseSQL, emptyQuery, tilesFromSQL, sqlFromTiles, checkReadOnly, tokenize,
} from '../js/query-model.js';
import { compareResults, friendlyError } from '../js/marking.js';
import { parseCSV, prepareCSV, buildTable, sanitizeNames, guessType, toCSV, tableNameFromFile, starterChallenges } from '../js/csv.js';
import { makeRng } from '../js/rng.js';
import { makeRunner } from './helpers.js';

const F = name => ({ t: 'field', name });
const V = (value, vtype = typeof value === 'number' ? 'number' : 'text') => ({ t: 'value', value, vtype });

test('toSQL builds every clause', () => {
  const q = emptyQuery();
  q.select = [{ t: 'distinct' }, F('platform'), { t: 'agg', fn: 'COUNT', arg: '*' }];
  q.from = [{ t: 'table', name: 'games' }];
  q.where = [F('price'), { t: 'op', op: '<' }, V(20), { t: 'logic', op: 'AND' }, F('title'), { t: 'op', op: 'LIKE' }, V("D'oh%")];
  q.groupBy = [F('platform')];
  q.orderBy = [F('platform'), { t: 'dir', dir: 'DESC' }, F('genre')];
  q.limit = [V(5)];
  assert.equal(toSQL(q),
    "SELECT DISTINCT platform, COUNT(*)\nFROM games\nWHERE price < 20 AND title LIKE 'D''oh%'\nGROUP BY platform\nORDER BY platform DESC, genre\nLIMIT 5");
});

test('toSQL quotes awkward names', () => {
  const q = emptyQuery();
  q.select = [F('order'), F('shoe size')];
  q.from = [{ t: 'table', name: 'people' }];
  assert.equal(toSQL(q), 'SELECT "order", "shoe size"\nFROM people');
});

test('parseSQL round-trips through toSQL', () => {
  const samples = [
    'SELECT * FROM games',
    "SELECT title, price FROM games WHERE platform = 'Switch' AND price < 20 ORDER BY price DESC LIMIT 5",
    'SELECT platform, COUNT(*) FROM games GROUP BY platform ORDER BY platform',
    "SELECT DISTINCT genre FROM games WHERE NOT (rating >= 8 OR title LIKE 'S%')",
    'select avg(price), max(rating) from games where price <> -5;',
  ];
  for (const s of samples) {
    const r = parseSQL(s);
    assert.ok(r.ok, `${s}: ${r.reason}`);
    const again = parseSQL(toSQL(r.query));
    assert.ok(again.ok);
    assert.deepEqual(again.query, r.query);
  }
});

test('parseSQL explains unsupported constructs', () => {
  const cases = {
    'SELECT name AS n FROM t': /AS/,
    'SELECT * FROM a JOIN b': /more than one table/,
    'SELECT * FROM a, b': /more than one table/,
    'SELECT x FROM t GROUP BY x HAVING COUNT(*) > 1': /HAVING/,
    'SELECT * FROM t WHERE x IS NULL': /IS/,
    'UPDATE t SET x = 1': /start with SELECT/,
    "SELECT * FROM t WHERE name = 'oops": /closing quote/,
    'SELECT AVG(*) FROM t': /needs a field/,
  };
  for (const [sql, re] of Object.entries(cases)) {
    const r = parseSQL(sql);
    assert.equal(r.ok, false, sql);
    assert.match(r.reason, re, sql);
  }
});

test('tiles convert to and from SQL', () => {
  const sql = "SELECT name, COUNT(*) FROM people WHERE age > 12 GROUP BY name ORDER BY name DESC";
  const tiles = tilesFromSQL(sql);
  assert.equal(tiles[0].kw, 'SELECT');
  assert.equal(tiles.find(t => t.t === 'agg').fn, 'COUNT');
  assert.equal(sqlFromTiles(tiles), sql);
  assert.equal(sqlFromTiles(tilesFromSQL("SELECT * FROM t WHERE ( a = 'x' )")), "SELECT * FROM t WHERE (a = 'x')");
});

test('tokenizer handles negatives, comments and quoted names', () => {
  const t = tokenize('SELECT "my col" FROM t -- note\nWHERE x > -3 AND y - 2 > 1');
  assert.deepEqual(t.filter(k => k.type === 'number').map(k => k.value), [-3, 2, 1]);
  assert.equal(t[1].type, 'ident');
  assert.equal(t[1].value, 'my col');
  assert.ok(t.some(k => k.type === 'other' && k.text === '-'), 'y - 2 keeps minus as an operator');
});

test('checkReadOnly blocks changes', () => {
  assert.ok(checkReadOnly('SELECT 1').ok);
  assert.ok(checkReadOnly('select * from t;').ok);
  assert.equal(checkReadOnly('DELETE FROM t').ok, false);
  assert.equal(checkReadOnly('SELECT 1; DROP TABLE t').ok, false);
  assert.equal(checkReadOnly('   ').ok, false);
});

test('marking compares results, not wording', () => {
  const db = makeRunner([{ name: 'g', columns: [{ name: 'title', type: 'text' }, { name: 'price', type: 'number' }],
    rows: [['A', 5], ['B', 15], ['C', 25], ['D', 15]] }]);
  const ans = db.run('SELECT title, price FROM g WHERE price < 20');
  const ok = (sql, order = false) => compareResults(db.run(sql), ans, { orderMatters: order, pupilSQL: sql });
  assert.ok(ok('SELECT price, title FROM g WHERE 20 > price').correct);
  assert.ok(ok('SELECT title, price FROM g WHERE price <= 15').correct);
  assert.equal(ok('SELECT * FROM g WHERE price < 30').kind, 'too-many');
  assert.equal(ok('SELECT title, price FROM g WHERE price < 10').kind, 'too-few');
  assert.equal(ok('SELECT title FROM g WHERE price < 20').kind, 'columns');
  assert.equal(ok('SELECT title, pric FROM g').kind, 'error');

  const ordered = db.run('SELECT title FROM g ORDER BY price DESC, title');
  const o = sql => compareResults(db.run(sql), ordered, { orderMatters: true, pupilSQL: sql });
  assert.ok(o('SELECT title FROM g ORDER BY price DESC, title').correct);
  assert.equal(o('SELECT title FROM g ORDER BY price, title').kind, 'order');

  const avg = db.run('SELECT AVG(price) FROM g');
  assert.ok(compareResults(db.run('SELECT SUM(price) / 4.0 FROM g'), avg).correct);
  const star = db.run('SELECT title FROM g');
  assert.match(compareResults(db.run('SELECT * FROM g'), star, { pupilSQL: 'SELECT * FROM g' }).message, /\*/);
});

test('friendly errors', () => {
  assert.match(friendlyError('no such column: Switch'), /quotes/);
  assert.match(friendlyError('near "FROM": syntax error'), /FROM/);
  assert.match(friendlyError('misuse of aggregate: COUNT()'), /WHERE/);
});

test('CSV parsing handles quotes, delimiters and BOM', () => {
  const r = parseCSV('﻿name,notes\r\n"Smith, J","said ""hi""\nthen left"\r\nLee,ok\r\n');
  assert.deepEqual(r.headers, ['name', 'notes']);
  assert.deepEqual(r.rows, [['Smith, J', 'said "hi"\nthen left'], ['Lee', 'ok']]);
  assert.equal(parseCSV('a;b\n1;2').delimiter, ';');
  assert.deepEqual(parseCSV('a;b\n1;2').rows, [['1', '2']]);
});

test('CSV types and names', () => {
  assert.equal(guessType(['1', '2.5', '', '-3']), 'number');
  assert.equal(guessType(['07700 900123', '07700 900456']), 'text');
  assert.equal(guessType(['0123', '0456']), 'text');
  assert.equal(guessType(['1', 'two', '3']), 'text');
  assert.deepEqual(sanitizeNames(['Shoe Size', 'shoe size', '2024 score', 'Order', '', 'Café']),
    ['shoe_size', 'shoe_size_2', 'col_2024_score', 'order_', 'column_5', 'cafe']);
  assert.equal(tableNameFromFile('Class Survey 2026.csv'), 'class_survey_2026');
});

test('prepareCSV reports problems kindly', () => {
  assert.equal(prepareCSV('').ok, false);
  assert.match(prepareCSV('a,b\n').error, /no data/);
  assert.match(prepareCSV('1,2\n3,4').error, /header/);
  const p = prepareCSV('name,score\nAmy,5\nBen\nCal,7,extra\nDan,abc');
  assert.ok(p.ok);
  assert.deepEqual(p.report, { padded: 1, trimmed: 1 });
  assert.deepEqual(p.types, ['text', 'text']);
  const { def, blanked } = buildTable('t', p, ['text', 'number']);
  assert.equal(blanked, 1);
  assert.deepEqual(def.rows.map(r => r[1]), [5, null, 7, null]);
  const db = makeRunner([def]);
  assert.deepEqual(db.run('SELECT AVG(score) FROM t').rows, [[6]]);
  assert.ok(starterChallenges(def).length >= 3);
});

test('toCSV escapes', () => {
  assert.equal(toCSV(['a', 'b'], [['x,y', 'he said "no"'], [null, 3]]), 'a,b\r\n"x,y","he said ""no"""\r\n,3');
});

test('rng is repeatable', () => {
  const a = makeRng(42), b = makeRng(42);
  assert.deepEqual([a.int(1, 100), a.pick(['x', 'y', 'z'])], [b.int(1, 100), b.pick(['x', 'y', 'z'])]);
  assert.notDeepEqual(makeRng(1).shuffle([1, 2, 3, 4, 5, 6]), makeRng(2).shuffle([1, 2, 3, 4, 5, 6]));
});

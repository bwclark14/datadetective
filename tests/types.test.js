import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guessType, convertValue, parseDate, parseTime, countMisfits } from '../js/types.js';
import { prepareCSV, buildTable } from '../js/csv.js';
import { parseSQL, toSQL, tilesFromSQL, sqlFromTiles } from '../js/query-model.js';
import { parseValueInput } from '../js/editor/palette.js';
import { makeRunner } from './helpers.js';

test('guesses each type', () => {
  assert.equal(guessType(['Amy', 'Ben']), 'text');
  assert.equal(guessType(['7', '12', '-3']), 'integer');
  assert.equal(guessType(['7', '12.5']), 'real');
  assert.equal(guessType(['2026-11-03', '2026-11-04']), 'date');
  assert.equal(guessType(['03/11/2026', '25/12/2025']), 'date');
  assert.equal(guessType(['09:30', '14:05', '7:15']), 'time');
  assert.equal(guessType(['Yes', 'No', 'yes']), 'boolean');
  assert.equal(guessType(['TRUE', 'FALSE']), 'boolean');
  assert.equal(guessType(['1', '0', '1']), 'integer', '0/1 alone stays a number');
  assert.equal(guessType(['07700 900123', '0131 496 0000']), 'text');
  assert.equal(guessType(['0123', '0456']), 'text', 'leading zeros stay text');
});

test('dates: UK day-first, ISO, and impossible dates', () => {
  assert.equal(parseDate('03/11/2026'), '2026-11-03');
  assert.equal(parseDate('3-11-26'), '2026-11-03');
  assert.equal(parseDate('03.11.1999'), '1999-11-03');
  assert.equal(parseDate('2026-1-5'), '2026-01-05');
  assert.equal(parseDate('2026-11-03T10:00Z'), '2026-11-03');
  assert.equal(parseDate('31/02/2026'), null);
  assert.equal(parseDate('next Tuesday'), null);
});

test('times: 24-hour, seconds and am/pm', () => {
  assert.equal(parseTime('9:05'), '09:05');
  assert.equal(parseTime('09:05:30'), '09:05:30');
  assert.equal(parseTime('2:30pm'), '14:30');
  assert.equal(parseTime('12:15 am'), '00:15');
  assert.equal(parseTime('25:00'), null);
});

test('conversion and misfits', () => {
  assert.deepEqual(convertValue('7', 'integer'), { ok: true, value: 7 });
  assert.deepEqual(convertValue('7.5', 'integer'), { ok: false, value: null });
  assert.deepEqual(convertValue('Yes', 'boolean'), { ok: true, value: 1 });
  assert.deepEqual(convertValue('', 'date'), { ok: true, value: null });
  assert.equal(countMisfits(['1', '2', 'three', ''], 'integer'), 1);
});

test('typed tables query correctly in SQLite', () => {
  const p = prepareCSV('name,born,lunch,vegetarian,height\nAmy,03/11/2012,12:30,Yes,151.5\nBen,25/12/2011,1:15pm,No,148\nCal,01/02/2013,12:45,yes,160.2');
  assert.deepEqual(p.types, ['text', 'date', 'time', 'boolean', 'real']);
  const { def, blanked } = buildTable('pupils', p);
  assert.equal(blanked, 0);
  const db = makeRunner([def]);
  assert.deepEqual(db.run("SELECT name FROM pupils WHERE born > '2012-01-01' ORDER BY born").rows, [['Amy'], ['Cal']]);
  assert.deepEqual(db.run("SELECT name FROM pupils WHERE lunch > '13:00'").rows, [['Ben']]);
  assert.deepEqual(db.run('SELECT COUNT(*) FROM pupils WHERE vegetarian = TRUE').rows, [[2]]);
  assert.deepEqual(db.run('SELECT MAX(height) FROM pupils').rows, [[160.2]]);
});

test('TRUE and FALSE work in every editor mode', () => {
  const r = parseSQL('SELECT name FROM pupils WHERE vegetarian = TRUE');
  assert.ok(r.ok, r.reason);
  assert.deepEqual(r.query.where.at(-1), { t: 'value', value: true, vtype: 'boolean' });
  assert.equal(toSQL(r.query), 'SELECT name\nFROM pupils\nWHERE vegetarian = TRUE');
  assert.equal(sqlFromTiles(tilesFromSQL('SELECT * FROM t WHERE x = false')), 'SELECT * FROM t WHERE x = FALSE');
  assert.deepEqual(parseValueInput('true'), { t: 'value', value: true, vtype: 'boolean' });
  assert.equal(parseValueInput("'true'").vtype, 'text');
});

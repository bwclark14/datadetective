import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  weatherWeekRows, weatherScotlandRows, electricityRows, fetchLive, carbonUrl, weatherWeekUrl,
  PLACES, SOURCES, localStamp,
} from '../js/live.js';
import { prepareCSV, buildTable, toCSV } from '../js/csv.js';
import { openMeteoHourly, openMeteoDaily, carbonRegional } from './fixtures.js';
import { makeRunner } from './helpers.js';

const NOW = new Date('2026-11-08T12:30:00Z'); // 12:30 in London (GMT)

test('hourly weather keeps past hours only, with tidy columns', () => {
  const t = weatherWeekRows(openMeteoHourly('2026-11-01', 8), NOW);
  assert.deepEqual(t.columns, ['date', 'time', 'hour', 'temperature_c', 'rain_mm', 'wind_mph', 'humidity_pct', 'cloud_pct']);
  assert.equal(t.rows.length, 7 * 24 + 13); // 1–7 Nov plus 00:00–12:00 on the 8th
  assert.deepEqual(t.rows[0].slice(0, 3), ['2026-11-01', '00:00', 0]);
  assert.equal(t.rows.at(-1)[1], '12:00');
});

test('hourly weather copes with a missing variable', () => {
  const json = openMeteoHourly();
  delete json.hourly.cloud_cover;
  const t = weatherWeekRows(json, NOW);
  assert.equal(t.rows[0][7], null);
});

test('service errors become readable messages', () => {
  assert.throws(() => weatherWeekRows({ error: true, reason: 'Parameter past_days is out of range' }), /past_days/);
  assert.throws(() => electricityRows([{ region: 'North Scotland', json: { error: { message: 'x' } } }]), /unexpected/);
});

test('daily weather: one row per place per past day', () => {
  const results = PLACES.slice(0, 3).map(p => ({ place: p.name, json: openMeteoDaily('2026-10-24', 16) }));
  const t = weatherScotlandRows(results, NOW);
  assert.equal(t.rows.length, 3 * 15); // 24 Oct – 7 Nov; today (8 Nov) is left out
  assert.ok(t.rows.every(r => r[1] < '2026-11-08'));
});

test('electricity rows spread the fuel mix into columns', () => {
  const t = electricityRows([
    { region: 'North Scotland', json: carbonRegional(1, 'North Scotland') },
    { region: 'South Scotland', json: carbonRegional(2, 'South Scotland') },
  ]);
  assert.equal(t.rows.length, 192);
  const wind = t.columns.indexOf('wind_pct');
  assert.equal(t.rows[0][wind], 40);
  assert.equal(t.rows[0][2], '00:00');
});

test('addresses', () => {
  assert.equal(carbonUrl(1, NOW), 'https://api.carbonintensity.org.uk/regional/intensity/2026-11-06T12:30Z/2026-11-08T12:30Z/regionid/1');
  const u = new URL(weatherWeekUrl(PLACES.find(p => p.name === 'Inverness')));
  assert.equal(u.searchParams.get('past_days'), '7');
  assert.equal(u.searchParams.get('timezone'), 'Europe/London');
});

test('UK local time follows British Summer Time', () => {
  assert.equal(localStamp(new Date('2026-07-01T12:00:00Z')), '2026-07-01T13:00');
  assert.equal(localStamp(new Date('2026-12-01T12:00:00Z')), '2026-12-01T12:00');
});

test('fetchLive end to end with a stand-in fetch, then the table queries', async () => {
  const fakeFetch = async url => ({
    ok: true,
    json: async () => (url.includes('carbonintensity') ? carbonRegional(url.endsWith('/1') ? 1 : 2, 'x')
      : url.includes('daily=') ? openMeteoDaily() : openMeteoHourly()),
  });
  for (const id of Object.keys(SOURCES)) {
    const t = await fetchLive(id, { place: 'Stirling', fetchImpl: fakeFetch, now: NOW });
    assert.ok(t.rows.length > 0, id);
    assert.ok(t.starters.length >= 4, id);
    const prepared = prepareCSV(toCSV(t.columns, t.rows));
    assert.ok(prepared.ok, id);
    const { def } = buildTable(t.name, prepared);
    const db = makeRunner([def]);
    assert.ok(!db.run(`SELECT COUNT(*) FROM ${t.name}`).error, id);
  }
  assert.equal((await fetchLive('weatherWeek', { place: 'Stirling', fetchImpl: fakeFetch, now: NOW })).name, 'weather_stirling');
});

test('network failures give a plain message', async () => {
  const failing = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(fetchLive('electricity', { fetchImpl: failing }), /could not be reached/);
  const notOk = async () => ({ ok: false, status: 503 });
  await assert.rejects(fetchLive('weatherWeek', { fetchImpl: notOk }), /503/);
});

test('saved examples match the live column layout', async () => {
  const fakeFetch = async url => ({ ok: true, json: async () => (url.includes('carbonintensity') ? carbonRegional(1, 'x') : url.includes('daily=') ? openMeteoDaily() : openMeteoHourly()) });
  for (const [id, source] of Object.entries(SOURCES)) {
    const live = await fetchLive(id, { fetchImpl: fakeFetch, now: NOW });
    const prepared = prepareCSV(await readFile(new URL(`../${source.example}`, import.meta.url), 'utf8'));
    assert.ok(prepared.ok, id);
    assert.deepEqual(prepared.names, live.columns, id);
  }
});

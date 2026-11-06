import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  weatherWeekRows, weatherScotlandRows, electricityRows, fetchLive, carbonUrl, weatherWeekUrl,
  PLACES, SOURCES, SOURCE_LIST, localStamp, auroraRows, earthquakeRows, regionOf, wildlifeRows, areaOf,
  findScotland, sightingsUrl, chooseStations, riverRows, airRows, aqiBand, stormLevel, auroraChance,
} from '../js/live.js';
import { prepareCSV, buildTable, toCSV } from '../js/csv.js';
import {
  openMeteoHourly, openMeteoDaily, carbonRegional, noaaKp, usgsQuakes, inatPlaces, inatObservations,
  sepaStations, sepaValues, openMeteoAir, fixtureFetch,
} from './fixtures.js';
import { makeRunner } from './helpers.js';

const NOW = new Date('2026-11-08T12:30:00Z');
const fakeFetch = async url => {
  const body = fixtureFetch(url);
  return body ? { ok: true, json: async () => body } : { ok: false, status: 404 };
};

test('there are 8 live sources, each with a description, credit, example and questions', () => {
  assert.equal(SOURCE_LIST.length, 8);
  for (const s of SOURCE_LIST) {
    const about = s.about('Glasgow');
    for (const k of ['summary', 'from', 'updated', 'rows']) assert.ok(about[k], `${s.id} about.${k}`);
    assert.ok(s.credit && s.example && s.starters('Glasgow').length >= 4, s.id);
  }
});

test('hourly weather keeps past hours only, with tidy columns', () => {
  const t = weatherWeekRows(openMeteoHourly('2026-11-01', 8), NOW);
  assert.equal(t.rows.length, 7 * 24 + 13);
  assert.deepEqual(t.rows[0].slice(0, 3), ['2026-11-01', '00:00', 0]);
});

test('daily weather: one row per place per past day', () => {
  const results = PLACES.slice(0, 3).map(p => ({ place: p.name, json: openMeteoDaily('2026-10-24', 16) }));
  assert.equal(weatherScotlandRows(results, NOW).rows.length, 3 * 15);
});

test('electricity rows spread the fuel mix into columns', () => {
  const t = electricityRows([{ region: 'North Scotland', json: carbonRegional(1, 'North Scotland') }]);
  assert.equal(t.rows[0][t.columns.indexOf('wind_pct')], 40);
});

test('air quality: bands and past hours', () => {
  const t = airRows(openMeteoAir('2026-11-01', 8), NOW);
  assert.equal(t.rows.length, 7 * 24 + 13);
  assert.equal(aqiBand(15), 'good');
  assert.equal(aqiBand(55), 'moderate');
  assert.equal(aqiBand(130), 'extremely poor');
  assert.equal(t.rows[0][t.columns.indexOf('grass_pollen')], null, 'out of season pollen is empty');
});

test('aurora: both NOAA layouts, times read as UTC', () => {
  for (const json of [noaaKp(false), noaaKp(true)]) {
    const t = auroraRows(json);
    assert.equal(t.rows.length, 56);
    assert.deepEqual(t.rows[0].slice(0, 2), ['2026-10-30', '00:00']);
  }
  assert.equal(stormLevel(5.33), 'G1 minor');
  assert.equal(stormLevel(3), 'no storm');
  assert.equal(auroraChance(4.33), 'possible in the far north');
  assert.throws(() => auroraRows([['when', 'what']]), /format/);
});

test('earthquakes: newest first, region from the place, tsunami as yes/no', () => {
  const t = earthquakeRows(usgsQuakes());
  assert.equal(t.rows.length, 40);
  assert.ok(t.rows[0][0] >= t.rows[39][0]);
  assert.equal(regionOf('12 km S of Town, Alaska'), 'Alaska');
  assert.equal(regionOf('south of the Fiji Islands'), 'south of the Fiji Islands');
  assert.equal(t.rows.filter(r => r.at(-1) === 'yes').length, 1);
});

test('wildlife: no usernames, rough locations, friendly names', () => {
  assert.equal(findScotland(inatPlaces()), 99999);
  assert.match(sightingsUrl(99999), /place_id=99999/);
  assert.match(sightingsUrl(null), /swlat=/);
  const t = wildlifeRows(inatObservations());
  assert.ok(!JSON.stringify(t).includes('secret_person'));
  assert.equal(t.rows[0][1], 'Grey heron');
  assert.equal(t.rows[0][3], 'Bird');
  assert.equal(t.rows[1][5], 57.1);
  assert.equal(areaOf('12 Some Road, Leith, Edinburgh, Scotland, GB'), 'Edinburgh');
  assert.equal(areaOf('Cairngorms National Park, UK'), 'Cairngorms National Park');
});

test('rivers: one gauge per known river, readings on the hour', () => {
  const stations = chooseStations(sepaStations());
  assert.deepEqual(stations.map(s => s.river), ['Tay', 'Clyde', 'Spey']);
  const t = riverRows(sepaValues(), stations);
  assert.equal(t.rows.length, 3 * 24);
  assert.deepEqual(t.rows[0].slice(0, 4), ['Tay', 'Ballathie', '2026-11-01', '00:00']);
  assert.throws(() => chooseStations([['a', 'b']]), /format/);
});

test('addresses', () => {
  assert.equal(carbonUrl(1, NOW), 'https://api.carbonintensity.org.uk/regional/intensity/2026-11-06T12:30Z/2026-11-08T12:30Z/regionid/1');
  assert.equal(new URL(weatherWeekUrl(PLACES[0])).searchParams.get('past_days'), '7');
  assert.equal(localStamp(new Date('2026-07-01T12:00:00Z')), '2026-07-01T13:00');
});

test('every source fetches, loads into SQLite, and describes every column', async () => {
  for (const s of SOURCE_LIST) {
    const t = await fetchLive(s.id, { place: 'Stirling', fetchImpl: fakeFetch, now: NOW });
    assert.ok(t.rows.length > 0, s.id);
    assert.equal(t.types.length, t.columns.length, `${s.id} types`);
    for (const c of t.columns) assert.ok(t.about.columns[c], `${s.id}: no description for column ${c}`);
    const prepared = prepareCSV(toCSV(t.columns, t.rows));
    assert.ok(prepared.ok, s.id);
    const { def, blanked } = buildTable(t.name, prepared, t.types);
    assert.equal(blanked, 0, `${s.id}: values didn't fit their types`);
    assert.ok(!makeRunner([def]).run(`SELECT COUNT(*) FROM ${t.name}`).error, s.id);
  }
});

test('network failures give a plain message', async () => {
  const failing = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(fetchLive('earthquakes', { fetchImpl: failing }), /could not be reached/);
  await assert.rejects(fetchLive('weatherWeek', { fetchImpl: async () => ({ ok: false, status: 503 }) }), /503/);
});

test('wildlife still works if the place lookup fails', async () => {
  const f = async url => (url.includes('autocomplete') ? { ok: false, status: 500 } : { ok: true, json: async () => inatObservations() });
  const t = await fetchLive('wildlife', { fetchImpl: f });
  assert.equal(t.rows.length, 30);
});

test('saved examples match the live layout and fit their types', async () => {
  for (const [id, source] of Object.entries(SOURCES)) {
    const live = await fetchLive(id, { fetchImpl: fakeFetch, now: NOW });
    const prepared = prepareCSV(await readFile(new URL(`../${source.example}`, import.meta.url), 'utf8'));
    assert.ok(prepared.ok, id);
    assert.deepEqual(prepared.names, live.columns, id);
    assert.equal(buildTable('x', prepared, source.types).blanked, 0, `${id} example fits its types`);
  }
});

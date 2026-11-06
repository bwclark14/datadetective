// Run with: node tests/browser/smoke.js [output-folder]
// Drives the real pages in headless Chrome and saves screenshots.
import { startServer, launchBrowser } from './harness.js';
import assert from 'node:assert/strict';
import { startQuest } from '../../js/quest-engine.js';
import { findQuest } from '../../js/quests/index.js';
import { makeRunner } from '../helpers.js';
import { fixtureFetch } from '../fixtures.js';

const out = process.argv[2] || '.';
const BASE = 'http://127.0.0.1:8765';
const chip = label => `.palette .chip[aria-label="${label}"]`;
const zone = name => `[data-zone="${name}"]`;
const results = [];
const check = async (name, fn) => {
  try { await fn(); results.push(`PASS ${name}`); } catch (e) {
    results.push(`FAIL ${name}: ${e.message}`);
    try { await p.screenshot(`${out}/FAIL-${name.replace(/\W+/g, '-').slice(0, 40)}.png`); } catch { /* ignore */ }
  }
};

const server = await startServer();
const liveRoutes = {
  'open-meteo.com': fixtureFetch,
  'api.carbonintensity.org.uk': fixtureFetch,
  'swpc.noaa.gov': fixtureFetch,
  'earthquake.usgs.gov': fixtureFetch,
  'api.inaturalist.org': fixtureFetch,
  'timeseries.sepa.org.uk': fixtureFetch,
};
const desktop = await launchBrowser({ width: 1280, height: 900, routes: liveRoutes });
const p = desktop.page;

await check('home page lists 8 quests', async () => {
  await p.goto(`${BASE}/index.html`);
  await p.waitFor('document.querySelectorAll(".quest").length === 8');
  await p.screenshot(`${out}/home-desktop.png`);
});

await check('blocks: drag and drop builds and passes question 1', async () => {
  await p.goto(`${BASE}/quest.html?q=missing-trophy&seed=1234&mode=blocks,tiles,type`);
  await p.waitFor('!!document.querySelector(".question .prompt")');
  await p.drag(chip('* all fields'), zone('select'));
  await p.drag(chip('visitors table'), zone('from'));
  await p.drag(chip('room field'), zone('where'));
  await p.drag(chip('= comparison'), zone('where'), { offsetX: 200 });
  await p.click('.value-maker input');
  await p.type('Office');
  await p.click('.value-maker .btn');
  await p.waitFor(`!!document.querySelector(${JSON.stringify(chip("'Office' (text) value"))})`);
  await p.drag(chip("'Office' (text) value"), zone('where'), { offsetX: 300 });
  const sql = await p.eval('document.querySelector(".sql-preview").textContent');
  assert.equal(sql, "SELECT *\nFROM visitors\nWHERE room = 'Office'");
  await p.click('.editor-actions .btn-primary');
  await p.waitFor('!!document.querySelector(".feedback .notice.good")');
  await p.screenshot(`${out}/quest-blocks-correct.png`);
});

await check('tap-to-place works without dragging', async () => {
  await p.click('.question .btn-primary'); // next question
  await p.waitFor('document.querySelector(".question h2").textContent.startsWith("Question 2")');
  await p.click('.editor-actions .btn-quiet'); // clear
  await p.click(chip('name field'));
  await p.click(zone('select'));
  const n = await p.eval(`document.querySelectorAll('${zone('select')} .chip').length`);
  assert.equal(n, 1);
});

await check('keyboard: Enter picks up, Enter on a zone places', async () => {
  await p.eval(`document.querySelector('${chip('time_in field')}').focus()`);
  await p.key('Enter');
  await p.eval(`document.querySelector('${zone('select')}').focus()`);
  await p.key('Enter');
  const labels = await p.eval(`[...document.querySelectorAll('${zone('select')} .chip')].map(c => c.firstChild.textContent)`);
  assert.deepEqual(labels, ['name', 'time_in']);
});

await check('switching Blocks -> Tiles -> Type keeps the query', async () => {
  await p.click('.mode-switch button:nth-child(2)');
  await p.waitFor('!!document.querySelector("[data-zone=tiles]")');
  const tiles = await p.eval('document.querySelector(".sql-preview").textContent');
  assert.match(tiles, /SELECT name, time_in/);
  await p.screenshot(`${out}/quest-tiles.png`);
  await p.click('.mode-switch button:nth-child(3)');
  await p.waitFor('!!document.querySelector(".code-box textarea")');
  const text = await p.eval('document.querySelector(".code-box textarea").value');
  assert.match(text, /^SELECT name, time_in/);
});

await check('type mode answer is marked, and unsupported SQL warns when switching back', async () => {
  await p.eval(`(() => { const t = document.querySelector('.code-box textarea'); t.value = "select name, time_in, time_out from visitors where room = 'Office' order by time_in"; t.dispatchEvent(new Event('input')); })()`);
  await p.click('.editor-actions .btn-primary');
  await p.waitFor('!!document.querySelector(".feedback .notice.good")');
  await p.eval(`(() => { const t = document.querySelector('.code-box textarea'); t.value = "SELECT name AS n FROM visitors"; t.dispatchEvent(new Event('input')); })()`);
  await p.click('.mode-switch button:nth-child(1)');
  await p.waitFor('!!document.querySelector(".switch-notice")');
  await p.screenshot(`${out}/quest-type-notice.png`);
  await p.click('.switch-notice .btn-quiet');
  await p.waitFor('!!document.querySelector("[data-zone=select]")');
});

await check('wrong answer gets a specific nudge, hints reveal', async () => {
  await p.goto(`${BASE}/quest.html?q=missing-trophy&seed=1234&mode=blocks`);
  await p.waitFor('!!document.querySelector(".question .prompt")');
  await p.drag(chip('* all fields'), zone('select'));
  await p.drag(chip('visitors table'), zone('from'));
  await p.click('.editor-actions .btn-primary');
  await p.waitFor('!!document.querySelector(".feedback .notice.warn")');
  const msg = await p.eval('document.querySelector(".feedback").textContent');
  assert.match(msg, /rows/);
  await p.click('.hints .btn');
  await p.waitFor('document.querySelectorAll(".hints li").length === 1');
});

await check('locked mode hides the switch', async () => {
  await p.goto(`${BASE}/quest.html?q=river-watch&seed=55&mode=blocks`);
  await p.waitFor('!!document.querySelector(".question .prompt")');
  assert.equal(await p.eval('!!document.querySelector(".mode-switch")'), false);
});

await check('every quest page opens without errors', async () => {
  for (const id of ['missing-trophy', 'river-watch', 'phantom-login', 'game-shop', 'planet-hunters', 'chart-toppers', 'wildlife-watch', 'sports-day']) {
    await p.goto(`${BASE}/quest.html?q=${id}&seed=77`);
    await p.waitFor('!!document.querySelector(".question .prompt")');
  }
  await p.screenshot(`${out}/quest-sports-day.png`);
});

await check('my data: sample loads, types toggle, table queries and exports', async () => {
  await p.goto(`${BASE}/mydata.html`);
  await p.waitFor('!!document.querySelector(".samples button")');
  await p.click('.samples button');
  await p.waitFor('!!document.querySelector(".type-select")');
  const sel = n => `document.querySelectorAll('.type-select')[${n}]`;
  assert.equal(await p.eval(`${sel(3)}.value`), 'real', 'hours of sleep guessed as Real');
  await p.eval(`(() => { const s = ${sel(0)}; s.value = 'integer'; s.dispatchEvent(new Event('change')); })()`);
  await p.waitFor('!!document.querySelector(".misfit")');
  assert.match(await p.eval('document.querySelector(".misfit").textContent'), /40 values don't fit/);
  await p.eval(`(() => { const s = ${sel(0)}; s.value = 'text'; s.dispatchEvent(new Event('change')); })()`);
  await p.waitFor('!document.querySelector(".misfit")');
  await p.eval('document.querySelector(".type-guide").open = true');
  await p.screenshot(`${out}/mydata-preview.png`);
  await p.click('[aria-label="Check your data"] .field-row .btn-primary');
  await p.waitFor('!!document.querySelector("[data-zone=select]")');
  await p.drag(chip('favourite_subject field'), zone('select'));
  await p.drag('.palette .chip[aria-label="COUNT(*) function"]', zone('select'), { offsetX: 200 });
  await p.drag(chip('class_survey table'), zone('from'));
  await p.click('.add-clauses button:nth-child(1)');
  await p.drag(chip('favourite_subject field'), zone('groupBy'));
  await p.click('.editor-actions .btn-primary');
  await p.waitFor('document.querySelectorAll(".result-panel tbody tr").length > 2');
  const disabled = await p.eval('document.querySelector(".result-panel .btn").disabled');
  assert.equal(disabled, false);
  await p.screenshot(`${out}/mydata-query.png`);
});

await check('live data: weather and electricity load and query', async () => {
  liveRoutes.enabled = true;
  await p.goto(`${BASE}/mydata.html`);
  await p.waitFor('!!document.querySelector(".live-option")');
  await p.eval(`document.querySelector('#live-place-weatherWeek').value = 'Inverness'`);
  await p.click('[data-source=weatherWeek]');
  await p.waitFor('!!document.querySelector(".type-select")');
  assert.equal(await p.eval('document.querySelector("#table-name").value'), 'weather_inverness');
  assert.match(await p.eval('document.querySelector(".about-data .credit").textContent'), /Open-Meteo/);
  assert.match(await p.eval('document.querySelector(".about-data").textContent'), /humidity_pct.*How damp the air is/);
  await p.screenshot(`${out}/live-preview.png`);
  await p.click('[aria-label="Check your data"] .field-row .btn-primary');
  await p.waitFor('!!document.querySelector("[data-zone=select]")');
  assert.match(await p.eval('document.querySelector(".starters").textContent'), /windiest/);
  await p.click('[data-source=electricity]');
  await p.waitFor('!!document.querySelector(".type-select")');
  await p.click('[aria-label="Check your data"] .field-row .btn-primary');
  await p.waitFor('document.querySelectorAll(".table-tabs .btn").length === 3');
  await p.click('.mode-switch button:nth-child(3)');
  await p.eval(`(() => { const t = document.querySelector('.code-box textarea'); t.value = "SELECT region, AVG(wind_pct) FROM electricity_scotland GROUP BY region"; t.dispatchEvent(new Event('input')); })()`);
  await p.click('.editor-actions .btn-primary');
  await p.waitFor('document.querySelectorAll(".result-panel tbody tr").length === 2');
  await p.screenshot(`${out}/live-electricity.png`);
});

await check('live data: blocked service offers the saved example', async () => {
  const saved = liveRoutes['open-meteo.com'];
  liveRoutes['open-meteo.com'] = () => null;
  try {
    await p.goto(`${BASE}/mydata.html`);
    await p.waitFor('!!document.querySelector(".live-option")');
    await p.click('[data-source=weatherScotland]');
    await p.waitFor('!!document.querySelector(".notice.bad button")');
    assert.match(await p.eval('document.querySelector(".notice.bad").textContent'), /could not be reached/);
    await p.click('.notice.bad button');
    await p.waitFor('!!document.querySelector(".type-select")');
    assert.match(await p.eval('document.querySelector(".panel .notice").textContent'), /saved example/);
    assert.ok(await p.eval('!!document.querySelector(".about-data")'), 'saved example has a description too');
  } finally {
    liveRoutes['open-meteo.com'] = saved;
  }
});

await check('live data: all eight sources load with a description', async () => {
  await p.goto(`${BASE}/mydata.html`);
  await p.waitFor('document.querySelectorAll("[data-source]").length === 8');
  const ids = await p.eval('[...document.querySelectorAll("[data-source]")].map(b => b.dataset.source)');
  for (const id of ids) {
    await p.click(`[data-source=${id}]`);
    await p.waitFor('!!document.querySelector(".about-data") && !!document.querySelector(".type-select")', 8000);
    const text = await p.eval('document.querySelector(".about-data").textContent');
    assert.match(text, /What the columns mean/, id);
    await p.click('[aria-label="Check your data"] .field-row .btn-primary');
    await p.waitFor('!!document.querySelector(".about-data.panel")');
    if (id === 'earthquakes') await p.screenshot(`${out}/live-earthquakes.png`);
  }
  assert.equal(await p.eval('document.querySelectorAll(".table-tabs .btn-small").length'), 9, '8 tables plus remove button');
});

await check('a full quest can be finished', async () => {
  await p.goto(`${BASE}/quest.html?q=game-shop&seed=9&mode=type`);
  await p.waitFor('!!document.querySelector(".question .prompt")');
  const answers = startQuest(findQuest('game-shop'), 9, makeRunner()).questions.map(q => q.answer);
  for (const a of answers) {
    await p.eval(`(() => { const t = document.querySelector('.code-box textarea'); t.value = ${JSON.stringify(a)}; t.dispatchEvent(new Event('input')); })()`);
    await p.click('.editor-actions .btn-primary');
    await p.waitFor('!!document.querySelector(".feedback .notice.good")');
    await p.click('.question .btn-primary');
  }
  await p.waitFor('document.querySelector(".question h2").textContent === "Case closed"');
  await p.screenshot(`${out}/quest-finished.png`);
  await p.goto(`${BASE}/index.html`);
  await p.waitFor('document.querySelectorAll(".quest").length === 8');
  assert.match(await p.eval('document.querySelector(".quest[data-colour=rose] .stars").textContent'), /18/);
});

desktop.close();

const phone = await launchBrowser({ width: 390, height: 844 });
await check('phone: layout fits and touch drag works', async () => {
  const m = phone.page;
  await m.goto(`${BASE}/index.html`);
  await m.waitFor('document.querySelectorAll(".quest").length === 8');
  assert.ok(await m.eval('document.documentElement.scrollWidth <= window.innerWidth + 1'), 'no sideways scroll on home');
  await m.screenshot(`${out}/home-phone.png`);
  await m.goto(`${BASE}/quest.html?q=river-watch&seed=4821&mode=blocks`);
  await m.waitFor('!!document.querySelector(".question .prompt")');
  await m.touchDrag(chip('* all fields'), zone('select'));
  await m.waitFor(`document.querySelectorAll('${zone('select')} .chip').length === 1`);
  assert.ok(await m.eval('document.documentElement.scrollWidth <= window.innerWidth + 1'), 'no sideways scroll on quest');
  await m.screenshot(`${out}/quest-phone.png`);
  results.push(...m.consoleLog.map(l => `CONSOLE(phone) ${l}`));
});
phone.close();

results.push(...p.consoleLog.map(l => `CONSOLE ${l}`));
server.close();
console.log(results.join('\n'));
process.exit(results.some(r => r.startsWith('FAIL') || r.includes('EXCEPTION')) ? 1 : 0);

import { createDb } from '../db.js';
import { createEditor, MODES } from '../editor/editor.js';
import { prepareCSV, buildTable, tableNameFromFile, sanitizeName, toCSV, starterChallenges } from '../csv.js';
import { checkReadOnly } from '../query-model.js';
import { friendlyError } from '../marking.js';
import { getPref, setPref } from '../progress.js';
import { el, topbar, renderResult, params, fatal } from '../ui.js';
import { makeRng } from '../rng.js';
import { PLACES, SOURCES, fetchLive, weatherWeekStarters, WEATHER_SCOTLAND_STARTERS, ELECTRICITY_STARTERS } from '../live.js';

const SAMPLES = [
  { file: 'class-survey.csv', label: 'Class survey' },
  { file: 'weather.csv', label: 'Weather station' },
  { file: 'football-results.csv', label: 'Football results' },
];

const main = document.querySelector('main');
document.body.prepend(topbar('mydata'));

async function start() {
  let db;
  try { db = await createDb(); } catch (e) { fatal(main, e.message); return; }

  let active = null;
  let lastResult = null;
  let editor = null;

  const status = el('div', { 'aria-live': 'polite' });
  const fileInput = el('input', { type: 'file', accept: '.csv,text/csv', class: 'visually-hidden', id: 'csv-file' });
  const dropzone = el('section', { class: 'dropzone', 'aria-label': 'Load a CSV file' },
    el('h2', {}, 'Load a CSV file'),
    el('p', { class: 'muted' }, 'Drag a .csv file here, or choose one. The first row should be the column names.'),
    el('label', { class: 'btn btn-primary', for: 'csv-file' }, 'Choose a file'),
    fileInput,
    el('p', { class: 'muted' }, 'No file to hand? Try a sample:'),
    el('div', { class: 'samples' }, SAMPLES.map(s => el('button', {
      class: 'btn btn-small', type: 'button', onclick: () => loadSample(s),
    }, s.label))));
  const placeSelect = el('select', { id: 'live-place', class: 'place-select' },
    PLACES.map(pl => el('option', { value: pl.name, selected: pl.name === 'Glasgow' ? true : null }, pl.name)));
  const liveSection = el('section', { class: 'panel live', 'aria-label': 'Live data' },
    el('h2', {}, 'Live data'),
    el('p', {}, 'Fetch real, up-to-date public data. Only a request for public data is sent — nothing about you.'),
    el('div', { class: 'live-options' },
      el('div', { class: 'live-option' },
        el('h3', {}, 'Weather this week'),
        el('p', { class: 'muted' }, 'Every hour for the last 7 days: temperature, rain, wind, humidity and cloud.'),
        el('div', { class: 'field-row' },
          el('label', { for: 'live-place' }, 'Place'), placeSelect,
          el('button', { class: 'btn btn-primary btn-small', type: 'button', onclick: () => loadLive('weatherWeek', { place: placeSelect.value }) }, 'Fetch weather'))),
      el('div', { class: 'live-option' },
        el('h3', {}, 'Weather around Scotland'),
        el('p', { class: 'muted' }, `One row per day for the last 14 days in ${PLACES.length} places, from Lerwick to Dumfries.`),
        el('button', { class: 'btn btn-primary btn-small', type: 'button', onclick: () => loadLive('weatherScotland') }, 'Fetch weather')),
      el('div', { class: 'live-option' },
        el('h3', {}, 'Scotland\'s electricity'),
        el('p', { class: 'muted' }, 'Every half hour for the last 2 days: how green the electricity was, and how much came from wind, hydro, gas and more.'),
        el('button', { class: 'btn btn-primary btn-small', type: 'button', onclick: () => loadLive('electricity') }, 'Fetch electricity data'))));
  const preview = el('div');
  const workspace = el('div');
  const tableInfo = new Map();

  main.replaceChildren(
    el('section', { class: 'hero', style: 'padding-bottom:12px' },
      el('h1', {}, 'Ask questions of your own data.'),
      el('p', { class: 'lede' }, 'Load a spreadsheet saved as CSV, or fetch live weather and electricity data. Check the column types, then query it with Blocks, Tiles or Type.'),
      el('p', { class: 'notice' }, 'Your file is read on this device and never uploaded. It disappears when you close the tab. Don\'t use files with personal details about real people.')),
    dropzone, liveSection, status, preview, workspace);

  fileInput.addEventListener('change', () => { if (fileInput.files[0]) readFile(fileInput.files[0]); fileInput.value = ''; });
  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('over'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('over'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('over');
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  });

  function say(msg, kind = '') { status.replaceChildren(msg ? el('div', { class: `notice ${kind}`, role: kind === 'bad' ? 'alert' : 'status' }, msg) : ''); }

  async function readFile(file) {
    if (!/\.(csv|txt)$/i.test(file.name) && !/csv|text\/plain/.test(file.type)) {
      say(`"${file.name}" doesn't look like a CSV file. In a spreadsheet app, use File → Download or Save as → CSV.`, 'bad');
      return;
    }
    const text = await file.text();
    showPreview(file.name, text, file.size);
  }

  async function loadSample(sample) {
    try {
      const res = await fetch(`samples/${sample.file}`);
      if (!res.ok) throw new Error(res.statusText);
      showPreview(sample.file, await res.text());
    } catch {
      say('The sample file could not be loaded. Check your connection and try again.', 'bad');
    }
  }

  async function loadLive(sourceId, opts = {}) {
    const source = SOURCES[sourceId];
    say(`Fetching ${source.label.toLowerCase()}…`);
    try {
      const table = await fetchLive(sourceId, opts);
      if (!table.rows.length) throw new Error('The service sent back no readings.');
      const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      showPreview(`${table.name}.csv`, toCSV(table.columns, table.rows), undefined, {
        name: table.name, credit: source.credit, starters: table.starters,
        note: `Live data fetched at ${time} today.`,
      });
    } catch (e) {
      status.replaceChildren(el('div', { class: 'notice bad', role: 'alert' },
        el('p', {}, `Couldn't fetch ${source.label.toLowerCase()}: ${e.message}`),
        el('button', { class: 'btn btn-small', type: 'button', onclick: () => loadExample(sourceId) }, 'Use the saved example instead')));
    }
  }

  async function loadExample(sourceId) {
    const source = SOURCES[sourceId];
    try {
      const res = await fetch(source.example);
      if (!res.ok) throw new Error(res.statusText);
      const starters = { weatherWeek: weatherWeekStarters('Glasgow'), weatherScotland: WEATHER_SCOTLAND_STARTERS, electricity: ELECTRICITY_STARTERS }[sourceId];
      const name = { weatherWeek: 'weather_example', weatherScotland: 'weather_scotland_example', electricity: 'electricity_example' }[sourceId];
      showPreview(`${name}.csv`, await res.text(), undefined, {
        name, starters,
        note: 'This is a saved example made to look like real data — not today\'s readings.',
      });
    } catch {
      say('The saved example could not be loaded either. Check your connection and try again.', 'bad');
    }
  }

  function showPreview(fileName, text, bytes, meta = {}) {
    const prepared = prepareCSV(text, { bytes });
    if (!prepared.ok) { say(prepared.error, 'bad'); preview.replaceChildren(); return; }
    say('');
    const types = prepared.types.slice();
    const nameInput = el('input', { type: 'text', value: uniqueTableName(meta.name || tableNameFromFile(fileName)), id: 'table-name', 'aria-describedby': 'table-name-help' });
    const tableBox = el('div');

    const drawTable = () => {
      const head = el('tr', {}, prepared.names.map((n, j) => el('th', { scope: 'col' },
        n,
        n !== prepared.original[j] ? el('span', { class: 'renamed' }, `was "${prepared.original[j]}"`) : null,
        el('span', { class: 'type-toggle', role: 'group', 'aria-label': `Type of ${n}` },
          ['number', 'text'].map(tp => el('button', {
            type: 'button', 'aria-pressed': String(types[j] === tp),
            onclick: () => { types[j] = tp; drawTable(); },
          }, tp === 'number' ? 'Number' : 'Text'))))));
      const body = prepared.rows.slice(0, 10).map(r => el('tr', {}, r.map((c, j) => el('td', { class: types[j] === 'number' ? 'num' : null }, c))));
      tableBox.replaceChildren(el('div', { class: 'results-wrap' }, el('table', { class: 'data' }, el('thead', {}, head), el('tbody', {}, body))));
    };
    drawTable();

    const notes = [];
    if (prepared.report.padded) notes.push(`${prepared.report.padded} row${prepared.report.padded === 1 ? ' was' : 's were'} shorter than the header, so the missing cells were left empty.`);
    if (prepared.report.trimmed) notes.push(`${prepared.report.trimmed} row${prepared.report.trimmed === 1 ? ' had' : 's had'} extra cells, which were removed.`);
    if (prepared.names.some((n, j) => n !== prepared.original[j])) notes.push('Some column names were changed so they work in SQL: lower case, no spaces, no symbols.');

    preview.replaceChildren(el('section', { class: 'panel', 'aria-label': 'Check your data' },
      el('h2', {}, 'Check your data'),
      meta.note ? el('p', { class: 'notice' }, meta.note, meta.credit ? el('span', { class: 'credit' }, meta.credit) : null) : null,
      el('p', {}, `${prepared.rows.length} rows and ${prepared.names.length} columns. Here are the first 10 rows. Check each column's type: `,
        el('strong', {}, 'Number'), ' columns can be added up, averaged and compared by size; ',
        el('strong', {}, 'Text'), ' columns are compared letter by letter — so "10" comes before "9".'),
      notes.map(n => el('p', { class: 'notice warn' }, n)),
      tableBox,
      el('div', { class: 'field-row' },
        el('label', { for: 'table-name' }, 'Table name'), nameInput,
        el('button', {
          class: 'btn btn-primary', type: 'button',
          onclick: () => createTable(prepared, types, nameInput.value, meta),
        }, 'Create table'),
        el('button', { class: 'btn btn-quiet', type: 'button', onclick: () => preview.replaceChildren() }, 'Cancel')),
      el('p', { class: 'muted', id: 'table-name-help' }, 'Use letters, numbers and underscores only.')));
    preview.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function uniqueTableName(base) {
    const names = new Set(db.tables().map(t => t.name));
    let n = base, k = 2;
    while (names.has(n)) n = `${base}_${k++}`;
    return n;
  }

  function createTable(prepared, types, rawName, meta = {}) {
    const name = sanitizeName(rawName, 'my_data');
    tableInfo.set(name, meta);
    const { def, blanked } = buildTable(name, prepared, types);
    try { db.load([def]); } catch (e) { say(`The table couldn't be created: ${e.message}`, 'bad'); return; }
    preview.replaceChildren();
    active = name;
    say(`Created table ${name} with ${def.rows.length} rows.${blanked ? ` ${blanked} cell${blanked === 1 ? '' : 's'} in number columns weren't numbers, so they were left empty.` : ''}`, 'good');
    drawWorkspace();
  }

  function drawWorkspace() {
    const tables = db.tables();
    if (!tables.length) { workspace.replaceChildren(); editor = null; return; }
    const def = tables.find(t => t.name === active) || tables[0];
    active = def.name;

    const tabs = el('div', { class: 'table-tabs', role: 'group', 'aria-label': 'Your tables' },
      tables.map(t => el('button', {
        class: `btn btn-small${t.name === active ? ' btn-primary' : ''}`, type: 'button', 'aria-pressed': String(t.name === active),
        onclick: () => { active = t.name; drawWorkspace(); },
      }, t.name)),
      el('button', {
        class: 'btn btn-small btn-quiet', type: 'button',
        onclick: () => { db.drop(active); active = null; say(`Removed table ${def.name}.`); drawWorkspace(); },
      }, `Remove ${def.name}`));

    const rng = makeRng(def.rows.length + def.columns.length);
    const info = tableInfo.get(def.name) || {};
    const starters = el('section', { class: 'panel starters' },
      el('h2', {}, 'Questions to try'),
      el('ul', {}, (info.starters || starterChallenges(def, list => rng.pick(list))).map(q => el('li', { html: q }))));

    const editorHost = el('div', { class: 'panel' });
    const resultBox = el('div', {}, el('p', { class: 'muted' }, 'Run your query to see what it finds.'));
    const exportBtn = el('button', { class: 'btn btn-small', type: 'button', disabled: true, onclick: exportResults }, 'Download results as CSV');

    workspace.replaceChildren(el('div', { class: 'workspace', style: 'margin-top:20px' },
      el('div', { class: 'case-side' },
        el('section', { class: 'panel' }, el('h2', {}, 'Your tables'), tabs,
          el('p', { class: 'columns-list' }, def.columns.map(c => `${c.name} (${c.type})`).join(', ')),
          el('p', { class: 'muted' }, `${def.rows.length} records.`),
          info.credit ? el('p', { class: 'credit' }, info.credit) : null),
        starters),
      el('div', { style: 'display:grid;gap:16px' }, editorHost,
        el('section', { class: 'panel result-panel', 'aria-live': 'polite' }, el('h2', {}, 'Results'), resultBox, exportBtn))));

    const raw = params().get('mode');
    const locked = raw ? raw.split(',').filter(m => MODES.some(x => x.id === m)) : [];
    editor = createEditor(editorHost, {
      tables: [{ name: def.name, columns: def.columns }],
      modes: locked.length ? locked : undefined,
      mode: locked[0] || getPref('mode', 'blocks'),
      onRun: run,
      onModeChange: m => { if (!locked.length) setPref('mode', m); },
    });
    editor.actions.append(
      el('button', { class: 'btn btn-primary', type: 'button', onclick: run }, 'Run query'),
      el('button', { class: 'btn btn-quiet', type: 'button', onclick: () => { editor.clear(); renderResult(resultBox, null); } }, 'Clear'));

    function run() {
      const { sql, error } = editor.getSQL();
      if (error) { renderResult(resultBox, { error }); return; }
      const safe = checkReadOnly(sql);
      if (!safe.ok) { renderResult(resultBox, { error: safe.reason }); return; }
      const res = db.run(sql);
      lastResult = res.error ? null : res;
      exportBtn.disabled = !lastResult;
      renderResult(resultBox, res.error ? { error: friendlyError(res.error) } : res);
    }
  }

  function exportResults() {
    if (!lastResult) return;
    const blob = new Blob([toCSV(lastResult.columns, lastResult.rows)], { type: 'text/csv' });
    const a = el('a', { href: URL.createObjectURL(blob), download: `${active || 'results'}-query.csv` });
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
}

start();

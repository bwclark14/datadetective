import { createDb } from '../db.js';
import { createEditor, MODES } from '../editor/editor.js';
import { prepareCSV, buildTable, tableNameFromFile, sanitizeName, toCSV, starterChallenges, columnMisfits } from '../csv.js';
import { DATA_TYPES, typeLabel, isNumericType } from '../types.js';
import { checkReadOnly } from '../query-model.js';
import { friendlyError } from '../marking.js';
import { getPref, setPref } from '../progress.js';
import { el, topbar, renderResult, params, fatal } from '../ui.js';
import { makeRng } from '../rng.js';
import { PLACES, SOURCES, SOURCE_LIST, fetchLive } from '../live.js';
import { renderAbout } from '../about-data.js';

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
  const liveSection = el('section', { class: 'panel live', 'aria-label': 'Live data' },
    el('h2', {}, 'Live data'),
    el('p', {}, 'Fetch real, up-to-date public data. Only a request for public data is sent — nothing about you.'),
    el('div', { class: 'live-options' }, SOURCE_LIST.map(source => {
      const id = `live-place-${source.id}`;
      const select = source.needsPlace
        ? el('select', { id, class: 'place-select' }, PLACES.map(pl => el('option', { value: pl.name, selected: pl.name === 'Glasgow' ? true : null }, pl.name)))
        : null;
      const button = el('button', {
        class: 'btn btn-primary btn-small', type: 'button', 'data-source': source.id,
        onclick: () => loadLive(source.id, { place: select?.value }),
      }, 'Fetch data');
      return el('div', { class: 'live-option' },
        el('h3', {}, source.label),
        el('p', { class: 'muted' }, source.blurb),
        select ? el('div', { class: 'field-row' }, el('label', { for: id }, 'Place'), select, button) : button);
    })));
  const preview = el('div');
  const workspace = el('div');
  const tableInfo = new Map();

  main.replaceChildren(
    el('section', { class: 'hero', style: 'padding-bottom:12px' },
      el('h1', {}, 'Ask questions of your own data.'),
      el('p', { class: 'lede' }, 'Load a spreadsheet saved as CSV, or fetch live data: weather, air quality, rivers, electricity, earthquakes, the northern lights and wildlife. Check the column types, then query it with Blocks, Tiles or Type.'),
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
        name: table.name, credit: table.credit, starters: table.starters, types: table.types, about: table.about,
        note: `Live data fetched at ${time} today.`,
      });
    } catch (e) {
      status.replaceChildren(el('div', { class: 'notice bad', role: 'alert' },
        el('p', {}, `Couldn't fetch ${source.label.toLowerCase()}: ${e.message}`),
        el('button', { class: 'btn btn-small', type: 'button', onclick: () => loadExample(sourceId, opts) }, 'Use the saved example instead')));
    }
  }

  async function loadExample(sourceId, opts = {}) {
    const source = SOURCES[sourceId];
    try {
      const res = await fetch(source.example);
      if (!res.ok) throw new Error(res.statusText);
      const place = sourceId === 'weatherWeek' || sourceId === 'airQuality' ? 'Glasgow' : opts.place;
      showPreview(`${sourceId}_example.csv`, await res.text(), undefined, {
        name: `${source.id.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`)}_example`,
        starters: source.starters(place || 'Glasgow'), types: source.types, about: source.about(place || 'Glasgow'), credit: source.credit,
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
    const types = meta.types && meta.types.length === prepared.types.length ? meta.types.slice() : prepared.types.slice();
    const nameInput = el('input', { type: 'text', value: uniqueTableName(meta.name || tableNameFromFile(fileName)), id: 'table-name', 'aria-describedby': 'table-name-help' });
    const tableBox = el('div');

    const drawTable = () => {
      const head = el('tr', {}, prepared.names.map((n, j) => {
        const misfits = columnMisfits(prepared, j, types[j]);
        const select = el('select', { class: 'type-select', 'aria-label': `Data type of ${n}` },
          DATA_TYPES.map(tp => el('option', { value: tp.id, selected: types[j] === tp.id ? true : null }, tp.label)));
        select.addEventListener('change', () => { types[j] = select.value; drawTable(); tableBox.querySelectorAll('.type-select')[j]?.focus(); });
        return el('th', { scope: 'col' },
          n,
          n !== prepared.original[j] ? el('span', { class: 'renamed' }, `was "${prepared.original[j]}"`) : null,
          select,
          misfits ? el('span', { class: 'misfit', role: 'status' },
            `${misfits} value${misfits === 1 ? " doesn't" : "s don't"} fit — ${misfits === 1 ? 'it' : 'they'}'ll be left empty`) : null);
      }));
      const body = prepared.rows.slice(0, 10).map(r => el('tr', {}, r.map((c, j) => el('td', { class: isNumericType(types[j]) ? 'num' : null }, c))));
      tableBox.replaceChildren(el('div', { class: 'results-wrap' }, el('table', { class: 'data' }, el('thead', {}, head), el('tbody', {}, body))));
    };
    drawTable();

    const notes = [];
    if (prepared.report.padded) notes.push(`${prepared.report.padded} row${prepared.report.padded === 1 ? ' was' : 's were'} shorter than the header, so the missing cells were left empty.`);
    if (prepared.report.trimmed) notes.push(`${prepared.report.trimmed} row${prepared.report.trimmed === 1 ? ' had' : 's had'} extra cells, which were removed.`);
    if (prepared.names.some((n, j) => n !== prepared.original[j])) notes.push('Some column names were changed so they work in SQL: lower case, no spaces, no symbols.');

    preview.replaceChildren(el('section', { class: 'panel', 'aria-label': 'Check your data' },
      el('h2', {}, 'Check your data'),
      meta.note ? el('p', { class: 'notice' }, meta.note) : null,
      meta.about ? renderAbout(meta.about, meta.credit, { open: true }) : null,
      el('p', {}, `${prepared.rows.length} rows and ${prepared.names.length} columns. Here are the first 10 rows. `,
        'Choose the best data type for each column — the menu shows a guess. Getting it right matters: you can only add up and average numbers, and text is compared letter by letter, so "10" comes before "9".'),
      el('details', { class: 'type-guide' },
        el('summary', {}, 'Which type should I choose?'),
        el('dl', {}, DATA_TYPES.flatMap(tp => [el('dt', {}, tp.label), el('dd', {}, tp.help)])),
        el('p', { class: 'muted' }, 'UK dates like 03/11/2026 are changed to 2026-11-03. Boolean columns are stored as 1 (TRUE) and 0 (FALSE), so query them with = TRUE or = FALSE.')),
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
    say(`Created table ${name} with ${def.rows.length} rows.${blanked ? ` ${blanked} cell${blanked === 1 ? " didn't" : "s didn't"} fit ${blanked === 1 ? 'its' : 'their'} column's type, so ${blanked === 1 ? 'it was' : 'they were'} left empty.` : ''}`, 'good');
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
          el('p', { class: 'columns-list' }, def.columns.map(c => `${c.name} (${typeLabel(c.type)})`).join(', ')),
          el('p', { class: 'muted' }, `${def.rows.length} records.`),
          info.credit && !info.about ? el('p', { class: 'credit' }, info.credit) : null),
        info.about ? renderAbout(info.about, info.credit, { open: true, panel: true }) : null,
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

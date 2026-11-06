// River levels at gauges on Scotland's big rivers, from SEPA's time series service (KiWIS).
import { num, utcParts, getJSON } from './common.js';

const KIWIS = 'https://timeseries.sepa.org.uk/KiWIS/KiWIS?service=kisters&type=queryServices&datasource=0';
export const RIVERS = ['Tay', 'Clyde', 'Spey', 'Dee', 'Tweed', 'Forth', 'Don', 'Nith', 'Ness', 'Kelvin'];

export function stationListUrl() {
  return `${KIWIS}&request=getTimeseriesList&stationparameter_name=Level&ts_name=15*&returnfields=station_name,river_name,ts_id,ts_name&format=json`;
}

export function valuesUrl(tsIds) {
  return `${KIWIS}&request=getTimeseriesValues&ts_id=${tsIds.join(',')}&period=P7D&returnfields=Timestamp,Value&format=json`;
}

const riverKey = name => String(name || '').toLowerCase().replace(/^river\s+/, '').replace(/^water of\s+/, '').trim();

/** Pick one gauge per well-known river from the station list (a header row followed by rows). */
export function chooseStations(json) {
  if (!Array.isArray(json) || !Array.isArray(json[0])) throw new Error('The river service sent an unexpected reply.');
  const head = json[0].map(h => String(h).toLowerCase());
  const si = head.indexOf('station_name'), ri = head.indexOf('river_name'), ti = head.indexOf('ts_id');
  if (si < 0 || ri < 0 || ti < 0) throw new Error('The river service changed its format.');
  const picks = [];
  for (const river of RIVERS) {
    const row = json.slice(1).find(r => riverKey(r[ri]) === river.toLowerCase() && !picks.some(p => p.tsId === String(r[ti])));
    if (row) picks.push({ river, station: String(row[si]), tsId: String(row[ti]) });
  }
  if (!picks.length) throw new Error('No river gauges were found.');
  return picks.slice(0, 8);
}

/** Readings on the hour only, so a week is a manageable size. */
export function riverRows(valuesJson, stations) {
  const list = Array.isArray(valuesJson) ? valuesJson : [valuesJson];
  const byId = new Map(stations.map(s => [s.tsId, s]));
  const rows = [];
  for (const series of list) {
    const s = byId.get(String(series?.ts_id));
    if (!s || !Array.isArray(series.data)) continue;
    const cols = String(series.columns || 'Timestamp,Value').split(',').map(c => c.trim().toLowerCase());
    const tIdx = Math.max(0, cols.indexOf('timestamp')), vIdx = cols.indexOf('value') < 0 ? 1 : cols.indexOf('value');
    for (const point of series.data) {
      const [date, time] = utcParts(point[tIdx]);
      if (!date || !time.endsWith(':00')) continue;
      const level = num(point[vIdx]);
      rows.push([s.river, s.station, date, time, level === null ? null : Math.round(level * 1000) / 1000]);
    }
  }
  if (!rows.length) throw new Error('The river service sent no readings.');
  return { columns: ['river', 'station', 'date', 'time_utc', 'level_m'], rows };
}

export const rivers = {
  id: 'rivers',
  label: 'Scottish rivers',
  blurb: 'Water levels every hour for the last 7 days on rivers including the Tay, Clyde, Spey and Tweed.',
  credit: 'River data from the Scottish Environment Protection Agency (SEPA), Open Government Licence',
  example: 'samples/live/rivers-example.csv',
  types: ['text', 'text', 'date', 'time', 'real'],
  about: () => ({
    summary: 'How high the water was, every hour for the last 7 days, at a measuring station on each of several of Scotland\'s best-known rivers.',
    from: 'The Scottish Environment Protection Agency (SEPA), which uses these gauges to warn people about floods.',
    updated: 'Every 15 minutes (this table keeps the reading on each hour).',
    rows: 'One row for each river gauge, each hour.',
    columns: {
      river: 'Which river the gauge is on.',
      station: 'The name of the measuring station.',
      date: 'The day, written YYYY-MM-DD.',
      time_utc: 'The time of the reading, in UTC (the same as UK time in winter).',
      level_m: 'How high the water was, in metres, above a fixed point at that station.',
    },
    note: 'Each station measures from its own fixed point, so compare a station with itself over time (did it rise after rain?) rather than one river with another. Recent readings haven\'t been checked yet and may be corrected later.',
  }),
  starters: () => [
    'What was the highest <b>level_m</b> on each <b>river</b>? (MAX with GROUP BY)',
    'And the lowest? Which river changed the most?',
    'Show the readings for the Tay, highest first.',
    'What was the average level on each <b>date</b> for one river? Did it rise after a wet day?',
    'How many readings are there for each <b>station</b>?',
  ],
  async fetch({ fetchImpl }) {
    const stations = chooseStations(await getJSON(stationListUrl(), fetchImpl));
    return { ...riverRows(await getJSON(valuesUrl(stations.map(s => s.tsId)), fetchImpl), stations), name: 'rivers_scotland' };
  },
};

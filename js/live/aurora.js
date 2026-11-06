// Geomagnetic activity (Kp index) from NOAA's Space Weather Prediction Center.
import { num, utcParts, getJSON } from './common.js';

export const KP_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json';

export function stormLevel(kp) {
  if (kp === null) return null;
  if (kp >= 9) return 'G5 extreme';
  if (kp >= 8) return 'G4 severe';
  if (kp >= 7) return 'G3 strong';
  if (kp >= 6) return 'G2 moderate';
  if (kp >= 5) return 'G1 minor';
  return 'no storm';
}

export function auroraChance(kp) {
  if (kp === null) return null;
  if (kp >= 7) return 'good across Scotland';
  if (kp >= 5) return 'good in the north';
  if (kp >= 4) return 'possible in the far north';
  if (kp >= 3) return 'low';
  return 'very low';
}

// NOAA has served this feed both as a header row followed by arrays, and as objects.
function readings(json) {
  if (!Array.isArray(json) || !json.length) throw new Error('The space weather service sent an unexpected reply.');
  if (Array.isArray(json[0])) {
    const head = json[0].map(h => String(h).toLowerCase());
    const ti = head.indexOf('time_tag');
    const ki = head.findIndex(h => h === 'kp' || h === 'kp_index');
    if (ti < 0 || ki < 0) throw new Error('The space weather service changed its format.');
    return json.slice(1).map(r => ({ time: r[ti], kp: num(r[ki]) }));
  }
  return json.map(o => ({ time: o.time_tag, kp: num(o.Kp ?? o.kp ?? o.kp_index) }));
}

export function auroraRows(json) {
  const seen = new Set();
  const rows = [];
  for (const { time, kp } of readings(json)) {
    const [date, t] = utcParts(time);
    if (!date || seen.has(`${date} ${t}`)) continue;
    seen.add(`${date} ${t}`);
    const k = kp === null ? null : Math.round(kp * 100) / 100;
    rows.push([date, t, k, stormLevel(k), auroraChance(k)]);
  }
  rows.sort((a, b) => `${a[0]} ${a[1]}`.localeCompare(`${b[0]} ${b[1]}`));
  return { columns: ['date', 'time_utc', 'kp', 'storm_level', 'aurora_chance'], rows };
}

export const aurora = {
  id: 'aurora',
  label: 'Northern lights watch',
  blurb: 'Space weather every 3 hours for the last week: how likely the aurora was to be seen from Scotland.',
  credit: 'Space weather data from the NOAA Space Weather Prediction Center (public domain)',
  example: 'samples/live/aurora-example.csv',
  types: ['date', 'time', 'real', 'text', 'text'],
  about: () => ({
    summary: 'How disturbed the Earth\'s magnetic field was over the last week. When it\'s disturbed, the northern lights (aurora) can be seen further south — sometimes across Scotland.',
    from: 'The Space Weather Prediction Center, part of the US National Oceanic and Atmospheric Administration (NOAA), using magnetometers around the world.',
    updated: 'Every 3 hours.',
    rows: 'One row for each 3-hour period.',
    columns: {
      date: 'The day, written YYYY-MM-DD.',
      time_utc: 'Start of the 3-hour period, in UTC (the same as UK time in winter).',
      kp: 'The Kp index, from 0 (calm) to 9 (extreme storm).',
      storm_level: 'NOAA\'s storm scale: no storm, or G1 minor up to G5 extreme. G1 starts at Kp 5.',
      aurora_chance: 'A rough guide to seeing the aurora from Scotland on a clear, dark night.',
    },
    note: 'Kp is a world-wide average, so it is only a guide. You also need clear skies and darkness away from street lights. The aurora_chance column is our simple rule of thumb, not an official forecast.',
  }),
  starters: () => [
    'What was the highest <b>kp</b> this week? When was it?',
    'Show every period where <b>kp</b> was 5 or more.',
    'How many periods were there for each <b>aurora_chance</b>? (GROUP BY)',
    'What was the average <b>kp</b> on each <b>date</b>? Which was the stormiest day?',
    'Were there any storms (<b>storm_level</b> not \'no storm\')? Use &lt;&gt;.',
  ],
  async fetch({ fetchImpl }) {
    return { ...auroraRows(await getJSON(KP_URL, fetchImpl)), name: 'aurora_watch' };
  },
};

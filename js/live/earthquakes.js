// Earthquakes of magnitude 2.5+ worldwide in the last 7 days, from the US Geological Survey.
import { num, round, utcParts, getJSON } from './common.js';

export const QUAKES_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson';

export function regionOf(place) {
  if (!place) return null;
  const parts = String(place).split(',');
  return parts[parts.length - 1].trim() || null;
}

export function earthquakeRows(json) {
  if (!json || !Array.isArray(json.features)) throw new Error('The earthquake service sent an unexpected reply.');
  const rows = json.features.map(f => {
    const p = f.properties || {};
    const [lon, lat, depth] = f.geometry?.coordinates || [];
    const [date, time] = utcParts(p.time);
    return [
      date, time, round(num(p.mag), 1), round(num(depth), 1), p.place ?? null, regionOf(p.place),
      round(num(lat), 2), round(num(lon), 2), p.tsunami === 1 ? 'yes' : 'no',
    ];
  });
  rows.sort((a, b) => `${b[0]} ${b[1]}`.localeCompare(`${a[0]} ${a[1]}`));
  return { columns: ['date', 'time_utc', 'magnitude', 'depth_km', 'place', 'region', 'latitude', 'longitude', 'tsunami_alert'], rows };
}

export const earthquakes = {
  id: 'earthquakes',
  label: 'Earthquakes this week',
  blurb: 'Every earthquake of magnitude 2.5 or more around the world in the last 7 days.',
  credit: 'Earthquake data from the U.S. Geological Survey (public domain)',
  example: 'samples/live/earthquakes-example.csv',
  types: ['date', 'time', 'real', 'real', 'text', 'text', 'real', 'real', 'boolean'],
  about: () => ({
    summary: 'Every earthquake around the world in the last 7 days that was strong enough to be felt (magnitude 2.5 or more).',
    from: 'The U.S. Geological Survey (USGS), which collects reports from earthquake monitoring stations all over the world.',
    updated: 'Every minute. Very recent earthquakes may be updated as more stations report in.',
    rows: 'One row for each earthquake, newest first.',
    columns: {
      date: 'The day it happened, written YYYY-MM-DD.',
      time_utc: 'The time it happened, in UTC.',
      magnitude: 'How strong it was. Each step up is about 32 times more energy: a 6 is about 1,000 times stronger than a 4.',
      depth_km: 'How far underground it started, in kilometres.',
      place: 'A description of where it was, e.g. "12 km S of Volcano, Hawaii".',
      region: 'The last part of the place: usually the country, state or sea area.',
      latitude: 'How far north (positive) or south (negative) of the equator, in degrees.',
      longitude: 'How far east (positive) or west (negative) of Greenwich, in degrees.',
      tsunami_alert: 'TRUE if the earthquake was big enough, and in the right place, for a tsunami alert to be considered.',
    },
    note: 'There are far more small earthquakes than large ones — that\'s normal. Some areas, like California and Alaska, have more stations, so more small quakes are recorded there.',
  }),
  starters: () => [
    'What was the strongest earthquake this week? Where was it?',
    'How many earthquakes were there in each <b>region</b>? Show the busiest first if you can.',
    'Show every earthquake with a <b>magnitude</b> of 5 or more, strongest first.',
    'What is the average <b>depth_km</b>? Are strong earthquakes deeper?',
    'Find every earthquake with Japan anywhere in its <b>place</b>. (LIKE \'%Japan%\')',
    'How many earthquakes had <b>tsunami_alert</b> = TRUE?',
  ],
  async fetch({ fetchImpl }) {
    return { ...earthquakeRows(await getJSON(QUAKES_URL, fetchImpl)), name: 'earthquakes' };
  },
};

// Air quality and pollen from Open-Meteo's air quality service.
import { findPlace, slug, num, localStamp, getJSON, checkOpenMeteo } from './common.js';

const URL_BASE = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const VARS = ['european_aqi', 'pm2_5', 'pm10', 'nitrogen_dioxide', 'ozone', 'birch_pollen', 'grass_pollen'];

export function airUrl(place) {
  const q = new URLSearchParams({
    latitude: place.lat, longitude: place.lon, hourly: VARS.join(','),
    past_days: '7', forecast_days: '1', timezone: 'Europe/London',
  });
  return `${URL_BASE}?${q}`;
}

export function aqiBand(aqi) {
  if (aqi === null) return null;
  if (aqi <= 20) return 'good';
  if (aqi <= 40) return 'fair';
  if (aqi <= 60) return 'moderate';
  if (aqi <= 80) return 'poor';
  if (aqi <= 100) return 'very poor';
  return 'extremely poor';
}

export function airRows(json, now = new Date()) {
  checkOpenMeteo(json);
  const h = json.hourly || {};
  const nowLocal = localStamp(now);
  const rows = [];
  (h.time || []).forEach((t, i) => {
    if (t > nowLocal) return;
    const aqi = num(h.european_aqi?.[i]);
    rows.push([
      t.slice(0, 10), t.slice(11, 16), Number(t.slice(11, 13)), aqi, aqiBand(aqi),
      num(h.pm2_5?.[i]), num(h.pm10?.[i]), num(h.nitrogen_dioxide?.[i]), num(h.ozone?.[i]),
      num(h.birch_pollen?.[i]), num(h.grass_pollen?.[i]),
    ]);
  });
  return {
    columns: ['date', 'time', 'hour', 'air_quality_index', 'air_quality', 'pm2_5', 'pm10', 'nitrogen_dioxide', 'ozone', 'birch_pollen', 'grass_pollen'],
    rows,
  };
}

export const airQuality = {
  id: 'airQuality',
  label: 'Air quality',
  blurb: 'Every hour for the last 7 days: pollution levels and pollen in a place you choose.',
  needsPlace: true,
  credit: 'Air quality data from Open-Meteo.com, based on the Copernicus Atmosphere Monitoring Service (CC BY 4.0)',
  example: 'samples/live/air-quality-example.csv',
  types: ['date', 'time', 'integer', 'integer', 'text', 'real', 'real', 'real', 'real', 'real', 'real'],
  about: place => ({
    summary: `How clean the air was in ${place} for every hour of the last 7 days, and how much pollen was about.`,
    from: 'Open-Meteo, using the European Union\'s Copernicus Atmosphere Monitoring Service, which combines satellite and ground measurements with computer models.',
    updated: 'Every hour.',
    rows: 'One row for each hour.',
    columns: {
      date: 'The day, written YYYY-MM-DD.',
      time: 'The hour, UK time.',
      hour: 'The hour as a number from 0 (midnight) to 23.',
      air_quality_index: 'The European Air Quality Index: 0–20 is good, and the higher the number, the worse the air.',
      air_quality: 'The index in words: good, fair, moderate, poor, very poor or extremely poor.',
      pm2_5: 'Tiny particles of dust and soot small enough to get deep into your lungs, in micrograms per cubic metre (μg/m³).',
      pm10: 'Slightly bigger particles such as dust and pollen fragments, in μg/m³.',
      nitrogen_dioxide: 'A gas mostly from car and van exhausts, in μg/m³. Often highest at rush hour.',
      ozone: 'A gas made when sunlight reacts with pollution, in μg/m³. Often highest on sunny afternoons.',
      birch_pollen: 'Birch tree pollen grains per cubic metre. Only measured in spring.',
      grass_pollen: 'Grass pollen grains per cubic metre. Only measured in late spring and summer.',
    },
    note: 'Pollen columns are empty outside the pollen season — that\'s normal, not an error. Values are for an area around the town, not one street.',
  }),
  starters: place => [
    `What was the worst <b>air_quality_index</b> in ${place} this week? When was it?`,
    'How many hours were rated \'good\'? (COUNT with WHERE)',
    'What is the average <b>nitrogen_dioxide</b> for each <b>hour</b>? Is it worse at rush hour (8:00 and 17:00)?',
    'Show the 5 hours with the most <b>pm2_5</b>, worst first.',
    'Count the hours for each <b>air_quality</b> rating. (GROUP BY)',
  ],
  async fetch({ place, fetchImpl, now }) {
    const p = findPlace(place);
    return { ...airRows(await getJSON(airUrl(p), fetchImpl), now), name: `air_${slug(p.name)}` };
  },
};

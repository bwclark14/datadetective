// Weather from Open-Meteo: hourly for one place, or daily across Scotland.
import { PLACES, findPlace, slug, num, localStamp, getJSON, checkOpenMeteo } from './common.js';

const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast';
const CREDIT = 'Weather data from Open-Meteo.com (CC BY 4.0)';

export function weatherWeekUrl(place) {
  const q = new URLSearchParams({
    latitude: place.lat, longitude: place.lon,
    hourly: 'temperature_2m,precipitation,wind_speed_10m,relative_humidity_2m,cloud_cover',
    past_days: '7', forecast_days: '1', wind_speed_unit: 'mph', timezone: 'Europe/London',
  });
  return `${OPEN_METEO}?${q}`;
}

export function weatherDailyUrl(place) {
  const q = new URLSearchParams({
    latitude: place.lat, longitude: place.lon,
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max',
    past_days: '14', forecast_days: '1', wind_speed_unit: 'mph', timezone: 'Europe/London',
  });
  return `${OPEN_METEO}?${q}`;
}

/** Hourly weather for one place. Only past hours are kept (no forecasts). */
export function weatherWeekRows(json, now = new Date()) {
  checkOpenMeteo(json);
  const h = json.hourly || {};
  const nowLocal = localStamp(now);
  const rows = [];
  (h.time || []).forEach((t, i) => {
    if (t > nowLocal) return;
    rows.push([
      t.slice(0, 10), t.slice(11, 16), Number(t.slice(11, 13)),
      num(h.temperature_2m?.[i]), num(h.precipitation?.[i]), num(h.wind_speed_10m?.[i]),
      num(h.relative_humidity_2m?.[i]), num(h.cloud_cover?.[i]),
    ]);
  });
  return { columns: ['date', 'time', 'hour', 'temperature_c', 'rain_mm', 'wind_mph', 'humidity_pct', 'cloud_pct'], rows };
}

/** Daily weather for several places: one row per place per day, past days only. */
export function weatherScotlandRows(results, now = new Date()) {
  const today = localStamp(now).slice(0, 10);
  const rows = [];
  for (const { place, json } of results) {
    checkOpenMeteo(json);
    const d = json.daily || {};
    (d.time || []).forEach((day, i) => {
      if (day >= today) return;
      rows.push([place, day, num(d.temperature_2m_max?.[i]), num(d.temperature_2m_min?.[i]),
        num(d.precipitation_sum?.[i]), num(d.wind_speed_10m_max?.[i])]);
    });
  }
  return { columns: ['place', 'date', 'max_temp_c', 'min_temp_c', 'rain_mm', 'max_wind_mph'], rows };
}

export const weatherWeek = {
  id: 'weatherWeek',
  label: 'Weather this week',
  blurb: 'Every hour for the last 7 days: temperature, rain, wind, humidity and cloud.',
  needsPlace: true,
  credit: CREDIT,
  example: 'samples/live/weather-week-example.csv',
  types: ['date', 'time', 'integer', 'real', 'real', 'real', 'integer', 'integer'],
  about: place => ({
    summary: `The weather in ${place} for every hour of the last 7 days, up to the most recent hour.`,
    from: 'Open-Meteo, a free weather service that combines readings and computer models from national weather services, including the Met Office.',
    updated: 'Every hour.',
    rows: 'One row for each hour.',
    columns: {
      date: 'The day, written YYYY-MM-DD.',
      time: 'The hour, UK time.',
      hour: 'The hour as a number from 0 (midnight) to 23 — handy for GROUP BY.',
      temperature_c: 'Air temperature in °C, 2 metres above the ground.',
      rain_mm: 'Rain (or snow, melted) in that hour, in millimetres.',
      wind_mph: 'Wind speed in miles per hour, 10 metres above the ground.',
      humidity_pct: 'How damp the air is, from 0 to 100%.',
      cloud_pct: 'How much of the sky was covered by cloud, from 0 to 100%.',
    },
    note: 'Values are for a grid square around the town, so they may differ slightly from a weather station in the town centre.',
  }),
  starters: place => [
    `What was the highest <b>temperature_c</b> in ${place} this week? And the lowest?`,
    'Show the 5 windiest hours, windiest first.',
    'How much rain fell on each <b>date</b>? (SUM with GROUP BY)',
    'What is the average <b>temperature_c</b> for each <b>hour</b> of the day? When is it usually warmest?',
    'How many hours had no rain at all?',
    'Show every hour where <b>cloud_pct</b> was under 20 — clear skies for stargazing.',
  ],
  async fetch({ place, fetchImpl, now }) {
    const p = findPlace(place);
    return { ...weatherWeekRows(await getJSON(weatherWeekUrl(p), fetchImpl), now), name: `weather_${slug(p.name)}` };
  },
};

export const weatherScotland = {
  id: 'weatherScotland',
  label: 'Weather around Scotland',
  blurb: `One row per day for the last 14 days in ${PLACES.length} places, from Lerwick to Dumfries.`,
  credit: CREDIT,
  example: 'samples/live/weather-scotland-example.csv',
  types: ['text', 'date', 'real', 'real', 'real', 'real'],
  about: () => ({
    summary: `Daily weather for the last 14 days in ${PLACES.length} places across Scotland, so you can compare north with south and east with west.`,
    from: 'Open-Meteo, a free weather service that combines readings and computer models from national weather services, including the Met Office.',
    updated: 'Every day. Today is left out because it isn\'t finished yet.',
    rows: 'One row for each place on each day.',
    columns: {
      place: 'The town the readings are for.',
      date: 'The day, written YYYY-MM-DD.',
      max_temp_c: 'The warmest it got that day, in °C.',
      min_temp_c: 'The coldest it got that day, in °C.',
      rain_mm: 'Total rain that day, in millimetres.',
      max_wind_mph: 'The strongest wind that day, in miles per hour.',
    },
  }),
  starters: () => [
    'Which <b>place</b> had the most rain in total? (SUM with GROUP BY)',
    'What is the average <b>max_temp_c</b> for each place? Is the north colder?',
    'Show every day anywhere with a <b>max_wind_mph</b> over 40, windiest first.',
    'How many dry days (<b>rain_mm</b> = 0) did each place have?',
    'What was the coldest night anywhere? (MIN of <b>min_temp_c</b>)',
  ],
  async fetch({ fetchImpl, now }) {
    const results = await Promise.all(PLACES.map(async pl => ({ place: pl.name, json: await getJSON(weatherDailyUrl(pl), fetchImpl) })));
    return { ...weatherScotlandRows(results, now), name: 'weather_scotland' };
  },
};

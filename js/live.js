// Live public data, fetched in the pupil's browser and turned into a table.
// Nothing about the pupil is sent: these are plain requests for public data.

export const PLACES = [
  { name: 'Aberdeen', lat: 57.15, lon: -2.09 },
  { name: 'Dumfries', lat: 55.07, lon: -3.61 },
  { name: 'Dundee', lat: 56.46, lon: -2.97 },
  { name: 'Edinburgh', lat: 55.95, lon: -3.19 },
  { name: 'Fort William', lat: 56.82, lon: -5.11 },
  { name: 'Glasgow', lat: 55.86, lon: -4.25 },
  { name: 'Inverness', lat: 57.48, lon: -4.22 },
  { name: 'Lerwick', lat: 60.15, lon: -1.15 },
  { name: 'Perth', lat: 56.40, lon: -3.43 },
  { name: 'Stirling', lat: 56.12, lon: -3.94 },
  { name: 'Stornoway', lat: 58.21, lon: -6.39 },
];

const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast';
const CARBON = 'https://api.carbonintensity.org.uk';
export const CARBON_REGIONS = [{ id: 1, name: 'North Scotland' }, { id: 2, name: 'South Scotland' }];
const FUELS = ['wind', 'hydro', 'solar', 'nuclear', 'gas', 'coal', 'biomass', 'imports', 'other'];

export const SOURCES = {
  weatherWeek: {
    label: 'Weather this week',
    credit: 'Weather data from Open-Meteo.com (CC BY 4.0)',
    example: 'samples/live/weather-week-example.csv',
    types: ['date', 'time', 'integer', 'real', 'real', 'real', 'integer', 'integer'],
  },
  weatherScotland: {
    label: 'Weather around Scotland',
    credit: 'Weather data from Open-Meteo.com (CC BY 4.0)',
    example: 'samples/live/weather-scotland-example.csv',
    types: ['text', 'date', 'real', 'real', 'real', 'real'],
  },
  electricity: {
    label: 'Scotland\'s electricity',
    credit: 'Electricity data from the Carbon Intensity API, National Energy System Operator (CC BY 4.0)',
    example: 'samples/live/electricity-scotland-example.csv',
    types: ['text', 'date', 'time', 'integer', 'text', 'real', 'real', 'real', 'real', 'real', 'real', 'real', 'real', 'real'],
  },
};

// ---------- addresses ----------

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

const isoMinute = d => `${d.toISOString().slice(0, 16)}Z`;

export function carbonUrl(regionId, now = new Date()) {
  const to = new Date(Math.floor(now.getTime() / 1800000) * 1800000);
  const from = new Date(to.getTime() - 48 * 3600000);
  return `${CARBON}/regional/intensity/${isoMinute(from)}/${isoMinute(to)}/regionid/${regionId}`;
}

// ---------- turning responses into rows ----------

const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function checkOpenMeteo(json) {
  if (!json || json.error) throw new Error(json?.reason || 'The weather service sent an unexpected reply.');
}

/** Hourly weather for one place. Only past hours are kept (no forecasts). */
export function weatherWeekRows(json, now = new Date()) {
  checkOpenMeteo(json);
  const h = json.hourly || {};
  const times = h.time || [];
  const nowLocal = localStamp(now);
  const rows = [];
  times.forEach((t, i) => {
    if (t > nowLocal) return;
    rows.push([
      t.slice(0, 10), t.slice(11, 16), Number(t.slice(11, 13)),
      num(h.temperature_2m?.[i]), num(h.precipitation?.[i]), num(h.wind_speed_10m?.[i]),
      num(h.relative_humidity_2m?.[i]), num(h.cloud_cover?.[i]),
    ]);
  });
  return {
    columns: ['date', 'time', 'hour', 'temperature_c', 'rain_mm', 'wind_mph', 'humidity_pct', 'cloud_pct'],
    rows,
  };
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

/** Half-hourly carbon intensity and fuel mix for the Scottish regions. */
export function electricityRows(results) {
  const rows = [];
  for (const { region, json } of results) {
    const periods = json?.data?.data;
    if (!Array.isArray(periods)) throw new Error('The electricity service sent an unexpected reply.');
    for (const p of periods) {
      const mix = Object.fromEntries((p.generationmix || []).map(g => [g.fuel, num(g.perc)]));
      rows.push([
        region, String(p.from).slice(0, 10), String(p.from).slice(11, 16),
        num(p.intensity?.forecast), p.intensity?.index ?? null,
        ...FUELS.map(f => mix[f] ?? null),
      ]);
    }
  }
  return {
    columns: ['region', 'date', 'time_utc', 'carbon_g_per_kwh', 'carbon_rating', ...FUELS.map(f => `${f}_pct`)],
    rows,
  };
}

// UK local time as "YYYY-MM-DDTHH:MM", matching Open-Meteo's timestamps.
export function localStamp(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

// ---------- fetching ----------

async function getJSON(url, fetchImpl, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`The service replied with an error (${res.status}).`);
    return await res.json();
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('The service took too long to reply.');
    if (e instanceof TypeError) throw new Error('The service could not be reached. School networks sometimes block it.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Returns { name, columns, rows, starters } for a source. */
export async function fetchLive(sourceId, { place, fetchImpl = fetch, now = new Date() } = {}) {
  if (sourceId === 'weatherWeek') {
    const p = PLACES.find(x => x.name === place) || PLACES.find(x => x.name === 'Glasgow');
    const t = weatherWeekRows(await getJSON(weatherWeekUrl(p), fetchImpl), now);
    return { ...t, types: SOURCES.weatherWeek.types, name: `weather_${p.name.toLowerCase().replace(/\W+/g, '_')}`, starters: weatherWeekStarters(p.name) };
  }
  if (sourceId === 'weatherScotland') {
    const results = await Promise.all(PLACES.map(async pl => ({ place: pl.name, json: await getJSON(weatherDailyUrl(pl), fetchImpl) })));
    return { ...weatherScotlandRows(results, now), types: SOURCES.weatherScotland.types, name: 'weather_scotland', starters: WEATHER_SCOTLAND_STARTERS };
  }
  if (sourceId === 'electricity') {
    const results = await Promise.all(CARBON_REGIONS.map(async r => ({ region: r.name, json: await getJSON(carbonUrl(r.id, now), fetchImpl) })));
    return { ...electricityRows(results), types: SOURCES.electricity.types, name: 'electricity_scotland', starters: ELECTRICITY_STARTERS };
  }
  throw new Error(`Unknown data source: ${sourceId}`);
}

// ---------- questions to try ----------

export function weatherWeekStarters(place) {
  return [
    `What was the highest <b>temperature_c</b> in ${place} this week? And the lowest?`,
    'Show the 5 windiest hours, windiest first.',
    'How much rain fell on each <b>date</b>? (SUM with GROUP BY)',
    'What is the average <b>temperature_c</b> for each <b>hour</b> of the day? When is it usually warmest?',
    'How many hours had no rain at all?',
    'Show every hour where <b>cloud_pct</b> was under 20 — clear skies for stargazing.',
  ];
}

export const WEATHER_SCOTLAND_STARTERS = [
  'Which <b>place</b> had the most rain in total? (SUM with GROUP BY)',
  'What is the average <b>max_temp_c</b> for each place? Is the north colder?',
  'Show every day anywhere with a <b>max_wind_mph</b> over 40, windiest first.',
  'How many dry days (<b>rain_mm</b> = 0) did each place have?',
  'What was the coldest night anywhere? (MIN of <b>min_temp_c</b>)',
];

export const ELECTRICITY_STARTERS = [
  'What is the average <b>wind_pct</b> for each <b>region</b>?',
  'Show the 5 half-hours with the lowest <b>carbon_g_per_kwh</b>, greenest first.',
  'How many half-hours were rated \'very low\' in each region?',
  'When was <b>gas_pct</b> highest? What was the wind doing then?',
  'Is electricity greener at night? Compare the average <b>carbon_g_per_kwh</b> where <b>time_utc</b> &lt; \'06:00\' with the whole day.',
];

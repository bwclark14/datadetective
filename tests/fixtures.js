// Recorded-shape responses for the live data services, used by the tests.

export function openMeteoHourly(start = '2026-11-01', days = 8) {
  const time = [], t = [], p = [], w = [], h = [], c = [];
  for (let d = 0; d < days; d++) {
    const date = new Date(`${start}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + d);
    const ds = date.toISOString().slice(0, 10);
    for (let hr = 0; hr < 24; hr++) {
      time.push(`${ds}T${String(hr).padStart(2, '0')}:00`);
      t.push(8 + (hr % 6)); p.push(hr % 5 === 0 ? 0.4 : 0); w.push(10 + d); h.push(80); c.push(hr % 3 === 0 ? 10 : 90);
    }
  }
  return {
    latitude: 55.86, longitude: -4.25, timezone: 'Europe/London',
    hourly_units: { time: 'iso8601', temperature_2m: '°C' },
    hourly: { time, temperature_2m: t, precipitation: p, wind_speed_10m: w, relative_humidity_2m: h, cloud_cover: c },
  };
}

export function openMeteoDaily(start = '2026-10-23', days = 15) {
  const time = [];
  for (let d = 0; d < days; d++) {
    const date = new Date(`${start}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + d);
    time.push(date.toISOString().slice(0, 10));
  }
  return {
    timezone: 'Europe/London',
    daily: {
      time,
      temperature_2m_max: time.map((_, i) => 10 + (i % 4)),
      temperature_2m_min: time.map((_, i) => 4 + (i % 3)),
      precipitation_sum: time.map((_, i) => (i % 2 ? 3.2 : 0)),
      wind_speed_10m_max: time.map((_, i) => 20 + i),
    },
  };
}

export function carbonRegional(regionid, shortname, periods = 96) {
  const data = [];
  const start = Date.UTC(2026, 10, 4, 0, 0);
  for (let k = 0; k < periods; k++) {
    const from = new Date(start + k * 1800000).toISOString().slice(0, 16) + 'Z';
    const to = new Date(start + (k + 1) * 1800000).toISOString().slice(0, 16) + 'Z';
    const wind = 40 + (k % 10) * 4;
    data.push({
      from, to,
      intensity: { forecast: 200 - wind * 2, index: wind > 70 ? 'very low' : 'low' },
      generationmix: [
        { fuel: 'biomass', perc: 2 }, { fuel: 'coal', perc: 0 }, { fuel: 'imports', perc: 3 },
        { fuel: 'gas', perc: 100 - wind - 10 }, { fuel: 'nuclear', perc: 0 }, { fuel: 'other', perc: 0 },
        { fuel: 'hydro', perc: 5 }, { fuel: 'solar', perc: 0 }, { fuel: 'wind', perc: wind },
      ],
    });
  }
  return { data: { regionid, dnoregion: 'SSE', shortname, data } };
}

export function openMeteoAir(start = '2026-11-01', days = 8) {
  const base = openMeteoHourly(start, days);
  const n = base.hourly.time.length;
  const series = f => Array.from({ length: n }, (_, i) => f(i));
  return {
    timezone: 'Europe/London',
    hourly: {
      time: base.hourly.time,
      european_aqi: series(i => 10 + (i % 50)),
      pm2_5: series(i => 3 + (i % 7)), pm10: series(i => 6 + (i % 9)),
      nitrogen_dioxide: series(i => 10 + (i % 24)), ozone: series(i => 40 - (i % 20)),
      birch_pollen: series(() => null), grass_pollen: series(() => null),
    },
  };
}

// NOAA's Kp feed as a header row followed by arrays.
export function noaaKp(asObjects = false) {
  const rows = [];
  for (let k = 0; k < 56; k++) {
    const t = new Date(Date.UTC(2026, 9, 30) + k * 3 * 3600000).toISOString().replace('T', ' ').slice(0, 19) + '.000';
    rows.push([t, String((k % 9) + 0.33), '5', '8']);
  }
  if (asObjects) return rows.map(r => ({ time_tag: r[0], Kp: Number(r[1]), a_running: 5, station_count: 8 }));
  return [['time_tag', 'Kp', 'a_running', 'station_count'], ...rows];
}

export function usgsQuakes(n = 40) {
  return {
    type: 'FeatureCollection',
    features: Array.from({ length: n }, (_, i) => ({
      type: 'Feature',
      properties: { mag: 2.5 + (i % 40) / 10, place: i % 3 ? `${10 + i} km S of Town, ${['Alaska', 'Japan', 'Chile'][i % 3]}` : 'south of the Fiji Islands', time: Date.UTC(2026, 10, 1) + i * 3600000, tsunami: i === 39 ? 1 : 0 },
      geometry: { type: 'Point', coordinates: [-150 + i, 60 - i, 10 + i] },
    })),
  };
}

export function inatPlaces() {
  return { results: [{ id: 99999, name: 'Scotland', display_name: 'Scotland, UK', admin_level: 10 }, { id: 1, name: 'Scotland County', display_name: 'Scotland County, US' }] };
}

export function inatObservations(n = 30) {
  const taxa = [
    { name: 'Ardea cinerea', preferred_common_name: 'grey heron', iconic_taxon_name: 'Aves' },
    { name: 'Sciurus vulgaris', preferred_common_name: 'Eurasian red squirrel', iconic_taxon_name: 'Mammalia' },
    { name: 'Amanita muscaria', preferred_common_name: 'fly agaric', iconic_taxon_name: 'Fungi' },
  ];
  return {
    total_results: n,
    results: Array.from({ length: n }, (_, i) => ({
      observed_on: `2026-11-0${(i % 5) + 1}`,
      place_guess: i % 2 ? '12 Some Road, Leith, Edinburgh, Scotland, GB' : 'Cairngorms National Park, UK',
      location: `${57.123 + i / 100},${-3.987}`,
      user: { login: 'secret_person' },
      taxon: taxa[i % 3],
    })),
  };
}

export function sepaStations() {
  return [
    ['station_name', 'river_name', 'ts_id', 'ts_name'],
    ['Ballathie', 'Tay', '111', '15minute'],
    ['Daldowie', 'River Clyde', '222', '15minute'],
    ['Boat o Brig', 'Spey', '333', '15minute'],
    ['Somewhere', 'Wee Burn', '444', '15minute'],
  ];
}

export function sepaValues(ids = ['111', '222', '333']) {
  return ids.map(id => ({
    ts_id: id, rows: '96', columns: 'Timestamp,Value',
    data: Array.from({ length: 96 }, (_, k) => [new Date(Date.UTC(2026, 10, 1) + k * 900000).toISOString().replace('Z', '+00:00'), 1 + k / 1000]),
  }));
}

/** A stand-in fetch that answers every live service with the fixtures above. */
export function fixtureFetch(url) {
  let body;
  if (url.includes('air-quality-api')) body = openMeteoAir();
  else if (url.includes('open-meteo')) body = url.includes('daily=') ? openMeteoDaily() : openMeteoHourly();
  else if (url.includes('carbonintensity')) body = carbonRegional(url.endsWith('/1') ? 1 : 2, 'Scotland');
  else if (url.includes('swpc.noaa.gov')) body = noaaKp();
  else if (url.includes('earthquake.usgs.gov')) body = usgsQuakes();
  else if (url.includes('places/autocomplete')) body = inatPlaces();
  else if (url.includes('inaturalist')) body = inatObservations();
  else if (url.includes('getTimeseriesList')) body = sepaStations();
  else if (url.includes('getTimeseriesValues')) body = sepaValues();
  return body;
}

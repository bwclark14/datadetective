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

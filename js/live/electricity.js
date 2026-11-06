// Carbon intensity and fuel mix for the two Scottish regions, from the Carbon Intensity API.
import { num, getJSON } from './common.js';

const CARBON = 'https://api.carbonintensity.org.uk';
export const CARBON_REGIONS = [{ id: 1, name: 'North Scotland' }, { id: 2, name: 'South Scotland' }];
const FUELS = ['wind', 'hydro', 'solar', 'nuclear', 'gas', 'coal', 'biomass', 'imports', 'other'];

const isoMinute = d => `${d.toISOString().slice(0, 16)}Z`;

export function carbonUrl(regionId, now = new Date()) {
  const to = new Date(Math.floor(now.getTime() / 1800000) * 1800000);
  const from = new Date(to.getTime() - 48 * 3600000);
  return `${CARBON}/regional/intensity/${isoMinute(from)}/${isoMinute(to)}/regionid/${regionId}`;
}

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
  return { columns: ['region', 'date', 'time_utc', 'carbon_g_per_kwh', 'carbon_rating', ...FUELS.map(f => `${f}_pct`)], rows };
}

export const electricity = {
  id: 'electricity',
  label: 'Scotland\'s electricity',
  blurb: 'Every half hour for the last 2 days: how green the electricity was, and how much came from wind, hydro, gas and more.',
  credit: 'Electricity data from the Carbon Intensity API, National Energy System Operator (CC BY 4.0)',
  example: 'samples/live/electricity-scotland-example.csv',
  types: ['text', 'date', 'time', 'integer', 'text', 'real', 'real', 'real', 'real', 'real', 'real', 'real', 'real', 'real'],
  about: () => ({
    summary: 'Where Scotland\'s electricity came from over the last 2 days, and how much carbon dioxide (CO₂) was released making it.',
    from: 'The Carbon Intensity API, run by the National Energy System Operator, which manages Britain\'s electricity grid.',
    updated: 'Every half hour.',
    rows: 'One row for each half hour, for each of the two Scottish grid regions (North Scotland and South Scotland).',
    columns: {
      region: 'North Scotland or South Scotland.',
      date: 'The day, written YYYY-MM-DD.',
      time_utc: 'Start of the half hour, in UTC (the same as UK time in winter, one hour behind in summer).',
      carbon_g_per_kwh: 'Grams of CO₂ released for each unit (kWh) of electricity. Lower is greener.',
      carbon_rating: 'The same thing in words: very low, low, moderate, high or very high.',
      wind_pct: 'Percentage of the electricity that came from wind turbines.',
      hydro_pct: 'Percentage from hydroelectric power stations (water).',
      solar_pct: 'Percentage from solar panels.',
      nuclear_pct: 'Percentage from nuclear power stations.',
      gas_pct: 'Percentage from gas power stations.',
      coal_pct: 'Percentage from coal (usually 0 now).',
      biomass_pct: 'Percentage from burning wood pellets and other plant material.',
      imports_pct: 'Percentage brought in from outside the region.',
      other_pct: 'Percentage from anything else.',
    },
    note: 'The fuel percentages in each row add up to about 100. Carbon figures for regions are best estimates rather than exact measurements.',
  }),
  starters: () => [
    'What is the average <b>wind_pct</b> for each <b>region</b>?',
    'Show the 5 half-hours with the lowest <b>carbon_g_per_kwh</b>, greenest first.',
    'How many half-hours were rated \'very low\' in each region?',
    'When was <b>gas_pct</b> highest? What was the wind doing then?',
    'Is electricity greener at night? Compare the average <b>carbon_g_per_kwh</b> where <b>time_utc</b> &lt; \'06:00\' with the whole day.',
  ],
  async fetch({ fetchImpl, now }) {
    const results = await Promise.all(CARBON_REGIONS.map(async r => ({ region: r.name, json: await getJSON(carbonUrl(r.id, now), fetchImpl) })));
    return { ...electricityRows(results), name: 'electricity_scotland' };
  },
};

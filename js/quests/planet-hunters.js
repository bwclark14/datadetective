import { f, v, t, sq } from './common.js';
import { makeRng } from '../rng.js';

const STARS = ['Vela-7', 'Ardan', 'Corvi-12', 'Talis', 'Mirra-3', 'Oren', 'Sefa-21', 'Lumen', 'Kestra-9', 'Nox-4'];

function buildCatalogue() {
  const rng = makeRng(7041977);
  const distances = rng.sample([4.2, 11.9, 16.3, 22.8, 39.5, 47.1, 63.0, 98.4, 140.2, 212.6, 318.0, 480.5], STARS.length);
  const temps = new Set([0, 100]);
  const uniqueTemp = (lo, hi) => { for (;;) { const x = rng.int(lo, hi); if (!temps.has(x)) { temps.add(x); return x; } } };
  const sizes = new Set();
  const uniqueSize = (lo, hi) => { for (;;) { const x = rng.int(lo * 10, hi * 10) / 10; if (!sizes.has(x)) { sizes.add(x); return x; } } };
  const rows = [];
  STARS.forEach((star, i) => {
    const count = rng.int(2, 4);
    for (let k = 0; k < count; k++) {
      const habitable = rng.chance(0.25);
      rows.push([
        `${star} ${'bcdef'[k]}`, star, distances[i],
        habitable ? uniqueTemp(3, 97) : rng.chance(0.5) ? uniqueTemp(-230, -5) : uniqueTemp(110, 950),
        habitable ? uniqueSize(0.4, 3) : uniqueSize(0.3, 14), rng.int(2009, 2025),
      ]);
    }
  });
  // Make sure there is something worth visiting nearby.
  rows[0][3] = uniqueTemp(12, 40); rows[0][4] = uniqueSize(0.8, 1.6);
  return rows;
}
const CATALOGUE = buildCatalogue();

export default {
  id: 'planet-hunters',
  code: 'PLANET',
  title: 'Planet Hunters',
  kind: 'Mission',
  colour: 'indigo',
  blurb: 'Mission control needs a new world to explore. Search the catalogue of planets beyond our solar system.',
  skills: ['WHERE', 'AND', 'MAX', 'AVG', 'COUNT', 'ORDER BY'],

  generate() {
    return {
      tables: [{
        name: 'planets',
        columns: [
          { name: 'name', type: 'text' }, { name: 'star', type: 'text' }, { name: 'distance_ly', type: 'number' },
          { name: 'temperature_c', type: 'number' }, { name: 'size_earths', type: 'number' }, { name: 'year_found', type: 'number' },
        ],
        rows: CATALOGUE,
      }],
      ctx: { stars: STARS },
    };
  },

  intro: () => `<p>The year is 2061. You're on the planning team for humanity's first crewed trip to another star.
    The ${t('planets')} table lists every planet found so far.</p>
    <p>${f('distance_ly')} is in light-years, ${f('temperature_c')} is in °C and ${f('size_earths')} compares the planet to Earth
    (1 = the same size as Earth).</p>`,

  questions: [
    {
      id: 'near',
      build: rng => {
        const n = rng.pick([20, 50, 100]);
        return {
          prompt: `Fuel is limited. Show the ${f('name')} and ${f('distance_ly')} of planets closer than ${v(n)} light-years.`,
          answer: `SELECT name, distance_ly FROM planets WHERE distance_ly < ${n}`,
          hints: ['Use WHERE with a comparison.', `Closer than means distance_ly < ${n}.`, `SELECT name, distance_ly FROM planets WHERE distance_ly < ${n}`],
        };
      },
    },
    {
      id: 'hottest',
      build: () => ({
        prompt: 'What is the <em>highest</em> temperature of any planet in the catalogue? Show one number.',
        answer: 'SELECT MAX(temperature_c) FROM planets',
        hints: ['There\'s an aggregate for the biggest value.', 'MAX(temperature_c)', 'SELECT MAX(temperature_c) FROM planets'],
      }),
    },
    {
      id: 'water',
      build: () => ({
        prompt: `Life as we know it needs liquid water, between ${v('0')} and ${v('100')} °C. Show the ${f('name')} and ${f('temperature_c')} of planets in that range.`,
        answer: 'SELECT name, temperature_c FROM planets WHERE temperature_c > 0 AND temperature_c < 100',
        hints: ['You need two conditions on the same field.', 'temperature_c > 0 AND temperature_c < 100', 'SELECT name, temperature_c FROM planets WHERE temperature_c > 0 AND temperature_c < 100'],
      }),
    },
    {
      id: 'avg-size',
      build: rng => {
        const y = rng.pick([2014, 2016, 2018, 2020]);
        return {
          prompt: `Are newer telescopes finding smaller planets? Show the <em>average</em> ${f('size_earths')} of planets found after ${v(y)} (not including ${y}).`,
          answer: `SELECT AVG(size_earths) FROM planets WHERE year_found > ${y}`,
          hints: ['AVG( ) with a WHERE.', `year_found > ${y}`, `SELECT AVG(size_earths) FROM planets WHERE year_found > ${y}`],
        };
      },
    },
    {
      id: 'per-star',
      build: () => ({
        prompt: `Show each ${f('star')} and <em>how many</em> planets orbit it.`,
        answer: 'SELECT star, COUNT(*) FROM planets GROUP BY star',
        hints: ['COUNT(*) with GROUP BY.', 'SELECT star, COUNT(*) …', 'SELECT star, COUNT(*) FROM planets GROUP BY star'],
      }),
    },
    {
      id: 'system',
      build: (rng, ctx) => {
        const s = rng.pick(ctx.stars);
        return {
          prompt: `Show the ${f('name')} and ${f('size_earths')} of the planets around ${v(s)}, <em>biggest first</em>.`,
          answer: `SELECT name, size_earths FROM planets WHERE star = ${sq(s)} ORDER BY size_earths DESC`,
          orderMatters: true,
          hints: ['Filter by star, then sort.', 'ORDER BY size_earths DESC', `SELECT name, size_earths FROM planets WHERE star = '${s}' ORDER BY size_earths DESC`],
        };
      },
    },
    {
      id: 'mission',
      build: rng => {
        const d = rng.pick([50, 100, 150]), s = rng.pick([2, 3]);
        return {
          prompt: `Choose the destination! It must be closer than ${v(d)} light-years, between 0 and 100 °C, and smaller than ${v(s)} Earths
            (so the crew aren't crushed by gravity). Show the ${f('name')} of every planet that fits.`,
          answer: `SELECT name FROM planets WHERE distance_ly < ${d} AND temperature_c > 0 AND temperature_c < 100 AND size_earths < ${s}`,
          hints: ['Four conditions joined with AND.', `distance_ly < ${d}, temperature between 0 and 100, size_earths < ${s}.`, `… WHERE distance_ly < ${d} AND temperature_c > 0 AND temperature_c < 100 AND size_earths < ${s}`],
        };
      },
    },
  ],

  outro: () => `<p>Destination chosen. Mission control is impressed.</p>
    <p class="discuss"><strong>Think about it:</strong> real planet catalogues are full of estimates. If a planet's temperature
    was measured wrongly, your query would still give a confident answer. How could scientists show how sure they are?</p>`,
};

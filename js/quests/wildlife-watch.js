import { f, v, t, sq } from './common.js';

// species, animal_type, habitat, status, typical count, yearly trend
const SPECIES = [
  ['Red squirrel', 'Mammal', 'Woodland', 'endangered', 40, -0.03],
  ['Pine marten', 'Mammal', 'Woodland', 'common', 18, 0.06],
  ['Scottish wildcat', 'Mammal', 'Woodland', 'endangered', 4, -0.08],
  ['Otter', 'Mammal', 'River', 'common', 12, 0.04],
  ['Mountain hare', 'Mammal', 'Moorland', 'declining', 60, -0.07],
  ['Brown hare', 'Mammal', 'Farmland', 'declining', 35, -0.04],
  ['Hedgehog', 'Mammal', 'Farmland', 'declining', 25, -0.06],
  ['Red deer', 'Mammal', 'Moorland', 'common', 140, 0.02],
  ['Capercaillie', 'Bird', 'Woodland', 'endangered', 9, -0.1],
  ['Curlew', 'Bird', 'Farmland', 'declining', 30, -0.08],
  ['Golden eagle', 'Bird', 'Moorland', 'common', 6, 0.05],
  ['Puffin', 'Bird', 'Coast', 'declining', 300, -0.05],
  ['Grey seal', 'Mammal', 'Coast', 'common', 90, 0.03],
  ['Atlantic salmon', 'Fish', 'River', 'declining', 70, -0.06],
  ['Freshwater pearl mussel', 'Invertebrate', 'River', 'endangered', 150, -0.04],
  ['Great yellow bumblebee', 'Invertebrate', 'Farmland', 'endangered', 20, -0.05],
  ['Great crested newt', 'Amphibian', 'Wetland', 'declining', 15, -0.03],
  ['Grey heron', 'Bird', 'Wetland', 'common', 22, 0.01],
];
const SITES = {
  Woodland: ['Glen Affric', 'Abernethy Forest'],
  River: ['River Spey', 'River Tay'],
  Moorland: ['Cairngorms Plateau', 'Rannoch Moor'],
  Farmland: ['Borders Farms', 'Fife Fields'],
  Coast: ['Isle of May', 'Handa Island'],
  Wetland: ['Insh Marshes', 'Loch Leven'],
};
const YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

export default {
  id: 'wildlife-watch',
  code: 'WILD',
  title: 'Wildlife Watch',
  kind: 'Environment & ethics',
  colour: 'green',
  blurb: 'Eight years of volunteer wildlife surveys across Scotland. Which animals are in trouble — and what should we do?',
  level: 6,

  generate(rng) {
    const rows = [];
    for (const [species, type, habitat, status, base, trend] of SPECIES) {
      for (const site of SITES[habitat]) {
        const siteFactor = 0.6 + rng.next() * 0.8;
        YEARS.forEach((year, i) => {
          if (rng.chance(0.1)) return; // some years weren't surveyed
          const expected = base * siteFactor * (1 + trend) ** i;
          const count = Math.max(0, Math.round(expected * (0.8 + rng.next() * 0.4)));
          rows.push([species, type, habitat, site, year, count, status]);
        });
      }
    }
    return {
      tables: [{
        name: 'sightings',
        columns: [
          { name: 'species', type: 'text' }, { name: 'animal_type', type: 'text' }, { name: 'habitat', type: 'text' },
          { name: 'site', type: 'text' }, { name: 'year', type: 'number' }, { name: 'number_seen', type: 'number' },
          { name: 'status', type: 'text' },
        ],
        rows,
      }],
      ctx: {
        species: SPECIES.map(s => s[0]),
        sites: Object.values(SITES).flat(),
        habitats: Object.keys(SITES),
        types: [...new Set(SPECIES.map(s => s[1]))],
      },
    };
  },

  intro: () => `<p>Every year, volunteers count wildlife at sites across Scotland. The ${t('sightings')} table holds
    one record per species, per site, per year, from 2018 to 2025. ${f('number_seen')} is how many were counted and
    ${f('status')} is <strong>'common'</strong>, <strong>'declining'</strong> or <strong>'endangered'</strong>.</p>
    <p>A government committee must decide where to spend its conservation money. They need your analysis.</p>`,

  questions: [
    {
      id: 'species',
      build: (rng, ctx) => {
        const s = rng.pick(ctx.species);
        return {
          prompt: `Start simple. Show every field for sightings of the ${v(s)}.`,
          answer: `SELECT * FROM sightings WHERE species = ${sq(s)}`,
          hints: ['Filter with WHERE.', `species = '${s}' — spelling and capitals matter inside quotes.`, `SELECT * FROM sightings WHERE species = '${s}'`],
        };
      },
    },
    {
      id: 'site-species',
      build: (rng, ctx) => {
        const s = rng.pick(ctx.sites);
        return {
          prompt: `Which species have been recorded at ${v(s)}? Show each ${f('species')} only <em>once</em>.`,
          answer: `SELECT DISTINCT species FROM sightings WHERE site = ${sq(s)}`,
          hints: ['DISTINCT removes repeats.', 'SELECT DISTINCT species …', `SELECT DISTINCT species FROM sightings WHERE site = '${s}'`],
        };
      },
    },
    {
      id: 'endangered',
      build: () => ({
        prompt: `List the <em>different</em> species with a status of ${v('endangered')}, each one once.`,
        answer: `SELECT DISTINCT species FROM sightings WHERE status = 'endangered'`,
        hints: ['DISTINCT plus a WHERE.', `status = 'endangered'`, `SELECT DISTINCT species FROM sightings WHERE status = 'endangered'`],
      }),
    },
    {
      id: 'type-year',
      build: (rng, ctx) => {
        const type = rng.pick(ctx.types), year = rng.pick([2018, 2025]), n = rng.pick([10, 20, 50]);
        return {
          prompt: `Show the ${f('species')}, ${f('site')} and ${f('number_seen')} for every ${v(type)} sighting in ${v(year)} where <em>more than</em> ${v(n)} were seen.`,
          answer: `SELECT species, site, number_seen FROM sightings WHERE animal_type = ${sq(type)} AND year = ${year} AND number_seen > ${n}`,
          hints: ['Three conditions joined with AND.', `animal_type = '${type}', year = ${year}, number_seen > ${n}`, `SELECT species, site, number_seen FROM sightings WHERE animal_type = '${type}' AND year = ${year} AND number_seen > ${n}`],
        };
      },
    },
    {
      id: 'trend',
      build: (rng, ctx) => {
        const s = rng.pick(ctx.species);
        return {
          prompt: `Is the ${v(s)} doing well? Show each ${f('year')} with the <em>total</em> number seen that year, across all sites, in year order.`,
          answer: `SELECT year, SUM(number_seen) FROM sightings WHERE species = ${sq(s)} GROUP BY year ORDER BY year`,
          orderMatters: true,
          hints: ['WHERE for the species, SUM( ) and GROUP BY for each year, ORDER BY to sort.', `SELECT year, SUM(number_seen) … GROUP BY year ORDER BY year`, `SELECT year, SUM(number_seen) FROM sightings WHERE species = '${s}' GROUP BY year ORDER BY year`],
        };
      },
    },
    {
      id: 'habitat-avg',
      build: () => ({
        prompt: `Show each ${f('habitat')} with the <em>average</em> ${f('number_seen')} per record.`,
        answer: 'SELECT habitat, AVG(number_seen) FROM sightings GROUP BY habitat',
        hints: ['AVG( ) with GROUP BY.', 'SELECT habitat, AVG(number_seen) …', 'SELECT habitat, AVG(number_seen) FROM sightings GROUP BY habitat'],
      }),
    },
    {
      id: 'site-count',
      build: () => ({
        prompt: `Some sites are surveyed more than others. Show each ${f('site')} with <em>how many</em> records it has.`,
        answer: 'SELECT site, COUNT(*) FROM sightings GROUP BY site',
        hints: ['COUNT(*) with GROUP BY.', 'SELECT site, COUNT(*) …', 'SELECT site, COUNT(*) FROM sightings GROUP BY site'],
      }),
    },
    {
      id: 'like',
      build: rng => {
        const w = rng.pick(['hare', 'Red', 'Grey', 'Great']);
        return {
          prompt: `Show the <em>different</em> species with ${v(w)} anywhere in their name, each once.`,
          answer: `SELECT DISTINCT species FROM sightings WHERE species LIKE '%${w}%'`,
          hints: ['LIKE with % on both sides.', `species LIKE '%${w}%'`, `SELECT DISTINCT species FROM sightings WHERE species LIKE '%${w}%'`],
        };
      },
    },
    {
      id: 'max',
      build: (rng, ctx) => {
        const s = rng.pick(ctx.species);
        return {
          prompt: `What's the <em>biggest</em> single count of ${v(s)} ever recorded at one site? Show one number.`,
          answer: `SELECT MAX(number_seen) FROM sightings WHERE species = ${sq(s)}`,
          hints: ['MAX( ) with a WHERE.', `MAX(number_seen), species = '${s}'`, `SELECT MAX(number_seen) FROM sightings WHERE species = '${s}'`],
        };
      },
    },
    {
      id: 'at-risk',
      build: (rng, ctx) => {
        const h = rng.pick(ctx.habitats.filter(x => x !== 'Coast'));
        return {
          prompt: `The committee's big question. For ${v(h)} habitats only, show each ${f('year')} with the <em>total</em> number of
            animals seen that are <em>either</em> 'declining' <em>or</em> 'endangered', in year order.`,
          answer: `SELECT year, SUM(number_seen) FROM sightings WHERE habitat = ${sq(h)} AND (status = 'declining' OR status = 'endangered') GROUP BY year ORDER BY year`,
          orderMatters: true,
          hints: [
            'You need AND, OR and brackets. Without brackets, AND is worked out before OR.',
            `WHERE habitat = '${h}' AND (status = 'declining' OR status = 'endangered')`,
            `SELECT year, SUM(number_seen) FROM sightings WHERE habitat = '${h}' AND (status = 'declining' OR status = 'endangered') GROUP BY year ORDER BY year`,
          ],
        };
      },
    },
  ],

  outro: () => `<p>Your analysis is on the committee's desk. The numbers show which animals are struggling — but they don't say what to do.</p>
    <p class="discuss"><strong>Discuss:</strong> Rewilding means letting land return to nature, which helps animals like the
    capercaillie and wildcat. But that land is often farmland that feeds people and pays wages. Who should decide how land
    is used? And can volunteer counts be trusted enough to make big decisions?</p>`,
};

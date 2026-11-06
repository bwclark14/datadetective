import { f, v, t, sq } from './common.js';

const RIVERS = ['Allan', 'Teith', 'Esk', 'Devon', 'Leven', 'Carron'];
const SITES = ['Mill Bridge', 'Oak Weir', 'Heron Bend', 'Ferry Steps', 'Stone Ford', 'Kelpie Pool'];
const FACTORIES = ['Brightwash Laundry', 'Glenfarm Dairy', 'Northpoint Plastics', 'Riverside Paper', 'Clydeside Dyes', 'Greenacre Fertilisers'];
const LIMIT = 50;

export default {
  id: 'river-watch',
  code: 'RIVER',
  title: 'River Watch',
  kind: 'Environment & ethics',
  colour: 'teal',
  blurb: 'Fish are dying. Use water sensor readings to find the source of the pollution — then decide what should happen.',
  level: 6,

  generate(rng) {
    const river = rng.pick(RIVERS);
    const factories = rng.shuffle(FACTORIES);
    const sites = SITES.map((s, i) => ({ site: s, factory: factories[i] }));
    const polluter = rng.pick(sites);
    const spikeSite = rng.pick(sites.filter(s => s !== polluter));
    const rows = [];
    const usedNitrate = new Set();
    const uniqueNitrate = (lo, hi) => {
      for (;;) { const n = rng.int(lo * 10, hi * 10) / 10; if (!usedNitrate.has(n)) { usedNitrate.add(n); return n; } }
    };
    for (let week = 0; week < 8; week++) {
      const date = `2026-${week < 4 ? '09' : '10'}-${String(1 + (week % 4) * 7).padStart(2, '0')}`;
      const spikeWeek = rng.int(0, 7);
      for (const s of sites) {
        let nitrate;
        if (s === polluter) nitrate = week < 2 ? uniqueNitrate(30, 45) : uniqueNitrate(LIMIT + 4, 92);
        else if (s === spikeSite && week === spikeWeek) nitrate = uniqueNitrate(LIMIT + 1, 58);
        else nitrate = uniqueNitrate(8, 44);
        rows.push([s.site, date, nitrate, rng.int(90, 180) / 10, s.factory]);
      }
    }
    return {
      tables: [{
        name: 'readings',
        columns: [
          { name: 'site', type: 'text' }, { name: 'date', type: 'text' },
          { name: 'nitrate', type: 'number' }, { name: 'temperature', type: 'number' },
          { name: 'nearest_factory', type: 'text' },
        ],
        rows,
      }],
      ctx: { river, polluter: polluter.factory, polluterSite: polluter.site, sites: SITES },
    };
  },

  intro: ctx => `<p>Dead fish have been found in the <strong>River ${ctx.river}</strong>. Volunteers have tested the water
    every week at six sites. Each reading in ${t('readings')} records the <strong>nitrate</strong> level (mg per litre)
    and the nearest factory.</p>
    <p>Nitrate above <strong>${LIMIT}</strong> is harmful to fish. Find out where it's coming from.</p>`,

  questions: [
    {
      id: 'site',
      build: (rng, ctx) => {
        const site = rng.pick(ctx.sites);
        return {
          prompt: `Start with one site. Show every field for readings taken at ${v(site)}.`,
          answer: `SELECT * FROM readings WHERE site = ${sq(site)}`,
          hints: [
            'Use WHERE to keep only one site.',
            `${f('site')} is text, so the value needs quote marks.`,
            `SELECT * FROM readings WHERE site = '${site}'`,
          ],
        };
      },
    },
    {
      id: 'over',
      build: () => ({
        prompt: `Show every field for readings where ${f('nitrate')} is <em>above</em> the safe limit of ${v(LIMIT)}.`,
        answer: `SELECT * FROM readings WHERE nitrate > ${LIMIT}`,
        hints: [
          'You need a comparison in WHERE.',
          'Above means greater than: >',
          `SELECT * FROM readings WHERE nitrate > …`,
        ],
      }),
    },
    {
      id: 'sorted',
      build: () => ({
        prompt: `Show the ${f('site')}, ${f('date')} and ${f('nitrate')} of readings above ${LIMIT}, <em>highest nitrate first</em>.`,
        answer: `SELECT site, date, nitrate FROM readings WHERE nitrate > ${LIMIT} ORDER BY nitrate DESC`,
        orderMatters: true,
        hints: [
          'Same filter as before, then sort.',
          'Highest first means descending: ORDER BY … DESC.',
          `… WHERE nitrate > ${LIMIT} ORDER BY nitrate DESC`,
        ],
      }),
    },
    {
      id: 'max',
      build: () => ({
        prompt: `What is the <em>highest</em> nitrate reading ever recorded on the river? Show just that one number.`,
        answer: `SELECT MAX(nitrate) FROM readings`,
        hints: [
          'There is an aggregate function for the biggest value.',
          'Use MAX( ) with the nitrate field inside.',
          'SELECT MAX(nitrate) FROM readings',
        ],
      }),
    },
    {
      id: 'avg',
      build: () => ({
        prompt: `One high reading could be a fluke. Show each ${f('site')} with its <em>average</em> nitrate level.`,
        answer: `SELECT site, AVG(nitrate) FROM readings GROUP BY site`,
        hints: [
          'You need AVG( ) and GROUP BY.',
          `SELECT the ${f('site')} and AVG(nitrate), then GROUP BY site.`,
          'SELECT site, AVG(nitrate) FROM readings GROUP BY …',
        ],
      }),
    },
    {
      id: 'factory',
      build: () => ({
        prompt: `For each ${f('nearest_factory')}, <em>count</em> how many readings were above ${LIMIT}.`,
        answer: `SELECT nearest_factory, COUNT(*) FROM readings WHERE nitrate > ${LIMIT} GROUP BY nearest_factory`,
        hints: [
          'Filter first with WHERE, then group and count.',
          `SELECT nearest_factory, COUNT(*) … WHERE nitrate > ${LIMIT} GROUP BY …`,
          `SELECT nearest_factory, COUNT(*) FROM readings WHERE nitrate > ${LIMIT} GROUP BY nearest_factory`,
        ],
      }),
    },
  ],

  outro: ctx => `<p>The evidence points to <strong>${ctx.polluter}</strong>, next to ${ctx.polluterSite}: its readings
    jumped above the limit after the first two weeks and stayed there. The one-off high reading somewhere else was a fluke —
    which is why the averages mattered.</p>
    <p class="discuss"><strong>Discuss:</strong> ${ctx.polluter} employs 400 people in the town. Should it be closed, fined,
    or given time to fix the problem? Who should be able to see this data — the council, the factory, the public?
    Should volunteers' data be trusted as much as official readings?</p>`,
};

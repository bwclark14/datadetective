import { f, v, t, sq, uniqueNames } from './common.js';

const HOUSES = ['Arran', 'Bute', 'Iona', 'Skye'];
const YEARS = ['S1', 'S2', 'S3'];
// event, unit, lower is better?, typical range
const EVENTS = [
  ['100m', 'seconds', true, 12.5, 17.5],
  ['200m', 'seconds', true, 26, 36],
  ['800m', 'seconds', true, 140, 210],
  ['Long Jump', 'metres', false, 2.8, 5.2],
  ['High Jump', 'metres', false, 1.0, 1.6],
  ['Shot Put', 'metres', false, 4.5, 10.5],
];
const RUNNING = EVENTS.filter(e => e[2]).map(e => e[0]);

export default {
  id: 'sports-day',
  code: 'SPORT',
  title: 'Sports Day',
  kind: 'Mission',
  colour: 'orange',
  blurb: 'The PE department has the results of every race and jump. Work out the winners — and which house takes the cup.',
  skills: ['WHERE', 'AND', 'OR', 'LIKE', 'DISTINCT', 'MIN', 'MAX', 'AVG', 'COUNT', 'GROUP BY', 'ORDER BY', 'LIMIT'],

  generate(rng) {
    const pupils = {};
    for (const y of YEARS) {
      pupils[y] = uniqueNames(rng, 14).map(name => ({ name, house: rng.pick(HOUSES) }));
    }
    // Make names unique across years too.
    const seen = new Set();
    for (const y of YEARS) pupils[y] = pupils[y].filter(p => !seen.has(p.name) && seen.add(p.name));

    const rows = [];
    const used = new Set();
    for (const [event, , lowerBetter, lo, hi] of EVENTS) {
      for (const y of YEARS) {
        const entrants = rng.sample(pupils[y], 6);
        const results = entrants.map(p => {
          let r;
          do { r = Math.round((lo + rng.next() * (hi - lo)) * 100) / 100; } while (used.has(`${event}:${r}`));
          used.add(`${event}:${r}`);
          return { p, r };
        }).sort((a, b) => (lowerBetter ? a.r - b.r : b.r - a.r));
        results.forEach(({ p, r }, i) => rows.push([p.name, p.house, y, event, r, i + 1]));
      }
    }
    const names = rows.map(r => r[0]);
    const letters = [...new Set(names.map(n => n[0]))];
    return {
      tables: [{
        name: 'results',
        columns: [
          { name: 'name', type: 'text' }, { name: 'house', type: 'text' }, { name: 'year_group', type: 'text' },
          { name: 'event', type: 'text' }, { name: 'result', type: 'number' }, { name: 'position', type: 'number' },
        ],
        rows: rng.shuffle(rows),
      }],
      ctx: { names: [...new Set(names)], letters },
    };
  },

  intro: () => `<p>Sports Day is over and the PE department needs help. Every result is in the ${t('results')} table.</p>
    <p>For races (100m, 200m, 800m), ${f('result')} is a time in <strong>seconds</strong> — lower is better.
    For jumps and Shot Put it's a distance in <strong>metres</strong> — higher is better. ${f('position')} is where the
    pupil finished in their year group (1 = first).</p>`,

  questions: [
    {
      id: 'event',
      build: rng => {
        const e = rng.pick(EVENTS)[0];
        return {
          prompt: `Show every field for all ${v(e)} results.`,
          answer: `SELECT * FROM results WHERE event = ${sq(e)}`,
          hints: ['Filter with WHERE.', `event = '${e}'`, `SELECT * FROM results WHERE event = '${e}'`],
        };
      },
    },
    {
      id: 'pupil',
      build: (rng, ctx) => {
        const n = rng.pick(ctx.names);
        return {
          prompt: `${v(n)}'s parent wants to know how they did. Show the ${f('event')}, ${f('result')} and ${f('position')} for each of their events.`,
          answer: `SELECT event, result, position FROM results WHERE name = ${sq(n)}`,
          hints: ['Filter on the name field.', `name = '${n}'`, `SELECT event, result, position FROM results WHERE name = '${n}'`],
        };
      },
    },
    {
      id: 'winner',
      build: rng => {
        const e = rng.pick(EVENTS)[0], y = rng.pick(YEARS);
        return {
          prompt: `Who won the ${v(y)} ${v(e)}? Show their ${f('name')} and ${f('house')}.`,
          answer: `SELECT name, house FROM results WHERE event = ${sq(e)} AND year_group = ${sq(y)} AND position = 1`,
          hints: ['Three conditions joined with AND.', `The winner has position = 1.`, `SELECT name, house FROM results WHERE event = '${e}' AND year_group = '${y}' AND position = 1`],
        };
      },
    },
    {
      id: 'fastest',
      build: rng => {
        const e = rng.pick(RUNNING);
        return {
          prompt: `What was the <em>fastest</em> ${v(e)} time of the day, in any year group? Show one number.`,
          answer: `SELECT MIN(result) FROM results WHERE event = ${sq(e)}`,
          hints: ['Fastest means the smallest time.', `MIN(result) with event = '${e}'`, `SELECT MIN(result) FROM results WHERE event = '${e}'`],
        };
      },
    },
    {
      id: 'longest',
      build: rng => {
        const y = rng.pick(YEARS);
        return {
          prompt: `What was the <em>longest</em> Long Jump in ${v(y)}? Show one number.`,
          answer: `SELECT MAX(result) FROM results WHERE event = 'Long Jump' AND year_group = ${sq(y)}`,
          hints: ['Longest means the biggest distance.', `MAX(result), event = 'Long Jump' AND year_group = '${y}'`, `SELECT MAX(result) FROM results WHERE event = 'Long Jump' AND year_group = '${y}'`],
        };
      },
    },
    {
      id: 'letter',
      build: (rng, ctx) => {
        const l = rng.pick(ctx.letters);
        return {
          prompt: `The certificates are printed in alphabetical batches. Show the <em>different</em> pupil names that start with ${v(l)}, each once.`,
          answer: `SELECT DISTINCT name FROM results WHERE name LIKE '${l}%'`,
          hints: ['DISTINCT plus LIKE.', `'${l}%' means starts with ${l}, then anything.`, `SELECT DISTINCT name FROM results WHERE name LIKE '${l}%'`],
        };
      },
    },
    {
      id: 'house-wins',
      build: () => ({
        prompt: `The House Cup goes to the house with the most wins. Show each ${f('house')} and how many <em>first places</em> it got.`,
        answer: 'SELECT house, COUNT(*) FROM results WHERE position = 1 GROUP BY house',
        hints: ['Filter for winners, then group and count.', 'WHERE position = 1 GROUP BY house', 'SELECT house, COUNT(*) FROM results WHERE position = 1 GROUP BY house'],
      }),
    },
    {
      id: 'avg-800',
      build: () => ({
        prompt: `Do older pupils run faster? Show each ${f('year_group')} with the <em>average</em> 800m time.`,
        answer: `SELECT year_group, AVG(result) FROM results WHERE event = '800m' GROUP BY year_group`,
        hints: ['AVG( ) with WHERE and GROUP BY.', `WHERE event = '800m' GROUP BY year_group`, `SELECT year_group, AVG(result) FROM results WHERE event = '800m' GROUP BY year_group`],
      }),
    },
    {
      id: 'top3',
      build: rng => {
        const [e, , lowerBetter] = rng.pick(EVENTS);
        const dir = lowerBetter ? 'ASC' : 'DESC';
        return {
          prompt: `Who are the top ${v(3)} in the ${v(e)} across the whole school? Show ${f('name')}, ${f('year_group')} and ${f('result')}, best first.
            (For this event, best means the ${lowerBetter ? 'lowest time' : 'biggest distance'}.)`,
          answer: `SELECT name, year_group, result FROM results WHERE event = ${sq(e)} ORDER BY result ${dir} LIMIT 3`,
          orderMatters: true,
          hints: ['Filter, sort, then LIMIT.', `ORDER BY result ${dir} LIMIT 3`, `SELECT name, year_group, result FROM results WHERE event = '${e}' ORDER BY result ${dir} LIMIT 3`],
        };
      },
    },
    {
      id: 'medals',
      build: rng => {
        const h = rng.pick(HOUSES), y = rng.pick(YEARS);
        return {
          prompt: `${v(h)} house is making a display. Show the ${f('name')}, ${f('event')} and ${f('position')} of every ${v(y)} ${h} pupil who finished
            in the <em>top 3</em> of a <em>running</em> event (100m, 200m or 800m).`,
          answer: `SELECT name, event, position FROM results WHERE house = ${sq(h)} AND year_group = ${sq(y)} AND position <= 3 AND (event = '100m' OR event = '200m' OR event = '800m')`,
          hints: [
            'Use AND for the house, year and position, and OR for the events — inside brackets.',
            `position <= 3 AND (event = '100m' OR event = '200m' OR event = '800m')`,
            `SELECT name, event, position FROM results WHERE house = '${h}' AND year_group = '${y}' AND position <= 3 AND (event = '100m' OR event = '200m' OR event = '800m')`,
          ],
        };
      },
    },
  ],

  outro: () => `<p>Results sorted, certificates printed and the House Cup decided.</p>
    <p class="discuss"><strong>Think about it:</strong> some schools publish sports results online with pupils' names.
    Is that OK? What about publishing who came <em>last</em>?</p>`,
};

import { f, v, t, sq } from './common.js';
import { makeRng } from '../rng.js';

const TITLES = [
  'Pixel Paws', 'Turbo Tartan', 'Moonbase Mayhem', 'Castle Crumble', 'Loch Legends', 'Neon Drift',
  'Puzzle Pier', 'Goal Rush 26', 'Starfall Tactics', 'Jelly Jump', 'Shadow Signal', 'Kingdom of Crows',
  'Quiz Quest', 'Deep Sea Quest', 'Skyline Sprint', 'Robot Rumble', 'Frost Runner', 'Garden Guardians',
  'Hex Heroes', 'Tidal Tactics', 'Midnight Market', 'Cosmic Courier', 'Brick Builders', 'Rally Highlands',
  'Dragon Dash', 'Echo Arena', 'Lantern Lane', 'Mystery Manor', 'Orbit Odyssey', 'Pocket Planets',
  'Quest for Quartz', 'Rocket Racers', 'Snowball Showdown', 'Thunder Track', 'Under the Bridge',
  'Volcano Valley', 'Wild Wheels', 'Xeno Explorers', 'Zombie Zoo', 'Byte Battle',
];
const PLATFORMS = ['Switch', 'PlayStation', 'Xbox', 'PC'];
const GENRES = { Adventure: [7, 12], Racing: [3, 7], Puzzle: [3, 7], Sport: [3, 7], Strategy: [7, 12], Platformer: [3, 7], Shooter: [16, 18], RPG: [12, 16] };
const PRICES = [4.99, 9.99, 12.99, 14.99, 19.99, 24.99, 29.99, 39.99, 49.99, 59.99];

// The shop's stock is the same for everyone; the questions change.
function buildStock() {
  const rng = makeRng(20261106);
  const ratings = rng.sample(Array.from({ length: 50 }, (_, i) => (48 + i) / 10), TITLES.length);
  return TITLES.map((title, i) => {
    const genre = rng.pick(Object.keys(GENRES));
    return [title, PLATFORMS[i % 4], genre, rng.pick(PRICES), ratings[i], rng.pick(GENRES[genre])];
  });
}
const STOCK = buildStock();

export default {
  id: 'game-shop',
  code: 'GAMES',
  title: 'Game Shop',
  kind: 'Mission',
  colour: 'rose',
  blurb: 'You\'ve got a Saturday job at a games shop. Customers have questions — answer them from the stock database.',
  skills: ['WHERE', 'ORDER BY', 'LIMIT', 'COUNT', 'AVG', 'MIN'],

  generate() {
    return {
      tables: [{
        name: 'games',
        columns: [
          { name: 'title', type: 'text' }, { name: 'platform', type: 'text' }, { name: 'genre', type: 'text' },
          { name: 'price', type: 'number' }, { name: 'rating', type: 'number' }, { name: 'age_rating', type: 'number' },
        ],
        rows: STOCK,
      }],
      ctx: {},
    };
  },

  intro: () => `<p>Welcome to your first shift at <strong>Level Up Games</strong>. Every game in stock is in the
    ${t('games')} table. ${f('price')} is in pounds, ${f('rating')} is a review score out of 10,
    and ${f('age_rating')} is the PEGI age.</p><p>Customers are queuing — let's help them.</p>`,

  questions: [
    {
      id: 'platform',
      build: rng => {
        const p = rng.pick(PLATFORMS);
        return {
          prompt: `"What have you got for ${v(p)}?" Show every field for all ${p} games.`,
          answer: `SELECT * FROM games WHERE platform = ${sq(p)}`,
          hints: ['Filter with WHERE.', `Compare ${f('platform')} with '${p}' — with quotes.`, `SELECT * FROM games WHERE platform = '${p}'`],
        };
      },
    },
    {
      id: 'budget',
      build: rng => {
        const p = rng.pick(PLATFORMS), n = rng.pick([15, 20, 25, 30]);
        return {
          prompt: `"I've got £${n} to spend on a ${p} game." Show the ${f('title')} and ${f('price')} of ${v(p)} games that cost <em>less than</em> ${v(`£${n}`)}.`,
          answer: `SELECT title, price FROM games WHERE platform = ${sq(p)} AND price < ${n}`,
          hints: ['Two conditions joined with AND.', `Prices are numbers — no £ sign and no quotes: price < ${n}.`, `SELECT title, price FROM games WHERE platform = '${p}' AND price < ${n}`],
        };
      },
    },
    {
      id: 'top',
      build: rng => {
        const k = rng.int(3, 5);
        return {
          prompt: `"What are your best games?" Show the ${f('title')} and ${f('rating')} of the top ${v(k)} rated games, best first.`,
          answer: `SELECT title, rating FROM games ORDER BY rating DESC LIMIT ${k}`,
          orderMatters: true,
          hints: ['Sort, then cut the list short.', `ORDER BY rating DESC puts the best first. LIMIT ${k} keeps ${k} rows.`, `SELECT title, rating FROM games ORDER BY rating DESC LIMIT ${k}`],
        };
      },
    },
    {
      id: 'per-platform',
      build: () => ({
        prompt: `The manager wants a stock check. Show each ${f('platform')} and <em>how many</em> games there are for it.`,
        answer: 'SELECT platform, COUNT(*) FROM games GROUP BY platform',
        hints: ['Counting per group needs COUNT(*) and GROUP BY.', 'SELECT platform, COUNT(*) …', 'SELECT platform, COUNT(*) FROM games GROUP BY platform'],
      }),
    },
    {
      id: 'avg-age',
      build: rng => {
        const r = rng.pick([3, 7, 12, 16]);
        return {
          prompt: `"How much do PEGI ${r} games usually cost?" Show the <em>average</em> price of games with an ${f('age_rating')} of ${v(r)}.`,
          answer: `SELECT AVG(price) FROM games WHERE age_rating = ${r}`,
          hints: ['Use AVG( ) with a WHERE.', `AVG(price), and age_rating = ${r}.`, `SELECT AVG(price) FROM games WHERE age_rating = ${r}`],
        };
      },
    },
    {
      id: 'cheapest',
      build: rng => {
        const g = rng.pick(Object.keys(GENRES));
        return {
          prompt: `"What's the cheapest ${g} game you sell?" Show just the <em>lowest</em> ${f('price')} of a ${v(g)} game.`,
          answer: `SELECT MIN(price) FROM games WHERE genre = ${sq(g)}`,
          check: res => res.rows[0][0] !== null,
          hints: ['There\'s an aggregate for the smallest value.', `MIN(price) with genre = '${g}'.`, `SELECT MIN(price) FROM games WHERE genre = '${g}'`],
        };
      },
    },
  ],

  outro: () => `<p>Shift over — every customer served.</p>
    <p class="discuss"><strong>Think about it:</strong> online shops use queries like these to choose what to show you first.
    If a shop sorted by <em>profit</em> instead of <em>rating</em>, would customers know?</p>`,
};

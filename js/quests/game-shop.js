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
  level: 3,

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
          prompt: `"I've got £${n} to spend on a ${p} game." Show the ${f('title')} and ${f('price')} of ${v(p)} games under ${v(`£${n}`)}, cheapest first.
            Games with the same price should be in alphabetical order.`,
          answer: `SELECT title, price FROM games WHERE platform = ${sq(p)} AND price < ${n} ORDER BY price, title`,
          orderMatters: true,
          hints: ['Two conditions joined with AND, then sort by two fields.', `Prices are numbers — no £ sign and no quotes. ORDER BY price, title.`, `SELECT title, price FROM games WHERE platform = '${p}' AND price < ${n} ORDER BY price, title`],
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
          hints: ['Sort the best to the top, then cut the list short with LIMIT.', `ORDER BY rating DESC puts the best first. LIMIT ${k} keeps only ${k} rows.`, `SELECT title, rating FROM games ORDER BY rating DESC LIMIT ${k}`],
        };
      },
    },
    {
      id: 'cheapest-genre',
      build: rng => {
        const g = rng.pick(Object.keys(GENRES));
        return {
          prompt: `"Show me your 3 cheapest ${g} games." Show the ${f('title')} and ${f('price')} of the 3 cheapest ${v(g)} games.
            If prices are the same, use alphabetical order.`,
          answer: `SELECT title, price FROM games WHERE genre = ${sq(g)} ORDER BY price, title LIMIT 3`,
          orderMatters: true,
          check: res => res.rows.length === 3,
          hints: ['WHERE, then ORDER BY, then LIMIT — in that order.', 'Cheapest first is ascending. Sort by price, then title.', `SELECT title, price FROM games WHERE genre = '${g}' ORDER BY price, title LIMIT 3`],
        };
      },
    },
    {
      id: 'best-for-age',
      build: rng => {
        const r = rng.pick([7, 12, 16]);
        return {
          prompt: `"I'm buying for someone who can play PEGI ${r} games or younger. What's the single best one?" Show just the ${f('title')} of the highest-rated game with an ${f('age_rating')} of ${v(r)} or less.`,
          answer: `SELECT title FROM games WHERE age_rating <= ${r} ORDER BY rating DESC LIMIT 1`,
          orderMatters: true,
          hints: ['"or less" means <=. Then sort and keep one row.', 'ORDER BY rating DESC LIMIT 1 gives the single best.', `SELECT title FROM games WHERE age_rating <= ${r} ORDER BY rating DESC LIMIT 1`],
        };
      },
    },
    {
      id: 'value',
      build: rng => {
        const n = rng.pick([15, 20, 25]), k = rng.pick([3, 4, 5]);
        return {
          prompt: `The manager wants a "Great value" shelf. Show the ${f('title')}, ${f('platform')} and ${f('rating')} of the ${v(k)} best-rated games costing <em>less than</em> ${v(`£${n}`)}.`,
          answer: `SELECT title, platform, rating FROM games WHERE price < ${n} ORDER BY rating DESC LIMIT ${k}`,
          orderMatters: true,
          check: res => res.rows.length === k,
          hints: ['Filter by price, sort by rating, then LIMIT.', `WHERE price < ${n} ORDER BY rating DESC LIMIT ${k}`, `SELECT title, platform, rating FROM games WHERE price < ${n} ORDER BY rating DESC LIMIT ${k}`],
        };
      },
    },
  ],

  outro: () => `<p>Shift over — every customer served.</p>
    <p class="discuss"><strong>Think about it:</strong> online shops use queries like these to choose what to show you first.
    If a shop sorted by <em>profit</em> instead of <em>rating</em>, would customers know?</p>`,
};

import { f, v, t, sq } from './common.js';
import { makeRng } from '../rng.js';

const ARTISTS = {
  'Neon Thistle': 'Pop', 'Lola Grey': 'Pop', 'The Kelpies': 'Rock', 'DJ Ardent': 'Dance', 'Skye Rivers': 'Folk',
  'Paper Lanterns': 'Indie', 'Mo Banks': 'Hip-hop', 'Echo Valley': 'Rock', 'Ruby Fyfe': 'Indie', 'Static Bloom': 'Dance',
};
const TITLES = [
  'Northern Lights', 'Love on Loop', 'Midnight Ferry', 'Paper Heart', 'Glasgow Rain', 'Tidal Love', 'Night Bus Home',
  'Golden Hour', 'Static', 'Lighthouse', 'Heartbeat Avenue', 'Run the Night', 'Wildfire', 'Summer in Arran',
  'Love Letters', 'Daylight Robbery', 'Satellite', 'Neon Night', 'Highland Echo', 'Borrowed Time', 'Kites',
  'Heart of Stone', 'Last Train', 'Starlight Drive', 'Thunder Road', 'Velvet', 'Bright Side', 'After the Storm',
  'Electric Love', 'Moonlight Mile', 'Signal Fire', 'Late Night Call', 'Halfway Home', 'Dreamer', 'Second Light',
  'Gravity', 'Long Way Round', 'Heartstrings', 'City Lights', 'Polaroid',
];

function buildChart() {
  const rng = makeRng(31415926);
  const artists = Object.keys(ARTISTS);
  const streams = new Set();
  return TITLES.map((title, i) => {
    const artist = artists[i % artists.length];
    let s;
    do { s = rng.int(120, 9800) * 1000 + rng.int(0, 999); } while (streams.has(s));
    streams.add(s);
    const genre = rng.chance(0.85) ? ARTISTS[artist] : rng.pick(Object.values(ARTISTS));
    return [title, artist, genre, rng.int(2021, 2026), s];
  });
}
const SONGS = buildChart();

export default {
  id: 'chart-toppers',
  code: 'CHART',
  title: 'Chart Toppers',
  kind: 'Mission',
  colour: 'pink',
  blurb: 'You\'re a data analyst at a music streaming service. Dig into the numbers behind the hits.',
  level: 2,

  generate() {
    return {
      tables: [{
        name: 'songs',
        columns: [
          { name: 'title', type: 'text' }, { name: 'artist', type: 'text' }, { name: 'genre', type: 'text' },
          { name: 'year', type: 'number' }, { name: 'streams', type: 'number' },
        ],
        rows: SONGS,
      }],
      ctx: { genres: [...new Set(Object.values(ARTISTS))], artists: Object.keys(ARTISTS) },
    };
  },

  intro: () => `<p>You've just joined the data team at <strong>Tunely</strong>. The ${t('songs')} table holds every song on
    this year's playlists and how many times it has been streamed.</p><p>The marketing team has some questions.</p>`,

  questions: [
    {
      id: 'genre-year',
      build: (rng, ctx) => {
        const g = rng.pick(ctx.genres), y = rng.int(2021, 2026);
        return {
          prompt: `Show every field for ${v(g)} songs released in ${v(y)}.`,
          answer: `SELECT * FROM songs WHERE genre = ${sq(g)} AND year = ${y}`,
          hints: ['Two conditions joined with AND.', 'genre is text (quotes); year is a number (no quotes).', `SELECT * FROM songs WHERE genre = '${g}' AND year = ${y}`],
        };
      },
    },
    {
      id: 'alphabetical',
      build: rng => {
        const y = rng.pick([2022, 2023, 2024]);
        return {
          prompt: `Show the ${f('title')} and ${f('artist')} of every song released before ${v(y)}, in <em>alphabetical order</em> of title.`,
          answer: `SELECT title, artist FROM songs WHERE year < ${y} ORDER BY title`,
          orderMatters: true,
          hints: ['ORDER BY sorts the results. It goes after WHERE.', 'A to Z is ascending order, which is what ORDER BY does unless you say otherwise.', `SELECT title, artist FROM songs WHERE year < ${y} ORDER BY title`],
        };
      },
    },
    {
      id: 'big-hits',
      build: rng => {
        const m = rng.pick([5, 6, 7]);
        return {
          prompt: `Show the ${f('title')}, ${f('artist')} and ${f('streams')} of songs with more than ${v(`${m} million`)} streams, <em>biggest first</em>.`,
          answer: `SELECT title, artist, streams FROM songs WHERE streams > ${m}000000 ORDER BY streams DESC`,
          orderMatters: true,
          hints: [`${m} million is written ${m}000000 — no commas.`, 'Biggest first is descending: add DESC after the field you sort by.', `SELECT title, artist, streams FROM songs WHERE streams > ${m}000000 ORDER BY streams DESC`],
        };
      },
    },
    {
      id: 'year-sorted',
      build: rng => {
        const y = rng.int(2021, 2026);
        return {
          prompt: `Show the ${f('title')} and ${f('streams')} of songs released in ${v(y)}, <em>least streamed first</em>.`,
          answer: `SELECT title, streams FROM songs WHERE year = ${y} ORDER BY streams`,
          orderMatters: true,
          hints: ['Filter, then sort.', 'Least first is ascending (ASC), the normal order.', `SELECT title, streams FROM songs WHERE year = ${y} ORDER BY streams`],
        };
      },
    },
    {
      id: 'artist',
      build: (rng, ctx) => {
        const a = rng.pick(ctx.artists);
        return {
          prompt: `Show the ${f('title')} and ${f('year')} of every song by ${v(a)}, <em>newest first</em>. If two songs came out in the same year, put them in alphabetical order.`,
          answer: `SELECT title, year FROM songs WHERE artist = ${sq(a)} ORDER BY year DESC, title`,
          orderMatters: true,
          hints: ['You can sort by two fields: the second one only matters when the first is the same.', 'ORDER BY year DESC, then a comma, then title.', `SELECT title, year FROM songs WHERE artist = '${a}' ORDER BY year DESC, title`],
        };
      },
    },
    {
      id: 'word',
      build: rng => {
        const w = rng.pick(['Love', 'Night', 'Light', 'Heart']);
        return {
          prompt: `The marketing team is making a playlist. Show the ${f('title')} and ${f('artist')} of every song with the word ${v(w)} anywhere in its title, in alphabetical order of title.`,
          answer: `SELECT title, artist FROM songs WHERE title LIKE '%${w}%' ORDER BY title`,
          orderMatters: true,
          hints: ['LIKE matches patterns. % means "anything".', `title LIKE '%${w}%' finds ${w} anywhere. Then sort.`, `SELECT title, artist FROM songs WHERE title LIKE '%${w}%' ORDER BY title`],
        };
      },
    },
  ],

  outro: () => `<p>The marketing team has everything it needs.</p>
    <p class="discuss"><strong>Think about it:</strong> streaming services pay artists per stream, and their algorithms decide
    which songs get recommended. Should the algorithm favour songs that are already popular? What happens to new artists if it does?</p>`,
};

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
  skills: ['WHERE', 'ORDER BY', 'LIMIT', 'SUM', 'COUNT', 'GROUP BY', 'LIKE'],

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
      ctx: { genres: [...new Set(Object.values(ARTISTS))] },
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
          hints: ['Two conditions joined with AND.', `genre is text (quotes); year is a number (no quotes).`, `SELECT * FROM songs WHERE genre = '${g}' AND year = ${y}`],
        };
      },
    },
    {
      id: 'top',
      build: rng => {
        const k = rng.int(3, 5);
        return {
          prompt: `Show the ${f('title')}, ${f('artist')} and ${f('streams')} of the top ${v(k)} most-streamed songs, biggest first.`,
          answer: `SELECT title, artist, streams FROM songs ORDER BY streams DESC LIMIT ${k}`,
          orderMatters: true,
          hints: ['Sort, then limit.', `ORDER BY streams DESC LIMIT ${k}`, `SELECT title, artist, streams FROM songs ORDER BY streams DESC LIMIT ${k}`],
        };
      },
    },
    {
      id: 'artist-total',
      build: () => ({
        prompt: `Show each ${f('artist')} with their <em>total</em> number of streams across all their songs.`,
        answer: 'SELECT artist, SUM(streams) FROM songs GROUP BY artist',
        hints: ['Adding up needs SUM( ).', 'SELECT artist, SUM(streams) … GROUP BY artist', 'SELECT artist, SUM(streams) FROM songs GROUP BY artist'],
      }),
    },
    {
      id: 'per-genre',
      build: () => ({
        prompt: `Show each ${f('genre')} and <em>how many</em> songs there are in it.`,
        answer: 'SELECT genre, COUNT(*) FROM songs GROUP BY genre',
        hints: ['COUNT(*) with GROUP BY.', 'SELECT genre, COUNT(*) …', 'SELECT genre, COUNT(*) FROM songs GROUP BY genre'],
      }),
    },
    {
      id: 'year-sorted',
      build: rng => {
        const y = rng.int(2021, 2026);
        return {
          prompt: `Show the ${f('title')} and ${f('streams')} of songs released in ${v(y)}, <em>most streamed first</em>.`,
          answer: `SELECT title, streams FROM songs WHERE year = ${y} ORDER BY streams DESC`,
          orderMatters: true,
          hints: ['Filter, then sort.', 'ORDER BY streams DESC', `SELECT title, streams FROM songs WHERE year = ${y} ORDER BY streams DESC`],
        };
      },
    },
    {
      id: 'word',
      build: rng => {
        const w = rng.pick(['Love', 'Night', 'Light', 'Heart']);
        return {
          prompt: `The marketing team is making a playlist. Show the ${f('title')} and ${f('artist')} of every song with the word ${v(w)} anywhere in its title.`,
          answer: `SELECT title, artist FROM songs WHERE title LIKE '%${w}%'`,
          hints: ['LIKE matches patterns. % means "anything".', `title LIKE '%${w}%' finds ${w} anywhere.`, `SELECT title, artist FROM songs WHERE title LIKE '%${w}%'`],
        };
      },
    },
  ],

  outro: () => `<p>The marketing team has everything it needs.</p>
    <p class="discuss"><strong>Think about it:</strong> streaming services pay artists per stream, and their algorithms decide
    which songs get recommended. Should the algorithm favour songs that are already popular? What happens to new artists if it does?</p>`,
};

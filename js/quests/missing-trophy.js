import { f, v, t, sq, uniqueNames, clock } from './common.js';

const CLUBS = ['Football', 'Hockey', 'Drama', 'Chess', 'Coding', 'Choir', 'Art', 'Badminton'];
const OTHER_ROOMS = ['Library', 'Gym', 'Music Room', 'Lab 2', 'Art Room'];
const YEARS = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'];

export default {
  id: 'missing-trophy',
  code: 'TROPHY',
  title: 'The Missing Trophy',
  kind: 'Detective case',
  colour: 'amber',
  blurb: 'The football trophy has vanished from the school office. Use the visitor log to find out who took it.',
  skills: ['WHERE', 'AND', 'ORDER BY', 'COUNT'],

  generate(rng) {
    const names = uniqueNames(rng, 34);
    const lastSeen = 15 * 60 + rng.int(1, 3) * 5; // 15:05–15:15
    const club = rng.pick(CLUBS);
    const shoe = rng.int(4, 9);
    const otherClub = () => rng.pick(CLUBS.filter(c => c !== club));
    const otherShoe = () => rng.pick([3, 4, 5, 6, 7, 8, 9, 10].filter(s => s !== shoe));
    const usedOfficeTimes = new Set();
    const officeIn = (lo, hi) => {
      for (;;) { const m = rng.int(lo, hi); if (!usedOfficeTimes.has(m)) { usedOfficeTimes.add(m); return m; } }
    };
    const rows = [];
    const add = (room, c, s, tin, tout) => rows.push([
      names[rows.length], rng.pick(YEARS), clock(tin), clock(tout), room, c, s,
    ]);

    // The culprit: in the Office across the time the trophy vanished.
    const cIn = officeIn(lastSeen - 20, lastSeen - 2);
    add('Office', club, shoe, cIn, rng.int(lastSeen + 5, lastSeen + 25));
    const culprit = rows[0][0];

    // Office decoys, each matching some clues but not all.
    for (let k = 0; k < 2; k++) { const i = officeIn(lastSeen - 25, lastSeen + 10); add('Office', club, otherShoe(), i, Math.max(i, lastSeen) + rng.int(3, 20)); }
    for (let k = 0; k < 2; k++) { const i = officeIn(lastSeen - 25, lastSeen + 10); add('Office', otherClub(), shoe, i, Math.max(i, lastSeen) + rng.int(3, 20)); }
    for (let k = 0; k < 2; k++) { const i = officeIn(lastSeen - 45, lastSeen - 20); add('Office', club, shoe, i, rng.int(i + 5, lastSeen)); }
    for (let k = 0; k < 2; k++) { const i = officeIn(lastSeen - 40, lastSeen + 15); add('Office', otherClub(), otherShoe(), i, i + rng.int(5, 30)); }

    // Everyone else, elsewhere in school.
    while (rows.length < names.length) {
      const i = rng.int(14 * 60 + 30, 16 * 60);
      add(rng.pick(OTHER_ROOMS), rng.chance(0.25) ? club : rng.pick(CLUBS), rng.chance(0.25) ? shoe : rng.int(3, 10), i, i + rng.int(5, 40));
    }

    return {
      tables: [{
        name: 'visitors',
        columns: [
          { name: 'name', type: 'text' }, { name: 'year_group', type: 'text' },
          { name: 'time_in', type: 'text' }, { name: 'time_out', type: 'text' },
          { name: 'room', type: 'text' }, { name: 'club', type: 'text' },
          { name: 'shoe_size', type: 'number' },
        ],
        rows: rng.shuffle(rows),
      }],
      ctx: { culprit, club, shoe, lastSeen: clock(lastSeen) },
    };
  },

  intro: ctx => `<p>Monday afternoon. The school football trophy was sitting in its cabinet in the <strong>Office</strong> at
    <strong>${ctx.lastSeen}</strong>. Half an hour later, it was gone.</p>
    <p>The only evidence is the ${t('visitors')} log: everyone who signed in and out of a room after lunch.
    Each question gets you closer. Detective rule: trust the data, not your hunches.</p>`,

  questions: [
    {
      id: 'office',
      build: () => ({
        prompt: `The trophy was kept in the Office. Show <em>every field</em> for everyone who visited the ${v('Office')}.`,
        answer: `SELECT * FROM visitors WHERE room = 'Office'`,
        hints: [
          'You need a WHERE clause to keep only some records.',
          `Compare the ${f('room')} field with the text 'Office'.`,
          `SELECT * FROM visitors WHERE room = …`,
        ],
      }),
    },
    {
      id: 'times',
      build: () => ({
        prompt: `Show the ${f('name')}, ${f('time_in')} and ${f('time_out')} of Office visitors, with the <em>earliest arrival first</em>.`,
        answer: `SELECT name, time_in, time_out FROM visitors WHERE room = 'Office' ORDER BY time_in`,
        orderMatters: true,
        hints: [
          'Choose three fields after SELECT, then sort with ORDER BY.',
          `Sort by ${f('time_in')}. Smallest first is ascending (ASC), which is the default.`,
          `… WHERE room = 'Office' ORDER BY time_in`,
        ],
      }),
    },
    {
      id: 'after',
      build: (rng, ctx) => ({
        prompt: `The trophy was last seen at ${v(ctx.lastSeen)}. Anyone who left the Office <em>before</em> then is in the clear.
          Show the ${f('name')} of Office visitors who left <em>after</em> ${ctx.lastSeen}.`,
        answer: `SELECT name FROM visitors WHERE room = 'Office' AND time_out > ${sq(ctx.lastSeen)}`,
        hints: [
          'You need two conditions joined with AND.',
          `Times are stored as text like '15:20', so put the time in quotes: time_out > '${ctx.lastSeen}'.`,
          `SELECT name FROM visitors WHERE room = 'Office' AND time_out > …`,
        ],
      }),
    },
    {
      id: 'club',
      build: (rng, ctx) => ({
        prompt: `A witness saw someone leave with a ${v(ctx.club)} kit bag. <em>How many</em> Office visitors are in the ${ctx.club} club?`,
        answer: `SELECT COUNT(*) FROM visitors WHERE room = 'Office' AND club = ${sq(ctx.club)}`,
        hints: [
          'Counting needs COUNT(*) in the SELECT part.',
          `Two conditions: the ${f('room')} and the ${f('club')}.`,
          `SELECT COUNT(*) FROM visitors WHERE room = 'Office' AND club = …`,
        ],
      }),
    },
    {
      id: 'shoe',
      build: (rng, ctx) => ({
        prompt: `There are muddy footprints by the cabinet — size ${v(ctx.shoe)}. Show the ${f('name')} and ${f('room')} of <em>everyone</em> in the log with size ${ctx.shoe} shoes.`,
        answer: `SELECT name, room FROM visitors WHERE shoe_size = ${ctx.shoe}`,
        hints: [
          'This time, don\'t filter by room — the question says everyone.',
          `${f('shoe_size')} is a number, so no quotes are needed.`,
          `SELECT name, room FROM visitors WHERE shoe_size = …`,
        ],
      }),
    },
    {
      id: 'accuse',
      build: (rng, ctx) => ({
        prompt: `Put <em>all</em> the clues together: visited the Office, left after ${ctx.lastSeen}, in the ${ctx.club} club and wears size ${ctx.shoe} shoes.
          Show only the ${f('name')} of the thief.`,
        answer: `SELECT name FROM visitors WHERE room = 'Office' AND time_out > ${sq(ctx.lastSeen)} AND club = ${sq(ctx.club)} AND shoe_size = ${ctx.shoe}`,
        check: res => res.rows.length === 1,
        hints: [
          'Join four conditions with AND.',
          `You need ${f('room')}, ${f('time_out')}, ${f('club')} and ${f('shoe_size')} in your WHERE.`,
          `… WHERE room = 'Office' AND time_out > '${ctx.lastSeen}' AND club = '${ctx.club}' AND …`,
        ],
      }),
    },
  ],

  outro: ctx => `<p>Case closed: <strong>${ctx.culprit}</strong> was the only person who matched every clue.</p>
    <p class="discuss"><strong>Think about it:</strong> several people matched <em>some</em> of the clues.
    What could go wrong if a detective — or a computer system — accused someone after checking only one clue?</p>`,
};

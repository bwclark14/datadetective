import { f, v, t, sq, FIRST_NAMES, SURNAMES, clock } from './common.js';

const STAFF = ['mrs.patel', 'mr.reid', 'ms.okafor', 'dr.chen', 'mr.fraser'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DEVICES = ['LIB-01', 'LIB-02', 'LIB-03', 'LIB-04', 'LIB-05', 'LAB-01', 'LAB-02', 'LAB-03', 'LAB-04', 'STAFF-01'];

export default {
  id: 'phantom-login',
  code: 'LOGIN',
  title: 'The Phantom Login',
  kind: 'Cyber detective case',
  colour: 'violet',
  blurb: 'Someone has been trying to break into a teacher\'s account. Trace the attempts through the network log.',
  level: 4,

  generate(rng) {
    const target = rng.pick(STAFF);
    const pupils = [...new Set(Array.from({ length: 30 }, () =>
      `${rng.pick(FIRST_NAMES).toLowerCase()}.${rng.pick(SURNAMES)[0].toLowerCase()}`))].slice(0, 22);
    const culprit = pupils[0];
    const attackDay = rng.pick(DAYS);
    const attackDevice = rng.pick(DEVICES.filter(d => d.startsWith('LIB')));
    const attackStart = 12 * 60 + rng.int(15, 35);
    const rows = [];
    const add = (u, d, day, m, ok) => rows.push([u, d, day, clock(m), ok ? 'yes' : 'no']);

    // The culprit signs in as themselves, then tries the teacher's password over and over.
    add(culprit, attackDevice, attackDay, attackStart - rng.int(3, 9), true);
    const attackTimes = rng.sample(Array.from({ length: 16 }, (_, k) => attackStart + k), rng.int(7, 11)).sort((a, b) => a - b);
    for (const m of attackTimes) add(target, attackDevice, attackDay, m, false);
    // A couple of earlier tries on other days.
    for (const day of rng.sample(DAYS.filter(d => d !== attackDay), 2)) add(target, attackDevice, day, 12 * 60 + rng.int(15, 45), false);
    // The teacher mistyping their own password at their own desk.
    add(target, 'STAFF-01', rng.pick(DAYS), 8 * 60 + rng.int(20, 50), false);
    add(target, rng.pick(['LAB-01', 'LAB-02']), rng.pick(DAYS), 9 * 60 + rng.int(0, 50), false);

    // Ordinary traffic.
    const failsPerDevice = {};
    while (rows.length < 95) {
      const isStaff = rng.chance(0.2);
      const user = isStaff ? rng.pick(STAFF) : rng.pick(pupils.slice(1));
      const device = isStaff ? rng.pick(['STAFF-01', ...DEVICES]) : rng.pick(DEVICES.filter(d => d !== 'STAFF-01'));
      const day = rng.pick(DAYS);
      const m = rng.int(8 * 60 + 30, 15 * 60 + 30);
      let ok = rng.chance(0.9);
      if (!ok && (failsPerDevice[device] || 0) >= 2) ok = true;
      if (!ok && user === target) ok = true;
      // Keep the evidence clean: nobody else signs into the attack device that lunchtime before the attack.
      if (device === attackDevice && day === attackDay && m < attackStart + 20) continue;
      if (!ok) failsPerDevice[device] = (failsPerDevice[device] || 0) + 1;
      add(user, device, day, m, ok);
    }
    rows.sort((a, b) => DAYS.indexOf(a[2]) - DAYS.indexOf(b[2]) || a[3].localeCompare(b[3]));
    return {
      tables: [{
        name: 'logins',
        columns: [
          { name: 'username', type: 'text' }, { name: 'device', type: 'text' },
          { name: 'day', type: 'text' }, { name: 'time', type: 'text' }, { name: 'success', type: 'text' },
        ],
        rows,
      }],
      ctx: { target, culprit, attackDay, attackDevice, attackStart: clock(attackStart) },
    };
  },

  intro: ctx => `<p>The IT technician has spotted something worrying: someone has been trying to log in to
    <strong>${ctx.target}</strong>'s account without permission.</p>
    <p>The ${t('logins')} table records every login attempt on the school network last week. ${f('success')} is
    <strong>'yes'</strong> or <strong>'no'</strong>.</p>`,

  questions: [
    {
      id: 'target',
      build: (rng, ctx) => ({
        prompt: `Show every field for login attempts using the username ${v(ctx.target)}.`,
        answer: `SELECT * FROM logins WHERE username = ${sq(ctx.target)}`,
        hints: [
          `Filter on the ${f('username')} field.`,
          'Usernames are text — use quote marks.',
          `SELECT * FROM logins WHERE username = '${ctx.target}'`,
        ],
      }),
    },
    {
      id: 'day-fails',
      build: rng => {
        const day = rng.pick(DAYS);
        return {
          prompt: `Show the ${f('username')}, ${f('device')} and ${f('time')} of every <em>failed</em> login on ${v(day)}, in time order.`,
          answer: `SELECT username, device, time FROM logins WHERE success = 'no' AND day = ${sq(day)} ORDER BY time`,
          orderMatters: true,
          check: res => res.rows.length > 1 && new Set(res.rows.map(r => r[2])).size === res.rows.length,
          hints: [
            `Failed means ${f('success')} = 'no'. Join two conditions with AND.`,
            'Times are written like 12:30, so sorting them puts them in time order.',
            `SELECT username, device, time FROM logins WHERE success = 'no' AND day = '${day}' ORDER BY time`,
          ],
        };
      },
    },
    {
      id: 'first-tries',
      build: (rng, ctx) => ({
        prompt: `When did the attack start? Show the ${f('device')} and ${f('time')} of the <em>first 3</em> failed logins on ${ctx.target}'s account on ${v(ctx.attackDay)}.`,
        answer: `SELECT device, time FROM logins WHERE username = ${sq(ctx.target)} AND success = 'no' AND day = ${sq(ctx.attackDay)} ORDER BY time LIMIT 3`,
        orderMatters: true,
        hints: [
          'Three conditions, then sort by time and keep 3 rows.',
          'ORDER BY time LIMIT 3 gives the earliest three.',
          `… WHERE username = '${ctx.target}' AND success = 'no' AND day = '${ctx.attackDay}' ORDER BY time LIMIT 3`,
        ],
      }),
    },
    {
      id: 'fail-devices',
      build: () => ({
        prompt: `Which devices had <em>any</em> failed login this week? Show each ${f('device')} only <em>once</em>.`,
        answer: `SELECT DISTINCT device FROM logins WHERE success = 'no'`,
        hints: [
          'Without help, a device appears once for every failed login. DISTINCT removes repeats.',
          'DISTINCT goes straight after SELECT: SELECT DISTINCT device …',
          `SELECT DISTINCT device FROM logins WHERE success = 'no'`,
        ],
      }),
    },
    {
      id: 'target-devices',
      build: (rng, ctx) => ({
        prompt: `Show a list of the <em>different</em> devices used for failed logins on ${ctx.target}'s account, in alphabetical order.`,
        answer: `SELECT DISTINCT device FROM logins WHERE username = ${sq(ctx.target)} AND success = 'no' ORDER BY device`,
        orderMatters: true,
        hints: [
          'DISTINCT removes repeats; ORDER BY sorts.',
          `SELECT DISTINCT device … ORDER BY device`,
          `SELECT DISTINCT device FROM logins WHERE username = '${ctx.target}' AND success = 'no' ORDER BY device`,
        ],
      }),
    },
    {
      id: 'device-users',
      build: (rng, ctx) => ({
        prompt: `Who has used ${v(ctx.attackDevice)} this week? Show each ${f('username')} once.`,
        answer: `SELECT DISTINCT username FROM logins WHERE device = ${sq(ctx.attackDevice)}`,
        hints: [
          'DISTINCT again, with a WHERE on the device.',
          `SELECT DISTINCT username … WHERE device = '${ctx.attackDevice}'`,
          `SELECT DISTINCT username FROM logins WHERE device = '${ctx.attackDevice}'`,
        ],
      }),
    },
    {
      id: 'culprit',
      build: (rng, ctx) => ({
        prompt: `The attack on ${ctx.attackDay} came from ${v(ctx.attackDevice)} and started at ${v(ctx.attackStart)}.
          Who <em>successfully</em> logged in on that device that day <em>before</em> ${ctx.attackStart}? Show the ${f('username')} only.`,
        answer: `SELECT username FROM logins WHERE device = ${sq(ctx.attackDevice)} AND day = ${sq(ctx.attackDay)} AND success = 'yes' AND time < ${sq(ctx.attackStart)}`,
        check: res => res.rows.length === 1,
        hints: [
          'Four conditions joined with AND.',
          `Times are text like '12:30' — put them in quotes and use <.`,
          `… WHERE device = '${ctx.attackDevice}' AND day = '${ctx.attackDay}' AND success = 'yes' AND time < '${ctx.attackStart}'`,
        ],
      }),
    },
  ],

  outro: ctx => `<p>The trail leads to <strong>${ctx.culprit}</strong>, who logged in on ${ctx.attackDevice}
    just minutes before the attack began. Good detective work — but a login log isn't proof on its own.
    Someone could have used a computer that ${ctx.culprit} forgot to log out of.</p>
    <p class="discuss"><strong>Discuss:</strong> Schools record every login, and often every website visited.
    Is that fair? Who should be allowed to read these logs, and how long should they be kept?
    What does the Computer Misuse Act say about trying to get into someone else's account?</p>`,
};

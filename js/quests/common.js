// Shared bits for quest files.

export const f = name => `<code class="q-field">${name}</code>`;
export const v = value => `<strong class="q-value">${value}</strong>`;
export const t = name => `<code class="q-table">${name}</code>`;
export const sq = s => `'${String(s).replace(/'/g, "''")}'`;

export const FIRST_NAMES = [
  'Amira', 'Ben', 'Caitlin', 'Dev', 'Eilidh', 'Finn', 'Grace', 'Hamza', 'Isla', 'Jack',
  'Kai', 'Lena', 'Lewis', 'Maya', 'Noah', 'Orla', 'Priya', 'Quinn', 'Ruby', 'Sami',
  'Tara', 'Umar', 'Violet', 'Will', 'Xander', 'Yasmin', 'Zara', 'Aiden', 'Bella', 'Callum',
  'Daisy', 'Ethan', 'Freya', 'Harris', 'Iona', 'Jamie', 'Kerr', 'Lucy', 'Mohammed', 'Niamh',
  'Oscar', 'Poppy', 'Rory', 'Sophie', 'Theo', 'Ava', 'Logan', 'Ellie', 'Arjun', 'Mei',
];
export const SURNAMES = [
  'Ali', 'Brown', 'Campbell', 'Douglas', 'Evans', 'Fraser', 'Grant', 'Hussain', 'Ireland',
  'Johnston', 'Khan', 'Lindsay', 'MacLeod', 'Murray', 'Nowak', 'Okafor', 'Paterson', 'Reid',
  'Singh', 'Stewart', 'Taylor', 'Wilson', 'Young', 'Chen', 'Patel', 'Ross', 'Kerr', 'Begum',
];

/** n unique "First Surname" names. */
export function uniqueNames(rng, n) {
  const out = new Set();
  while (out.size < n) out.add(`${rng.pick(FIRST_NAMES)} ${rng.pick(SURNAMES)}`);
  return [...out];
}

export const pad2 = n => String(n).padStart(2, '0');
export const clock = minutes => `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;

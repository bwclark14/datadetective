// Data types a pupil can give a column, using the names from Scottish Computing Science.
// Quest tables still use the older 'number' type, which behaves like Real.

export const DATA_TYPES = [
  { id: 'text', label: 'Text', help: 'words, names, codes, phone numbers' },
  { id: 'integer', label: 'Integer', help: 'whole numbers like 7 or -2' },
  { id: 'real', label: 'Real', help: 'numbers with a decimal point like 3.75' },
  { id: 'date', label: 'Date', help: 'stored as YYYY-MM-DD so dates sort in order' },
  { id: 'time', label: 'Time', help: 'stored as HH:MM (24-hour clock)' },
  { id: 'boolean', label: 'Boolean', help: 'TRUE or FALSE (yes/no)' },
];

export const typeLabel = id => DATA_TYPES.find(t => t.id === id)?.label || (id === 'number' ? 'Number' : 'Text');
export const isNumericType = t => t === 'number' || t === 'integer' || t === 'real';

const NUMBER = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;
const TRUE_WORDS = new Set(['true', 'yes', 'y', 't', '1']);
const FALSE_WORDS = new Set(['false', 'no', 'n', 'f', '0']);

function validDate(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
const pad = n => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' from ISO or UK day-first formats (03/11/2026, 3-11-26, 03.11.2026), else null. */
export function parseDate(raw) {
  const s = String(raw).trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ][\d:.]+Z?)?$/.exec(s);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return validDate(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(s);
  if (m) {
    const d = Number(m[1]), mo = Number(m[2]);
    let y = Number(m[3]);
    if (m[3].length === 2) y += y < 70 ? 2000 : 1900;
    return validDate(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }
  return null;
}

/** 'HH:MM' (or 'HH:MM:SS') from 9:05, 09:05:30, 2:30pm, else null. */
export function parseTime(raw) {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]\.?m\.?)?$/i.exec(String(raw).trim());
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]), sec = m[3] === undefined ? null : Number(m[3]);
  if (m[4]) {
    if (h < 1 || h > 12) return null;
    const pm = /^p/i.test(m[4]);
    h = (h % 12) + (pm ? 12 : 0);
  }
  if (h > 23 || min > 59 || (sec !== null && sec > 59)) return null;
  return `${pad(h)}:${pad(min)}${sec === null ? '' : `:${pad(sec)}`}`;
}

/** Convert one cell. Empty cells become null. Returns { ok, value }. */
export function convertValue(raw, type) {
  const s = String(raw ?? '').trim();
  if (s === '') return { ok: true, value: null };
  switch (type) {
    case 'integer': {
      const n = Number(s);
      return NUMBER.test(s) && Number.isInteger(n) ? { ok: true, value: n } : { ok: false, value: null };
    }
    case 'real':
    case 'number':
      return NUMBER.test(s) ? { ok: true, value: Number(s) } : { ok: false, value: null };
    case 'date': {
      const d = parseDate(s);
      return d ? { ok: true, value: d } : { ok: false, value: null };
    }
    case 'time': {
      const t = parseTime(s);
      return t ? { ok: true, value: t } : { ok: false, value: null };
    }
    case 'boolean': {
      const w = s.toLowerCase();
      if (TRUE_WORDS.has(w)) return { ok: true, value: 1 };
      if (FALSE_WORDS.has(w)) return { ok: true, value: 0 };
      return { ok: false, value: null };
    }
    default:
      return { ok: true, value: String(raw) };
  }
}

/** How many non-empty values in a column don't fit a type. */
export function countMisfits(values, type) {
  return values.reduce((n, v) => n + (convertValue(v, type).ok ? 0 : 1), 0);
}

/** Best type for a column of raw text values. */
export function guessType(values) {
  const filled = values.map(v => String(v ?? '').trim()).filter(v => v !== '');
  if (!filled.length) return 'text';
  const fits = type => countMisfits(filled, type) <= filled.length * 0.05;
  const words = filled.map(v => v.toLowerCase());
  if (words.some(w => !['0', '1'].includes(w)) && fits('boolean')) return 'boolean';
  if (fits('date')) return 'date';
  if (fits('time')) return 'time';
  if (filled.some(v => /^-?0\d/.test(v))) return 'text'; // leading zeros: phone numbers, codes
  if (fits('integer')) return 'integer';
  if (fits('real')) return 'real';
  return 'text';
}

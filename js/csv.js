// Reading a pupil's CSV file into a table definition. Everything happens in the browser.

import { isSqlKeyword } from './query-model.js';

export const LIMITS = { bytes: 5 * 1024 * 1024, rows: 20000, columns: 50 };

export function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const counts = { ',': 0, ';': 0, '\t': 0 };
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in counts) counts[ch]++;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][1] > 0
    ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
    : ',';
}

// RFC 4180-style: quoted fields, "" escapes, commas and new lines inside quotes.
export function parseCSV(text, delimiter = detectDelimiter(text)) {
  const s = String(text).replace(/^﻿/, '');
  const records = [];
  let field = '', record = [], inQuotes = false, i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"' && field === '') { inQuotes = true; i++; continue; }
    if (ch === delimiter) { record.push(field); field = ''; i++; continue; }
    if (ch === '\r' || ch === '\n') {
      record.push(field); records.push(record); field = ''; record = [];
      i += (ch === '\r' && s[i + 1] === '\n') ? 2 : 1;
      continue;
    }
    field += ch; i++;
  }
  if (field !== '' || record.length) { record.push(field); records.push(record); }
  const nonEmpty = records.filter(r => !(r.length === 1 && r[0].trim() === ''));
  return { delimiter, headers: nonEmpty[0] || [], rows: nonEmpty.slice(1) };
}

export function isNumberText(v) {
  const t = String(v).trim();
  if (t === '') return false;
  if (/^-?0\d/.test(t)) return false; // leading zeros: phone numbers, codes
  return /^-?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t);
}

export function guessType(values) {
  const filled = values.map(v => String(v ?? '').trim()).filter(v => v !== '');
  if (!filled.length) return 'text';
  if (filled.some(v => /^-?0\d/.test(v))) return 'text';
  const numeric = filled.filter(isNumberText).length;
  return numeric / filled.length >= 0.95 ? 'number' : 'text';
}

export function sanitizeName(raw, fallback = 'column') {
  let n = String(raw ?? '').trim().toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!n) n = fallback;
  if (/^\d/.test(n)) n = `col_${n}`;
  if (isSqlKeyword(n)) n = `${n}_`;
  return n;
}

export function sanitizeNames(headers) {
  const used = new Map();
  return headers.map((h, i) => {
    let n = sanitizeName(h, `column_${i + 1}`);
    if (used.has(n)) {
      let k = used.get(n) + 1;
      while (used.has(`${n}_${k}`)) k++;
      used.set(n, k);
      n = `${n}_${k}`;
    }
    used.set(n, 1);
    return n;
  });
}

export function tableNameFromFile(fileName) {
  return sanitizeName(String(fileName || '').replace(/\.[^.]+$/, ''), 'my_data');
}

/**
 * Prepare a CSV for preview. Returns { ok:false, error } or
 * { ok:true, original, names, types, rows, report }.
 */
export function prepareCSV(text, { bytes } = {}) {
  if ((bytes ?? text.length) > LIMITS.bytes) return { ok: false, error: 'That file is bigger than 5 MB. Try a smaller file, or remove some rows.' };
  if (!String(text).trim()) return { ok: false, error: 'That file is empty.' };
  const { headers, rows } = parseCSV(text);
  if (!headers.length || headers.every(h => !h.trim())) return { ok: false, error: 'The first row should contain column names, but it\'s blank.' };
  if (headers.length > LIMITS.columns) return { ok: false, error: `That file has ${headers.length} columns. The limit is ${LIMITS.columns}.` };
  if (!rows.length) return { ok: false, error: 'The file has column names but no data rows.' };
  if (rows.length > LIMITS.rows) return { ok: false, error: `That file has ${rows.length.toLocaleString()} rows. The limit is ${LIMITS.rows.toLocaleString()}.` };
  if (headers.every(isNumberText)) {
    return { ok: false, error: 'The first row looks like data, not column names. Add a header row (e.g. name,age,score) and try again.' };
  }

  let padded = 0, trimmed = 0;
  const fixed = rows.map(r => {
    if (r.length < headers.length) { padded++; return [...r, ...Array(headers.length - r.length).fill('')]; }
    if (r.length > headers.length) { trimmed++; return r.slice(0, headers.length); }
    return r;
  });
  const names = sanitizeNames(headers);
  const types = headers.map((_, j) => guessType(fixed.map(r => r[j])));
  return { ok: true, original: headers, names, types, rows: fixed, report: { padded, trimmed } };
}

export function buildTable(name, prepared, types = prepared.types) {
  let blanked = 0;
  const rows = prepared.rows.map(r => r.map((v, j) => {
    const t = String(v).trim();
    if (types[j] === 'number') {
      if (t === '') return null;
      if (!isNumberText(t) && !/^-?0\d*\.?\d*$/.test(t)) { blanked++; return null; }
      return Number(t);
    }
    return t === '' ? null : String(v);
  }));
  return {
    def: { name, columns: prepared.names.map((n, j) => ({ name: n, type: types[j] })), rows },
    blanked,
  };
}

export function toCSV(columns, rows) {
  const cell = v => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.map(cell).join(','), ...rows.map(r => r.map(cell).join(','))].join('\r\n');
}

/** Suggested (unmarked) questions based on column types and values. */
export function starterChallenges(def, pick = list => list[0]) {
  const nums = def.columns.filter(c => c.type === 'number');
  const texts = def.columns.filter(c => c.type === 'text');
  const out = [`How many records are in <b>${def.name}</b>?`];
  if (nums.length) {
    const n = pick(nums).name;
    out.push(`What is the highest <b>${n}</b>? And the lowest?`);
    out.push(`What is the average <b>${n}</b>?`);
    out.push(`Show the top 5 records by <b>${n}</b>.`);
  }
  if (texts.length) {
    const groupable = texts.filter(c => {
      const j = def.columns.indexOf(c);
      const distinct = new Set(def.rows.map(r => r[j]).filter(v => v !== null)).size;
      return distinct > 1 && distinct <= Math.max(12, def.rows.length / 4);
    });
    const t = groupable.length ? pick(groupable) : pick(texts);
    const j = def.columns.indexOf(t);
    const sample = def.rows.map(r => r[j]).find(v => v !== null);
    if (sample !== undefined) out.push(`Show every record where <b>${t.name}</b> is '${escapeHtml(sample)}'.`);
    if (groupable.length) {
      out.push(`How many records are there for each <b>${t.name}</b>?`);
      if (nums.length) out.push(`What is the average <b>${pick(nums).name}</b> for each <b>${t.name}</b>?`);
    }
    out.push(`Which <b>${t.name}</b> values start with the letter A? (Try LIKE 'A%')`);
  }
  return out;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

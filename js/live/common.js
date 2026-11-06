// Shared helpers for live data sources.

export const PLACES = [
  { name: 'Aberdeen', lat: 57.15, lon: -2.09 },
  { name: 'Dumfries', lat: 55.07, lon: -3.61 },
  { name: 'Dundee', lat: 56.46, lon: -2.97 },
  { name: 'Edinburgh', lat: 55.95, lon: -3.19 },
  { name: 'Fort William', lat: 56.82, lon: -5.11 },
  { name: 'Glasgow', lat: 55.86, lon: -4.25 },
  { name: 'Inverness', lat: 57.48, lon: -4.22 },
  { name: 'Lerwick', lat: 60.15, lon: -1.15 },
  { name: 'Perth', lat: 56.40, lon: -3.43 },
  { name: 'Stirling', lat: 56.12, lon: -3.94 },
  { name: 'Stornoway', lat: 58.21, lon: -6.39 },
];

export const findPlace = name => PLACES.find(p => p.name === name) || PLACES.find(p => p.name === 'Glasgow');
export const slug = text => String(text).toLowerCase().replace(/\W+/g, '_').replace(/^_|_$/g, '');

export const num = v => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
};

export const round = (v, dp = 1) => (v === null ? null : Math.round(v * 10 ** dp) / 10 ** dp);

// UK local time as "YYYY-MM-DDTHH:MM", matching Open-Meteo's timestamps.
export function localStamp(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Split an ISO/UTC timestamp into ['YYYY-MM-DD', 'HH:MM'] in UTC. */
export function utcParts(value) {
  let text = String(value).trim().replace(' ', 'T');
  if (typeof value !== 'number' && !/(Z|[+-]\d\d:?\d\d)$/.test(text)) text += 'Z'; // no zone given: treat as UTC
  const d = typeof value === 'number' ? new Date(value) : new Date(text);
  if (Number.isNaN(d.getTime())) return [null, null];
  const iso = d.toISOString();
  return [iso.slice(0, 10), iso.slice(11, 16)];
}

export async function getJSON(url, fetchImpl = fetch, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`The service replied with an error (${res.status}).`);
    return await res.json();
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('The service took too long to reply.');
    if (e instanceof TypeError) throw new Error('The service could not be reached. School networks sometimes block it.');
    if (e instanceof SyntaxError) throw new Error('The service sent back something that wasn\'t data.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export function checkOpenMeteo(json) {
  if (!json || json.error) throw new Error(json?.reason || 'The service sent an unexpected reply.');
}

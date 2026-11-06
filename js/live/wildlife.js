// Recent wildlife sightings in Scotland from iNaturalist (verified "research grade" only).
// Only the species, date and a rough location are kept: no usernames, photos or exact spots.
import { num, round, getJSON } from './common.js';

const API = 'https://api.inaturalist.org/v1';
// Scotland's rough outline, used if the place lookup fails.
const BOX = { swlat: '54.6', swlng: '-7.7', nelat: '60.9', nelng: '-0.7' };

const GROUPS = {
  Aves: 'Bird', Mammalia: 'Mammal', Plantae: 'Plant', Fungi: 'Fungus', Insecta: 'Insect', Arachnida: 'Spider',
  Reptilia: 'Reptile', Amphibia: 'Amphibian', Actinopterygii: 'Fish', Mollusca: 'Mollusc', Animalia: 'Other animal',
  Chromista: 'Seaweed and algae', Protozoa: 'Other',
};
const COUNTRY_WORDS = /^(scotland|uk|gb|united kingdom|great britain)$/i;

export function placeLookupUrl() { return `${API}/places/autocomplete?q=Scotland&per_page=10`; }

export function sightingsUrl(placeId) {
  const q = new URLSearchParams({
    quality_grade: 'research', per_page: '200', order: 'desc', order_by: 'observed_on', locale: 'en-GB',
    ...(placeId ? { place_id: String(placeId) } : BOX),
  });
  return `${API}/observations?${q}`;
}

export function findScotland(json) {
  const hit = (json?.results || []).find(p => /^scotland$/i.test(p.name) && (p.admin_level === 10 || p.admin_level === 20 || p.place_type === 12 || /united kingdom|uk/i.test(p.display_name || '')))
    || (json?.results || []).find(p => /^scotland$/i.test(p.name));
  return hit ? hit.id : null;
}

/** "Some Road, Leith, Edinburgh, Scotland, GB" -> "Edinburgh" (the last part that isn't a country). */
export function areaOf(placeGuess) {
  if (!placeGuess) return null;
  const parts = String(placeGuess).split(',').map(s => s.trim()).filter(s => s && !COUNTRY_WORDS.test(s) && !/\d/.test(s));
  return parts.length ? parts[parts.length - 1] : null;
}

export function wildlifeRows(json) {
  if (!json || !Array.isArray(json.results)) throw new Error('The wildlife service sent an unexpected reply.');
  const rows = json.results.filter(o => o.taxon).map(o => {
    let lat = null, lon = null;
    if (Array.isArray(o.geojson?.coordinates)) [lon, lat] = o.geojson.coordinates;
    else if (typeof o.location === 'string') [lat, lon] = o.location.split(',');
    const t = o.taxon;
    return [
      o.observed_on ?? null,
      t.preferred_common_name ? t.preferred_common_name.replace(/^./, c => c.toUpperCase()) : null,
      t.name ?? null,
      GROUPS[t.iconic_taxon_name] || 'Other',
      areaOf(o.place_guess),
      round(num(lat), 1), round(num(lon), 1),
    ];
  });
  return { columns: ['date', 'common_name', 'scientific_name', 'wildlife_group', 'area', 'latitude', 'longitude'], rows };
}

export const wildlife = {
  id: 'wildlife',
  label: 'Wildlife sightings',
  blurb: 'The 200 most recent checked sightings of plants, animals and fungi in Scotland.',
  credit: 'Wildlife sightings shared by iNaturalist.org users',
  example: 'samples/live/wildlife-example.csv',
  types: ['date', 'text', 'text', 'text', 'text', 'real', 'real'],
  about: () => ({
    summary: 'The 200 most recent sightings of wild plants, animals and fungi in Scotland, recorded by members of the public.',
    from: 'iNaturalist, a citizen science project where people upload photos of wildlife. Only "research grade" sightings are included — ones that other people have checked and agreed on.',
    updated: 'All the time, as people add sightings.',
    rows: 'One row for each sighting, newest first.',
    columns: {
      date: 'The day the plant or animal was seen, written YYYY-MM-DD.',
      common_name: 'Its everyday English name, if it has one.',
      scientific_name: 'Its scientific (Latin) name, which is the same in every language.',
      wildlife_group: 'Bird, mammal, plant, fungus, insect, and so on.',
      area: 'The town or area it was seen in.',
      latitude: 'Roughly how far north it was seen (rounded to about 10 km).',
      longitude: 'Roughly how far east or west it was seen (rounded to about 10 km).',
    },
    note: 'To protect people\'s privacy we don\'t include who saw it, and locations are rounded. Sightings depend on where people go and what they notice, so they don\'t show everything that lives in Scotland.',
  }),
  starters: () => [
    'How many sightings are there for each <b>wildlife_group</b>? (GROUP BY)',
    'Show every bird that was seen, with its <b>date</b> and <b>area</b>.',
    'Which <b>area</b> has the most sightings?',
    'Find every sighting with \'red\' anywhere in its <b>common_name</b>.',
    'Show the <b>DISTINCT</b> species seen in the most northern places (<b>latitude</b> &gt; 58).',
  ],
  async fetch({ fetchImpl }) {
    let placeId = null;
    try { placeId = findScotland(await getJSON(placeLookupUrl(), fetchImpl)); } catch { /* use the box instead */ }
    return { ...wildlifeRows(await getJSON(sightingsUrl(placeId), fetchImpl)), name: 'wildlife_scotland' };
  },
};

// All live data sources, in the order they appear on the page.
import { weatherWeek, weatherScotland } from './weather.js';
import { airQuality } from './air.js';
import { rivers } from './rivers.js';
import { electricity } from './electricity.js';
import { earthquakes } from './earthquakes.js';
import { aurora } from './aurora.js';
import { wildlife } from './wildlife.js';
import { findPlace } from './common.js';

export const SOURCE_LIST = [weatherWeek, weatherScotland, airQuality, rivers, electricity, earthquakes, aurora, wildlife];
export const SOURCES = Object.fromEntries(SOURCE_LIST.map(s => [s.id, s]));

/**
 * Fetch a source and return a ready-to-load table:
 * { name, columns, rows, types, starters, about, credit }.
 */
export async function fetchLive(sourceId, { place, fetchImpl = fetch, now = new Date() } = {}) {
  const source = SOURCES[sourceId];
  if (!source) throw new Error(`Unknown data source: ${sourceId}`);
  const placeName = findPlace(place).name;
  const table = await source.fetch({ place: placeName, fetchImpl, now });
  return {
    ...table,
    types: source.types,
    starters: source.starters(placeName),
    about: source.about(placeName),
    credit: source.credit,
  };
}

// Live public data, fetched in the pupil's browser and turned into a table.
// Nothing about the pupil is sent: these are plain requests for public data.
// Each source lives in js/live/; this file gathers them in one place.
export { PLACES, localStamp } from './live/common.js';
export { SOURCES, SOURCE_LIST, fetchLive } from './live/index.js';
export { weatherWeekRows, weatherScotlandRows, weatherWeekUrl, weatherDailyUrl } from './live/weather.js';
export { electricityRows, carbonUrl, CARBON_REGIONS } from './live/electricity.js';
export { airRows, airUrl, aqiBand } from './live/air.js';
export { auroraRows, stormLevel, auroraChance } from './live/aurora.js';
export { earthquakeRows, regionOf } from './live/earthquakes.js';
export { wildlifeRows, areaOf, findScotland, sightingsUrl } from './live/wildlife.js';
export { chooseStations, riverRows, stationListUrl, valuesUrl } from './live/rivers.js';

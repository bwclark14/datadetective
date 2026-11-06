// Which SQL features each quest level allows. Each level adds one idea to the last.

export const LEVELS = [
  { level: 1, adds: null, newLabel: 'SELECT, FROM, WHERE' },
  { level: 2, adds: 'orderBy', newLabel: 'ORDER BY' },
  { level: 3, adds: 'limit', newLabel: 'LIMIT' },
  { level: 4, adds: 'distinct', newLabel: 'DISTINCT' },
  { level: 5, adds: 'functions', newLabel: 'COUNT, MIN, MAX, AVG, SUM' },
  { level: 6, adds: 'groupBy', newLabel: 'GROUP BY' },
];

export const ALL_FEATURES = ['orderBy', 'limit', 'distinct', 'functions', 'groupBy'];

/** The set of extra features (beyond SELECT/FROM/WHERE) a level allows. */
export function featuresFor(level) {
  return new Set(LEVELS.filter(l => l.level <= level && l.adds).map(l => l.adds));
}

/** Plain list of what pupils can use at a level, e.g. "SELECT, FROM, WHERE, ORDER BY". */
export function featureText(level) {
  return LEVELS.filter(l => l.level <= level).map(l => l.newLabel).join(', ');
}

/** Which features a Blocks query uses. */
export function featuresUsed(query) {
  const used = new Set();
  if (query.orderBy.length) used.add('orderBy');
  if (query.limit.length) used.add('limit');
  if (query.select.some(c => c.t === 'distinct')) used.add('distinct');
  if (query.select.some(c => c.t === 'agg')) used.add('functions');
  if (query.groupBy.length) used.add('groupBy');
  return used;
}

# Data Detective

Learn SQL by solving data quests. Pupils build real queries by dragging pieces into place, then move on to typing SQL when they're ready. Written for **Fourth Level Computing Science** (Curriculum for Excellence).

Everything runs in the browser using [sql.js](https://github.com/sql-js/sql.js) (SQLite). No accounts, no server, nothing uploaded.

## What's in it

**Eight quests**, each using a single table, in six levels. Each level adds one new part of SQL, and in Blocks and Tiles pupils only see the pieces their level allows. Questions are filled in with random values every time, and the detective cases pick a new culprit, so pupils can't copy each other's answers.

| Level | Quest | Type | Questions | New |
|---|---|---|---|---|
| 1 | The Missing Trophy | Detective case | 6 | SELECT, FROM, WHERE |
| 1 | Planet Hunters | Mission | 7 | More WHERE: AND, OR, NOT, LIKE |
| 2 | Chart Toppers | Mission | 6 | ORDER BY (including two sort fields) |
| 3 | Game Shop | Mission | 6 | LIMIT |
| 4 | The Phantom Login | Cyber detective case | 7 | DISTINCT |
| 5 | Sports Day | Mission | 10 | COUNT, MIN, MAX, AVG, SUM |
| 6 | River Watch | Environment & ethics | 6 | GROUP BY |
| 6 | Wildlife Watch | Environment & ethics | 10 | Everything |

The ethics quests finish with a discussion prompt.

**Three ways to build a query**, switchable at any time:

- **Blocks** — drag pieces into SELECT / FROM / WHERE / GROUP BY / ORDER BY / LIMIT rows. The structure can't go wrong.
- **Tiles** — drag pieces into one line, in order. Mistakes are possible, which is good practice.
- **Type** — write SQL directly.

Pieces can be dragged with a mouse or finger, tapped then placed, or moved with the keyboard (Enter to pick up, Enter on a row to place, Delete to remove).

**My data** — pupils load their own CSV file, choose a data type for each column (Text, Integer, Real, Date, Time or Boolean — a guess is preselected, and values that don't fit are flagged), then query it with the same editor. UK dates such as 03/11/2026 are stored as 2026-11-03 so they sort correctly, and Boolean columns can be queried with `= TRUE`. Three fictional sample files are included.

**Live data** — also in My data, pupils can fetch real public data straight into a table. Each data set opens with an *About this data* card explaining, in plain English, what it is, where it comes from, how often it changes, what each row is, and what every column means.

| Data set | What it is | Source |
|---|---|---|
| Weather this week | Hourly weather for the last 7 days in a chosen Scottish place | [Open-Meteo](https://open-meteo.com) (CC BY 4.0) |
| Weather around Scotland | Daily weather for the last 14 days in 11 places | Open-Meteo |
| Air quality | Hourly pollution levels and pollen for the last 7 days in a chosen place | Open-Meteo / Copernicus (CC BY 4.0) |
| Scottish rivers | Hourly water levels for the last 7 days on rivers such as the Tay, Clyde and Spey | [SEPA](https://timeseriesdoc.sepa.org.uk) (Open Government Licence) |
| Scotland's electricity | Half-hourly carbon intensity and fuel mix for North and South Scotland | [Carbon Intensity API](https://carbonintensity.org.uk) (CC BY 4.0) |
| Earthquakes this week | Every magnitude 2.5+ earthquake worldwide in the last 7 days | [USGS](https://earthquake.usgs.gov) (public domain) |
| Northern lights watch | The Kp index every 3 hours for the last week, with a rough aurora guide for Scotland | [NOAA SWPC](https://www.swpc.noaa.gov) (public domain) |
| Wildlife sightings | The 200 most recent checked sightings in Scotland; no usernames, rounded locations | [iNaturalist](https://www.inaturalist.org) |

No account or key is needed, and only a request for public data is sent. If a school network blocks a service, pupils are offered a saved example instead (clearly labelled as an example, not real readings). Live data isn't marked — it's for exploring. Each source is one file in `js/live/`.

## For teachers

- **Lock the editing mode** for a lesson by adding `?mode=` to the address: `quest.html?q=river-watch&mode=blocks`. Use `mode=blocks,tiles` to allow two modes.
- **Case codes** such as `RIVER-4821` appear on each quest. Entering one on the home page reopens exactly that case.
- **Marking** compares the pupil's results with a model answer, so any correct query passes (`price < 20` and `20 > price` both work). Wrong answers get a specific nudge, such as "you have 12 rows; the answer has 4".
- **Hints**: three per question. Stars: 3 with no hints, 2 with one, 1 with more. Stars are saved in the browser only.
- **Results card**: at the end of each quest pupils get a card showing every question, the query they answered it with, how many attempts it took and how many hints they used, plus totals. They can add their name, then Share it (phones and tablets), Save picture (a PNG) or Copy as text to paste into Teams or an email. Attempts count each press of Check answer until the question is solved.
- **Phones and tablets**: every page fits small screens. On a phone the drop zones come first and the pieces sit underneath in tabs (Fields, Compare, Logic and so on), with bigger touch targets.

## Running it

It's a static site. Publish with GitHub Pages (Settings → Pages → deploy from the `main` branch), or open it through any local web server, for example `python3 -m http.server`. Opening `index.html` directly from disk won't work, because browsers block modules from `file://` addresses.

## Adding a quest

Create a file in `js/quests/` (copy an existing one) and add it to `js/quests/index.js`. A quest provides:

- `generate(rng)` — returns `{ tables: [...], ctx }`. `tables` is a list, so multi-table quests can be added later.
- `questions` — each has `build(rng, ctx)` returning `{ prompt, answer, hints: [3], orderMatters?, check? }`.
- `intro(ctx)` and `outro(ctx)` — HTML for the briefing and ending.

Give it a `level` (1–6, see `js/levels.js`) and use only that level's features. Then run the tests. They build every question with 200 different seeds and check that each has an answer, that sorted answers have no ties, that every model answer can be built with Blocks, and that no question or hint goes beyond its quest's level.

## Tests

Needs Node 22 or later. No packages to install.

```
npm test                          # logic, marking, CSV, all quests across 200 seeds
node tests/browser/smoke.js out   # drives the pages in headless Chrome and saves screenshots to ./out
```

The browser test swaps the sql.js CDN for a local stand-in running the same SQLite engine, so it works offline.

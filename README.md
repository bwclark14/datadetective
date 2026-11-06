# Data Detective

Learn SQL by solving data quests. Pupils build real queries by dragging pieces into place, then move on to typing SQL when they're ready. Written for **Fourth Level Computing Science** (Curriculum for Excellence).

Everything runs in the browser using [sql.js](https://github.com/sql-js/sql.js) (SQLite). No accounts, no server, nothing uploaded.

## What's in it

**Eight quests**, each using a single table. Questions are filled in with random values every time, and the detective cases pick a new culprit, so pupils can't copy each other's answers.

| Quest | Type | Questions | Covers |
|---|---|---|---|
| The Missing Trophy | Detective case | 6 | WHERE, AND, ORDER BY, COUNT |
| River Watch | Environment & ethics | 6 | WHERE, ORDER BY, MAX, AVG, GROUP BY |
| The Phantom Login | Cyber detective case | 6 | COUNT, GROUP BY, DISTINCT, ORDER BY |
| Game Shop | Mission | 6 | ORDER BY, LIMIT, COUNT, AVG, MIN |
| Planet Hunters | Mission | 7 | AND ranges, MAX, AVG, COUNT, ORDER BY |
| Chart Toppers | Mission | 6 | ORDER BY, LIMIT, SUM, COUNT, GROUP BY, LIKE |
| Wildlife Watch | Environment & ethics | 10 | Everything, including OR with brackets |
| Sports Day | Mission | 10 | Everything, including MIN/MAX and LIKE |

The ethics quests finish with a discussion prompt.

**Three ways to build a query**, switchable at any time:

- **Blocks** — drag pieces into SELECT / FROM / WHERE / GROUP BY / ORDER BY / LIMIT rows. The structure can't go wrong.
- **Tiles** — drag pieces into one line, in order. Mistakes are possible, which is good practice.
- **Type** — write SQL directly.

Pieces can be dragged with a mouse or finger, tapped then placed, or moved with the keyboard (Enter to pick up, Enter on a row to place, Delete to remove).

**My data** — pupils load their own CSV file, check whether each column is a number or text, and query it with the same editor. Three fictional sample files are included.

**Live data** — also in My data, pupils can fetch real public data straight into a table:

- *Weather this week*: hourly readings for the last 7 days in a chosen Scottish place ([Open-Meteo](https://open-meteo.com), CC BY 4.0).
- *Weather around Scotland*: daily readings for the last 14 days in 11 places, from Lerwick to Dumfries (Open-Meteo).
- *Scotland's electricity*: half-hourly carbon intensity and fuel mix for North and South Scotland over the last 2 days ([Carbon Intensity API](https://carbonintensity.org.uk), National Energy System Operator, CC BY 4.0).

Each comes with questions to try. No account or key is needed, and only a request for public data is sent. If a school network blocks a service, pupils are offered a saved example instead (clearly labelled as an example, not real readings). Live data isn't marked — it's for exploring.

## For teachers

- **Lock the editing mode** for a lesson by adding `?mode=` to the address: `quest.html?q=river-watch&mode=blocks`. Use `mode=blocks,tiles` to allow two modes.
- **Case codes** such as `RIVER-4821` appear on each quest. Entering one on the home page reopens exactly that case.
- **Marking** compares the pupil's results with a model answer, so any correct query passes (`price < 20` and `20 > price` both work). Wrong answers get a specific nudge, such as "you have 12 rows; the answer has 4".
- **Hints**: three per question. Stars: 3 with no hints, 2 with one, 1 with more. Stars are saved in the browser only.

## Running it

It's a static site. Publish with GitHub Pages (Settings → Pages → deploy from the `main` branch), or open it through any local web server, for example `python3 -m http.server`. Opening `index.html` directly from disk won't work, because browsers block modules from `file://` addresses.

## Adding a quest

Create a file in `js/quests/` (copy an existing one) and add it to `js/quests/index.js`. A quest provides:

- `generate(rng)` — returns `{ tables: [...], ctx }`. `tables` is a list, so multi-table quests can be added later.
- `questions` — each has `build(rng, ctx)` returning `{ prompt, answer, hints: [3], orderMatters?, check? }`.
- `intro(ctx)` and `outro(ctx)` — HTML for the briefing and ending.

Then run the tests. They build every question with 200 different seeds and check that each has an answer, that sorted answers have no ties, and that every model answer can be built with Blocks.

## Tests

Needs Node 22 or later. No packages to install.

```
npm test                          # logic, marking, CSV, all quests across 200 seeds
node tests/browser/smoke.js out   # drives the pages in headless Chrome and saves screenshots to ./out
```

The browser test swaps the sql.js CDN for a local stand-in running the same SQLite engine, so it works offline.

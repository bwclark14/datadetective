# Data Detective v2 — Design

Date: 2026-11-06
Status: Approved and built (v2)

## 1. Purpose

Data Detective is a browser-based SQL learning tool for **Fourth Level Computing Science** (CfE, roughly S3). Pupils build SQL queries visually, solve randomised data quests, and query their own CSV data. v2 replaces the 2024 demo (one page, click-to-append keywords, 10 fixed challenges marked by exact string match).

### Success criteria

- A pupil with no SQL experience can complete the first question of any quest using Blocks mode without help.
- Two pupils playing the same quest get different questions (and, in detective quests, different culprits).
- A correct query is marked correct however it is written (marking compares results, not text).
- A pupil can load a CSV and run a query against it in under two minutes.
- Works on school Chromebooks, iPads and laptops; mouse, touch and keyboard.
- No data leaves the pupil's device. No accounts, no server.

### What the user specified vs. what was assumed

| Specified by user | Assumed (agreed during design) |
|---|---|
| Visual drag-and-drop SQL editor | Static site, GitHub Pages, sql.js |
| At least 5 quests with random questions; two further quests of 10 questions each | 8 quests: six of ~6 questions, two of 10 |
| CSV upload queried with the visual editor | Marking compares query results |
| Fourth Level learners | Replaces existing code in this repo |
| SQL scope: core + sorting + COUNT/MIN/MAX/AVG + GROUP BY | SUM added (needed for totals in Chart Toppers) |
| Quest mix: detective + themed, ≥1 environmental/ethics | |
| Learner can switch between ways of building statements | |
| Single table per quest for now; multi-table quests may be added later | |

## 2. SQL scope

Supported in all three editor modes:

- `SELECT` field list, `*`, `DISTINCT`
- Aggregates: `COUNT(*)`, `COUNT(field)`, `MIN`, `MAX`, `AVG`, `SUM`
- `FROM` (single table)
- `WHERE` with `=`, `<>`, `<`, `>`, `<=`, `>=`, `LIKE` (with `%` and `_`), `AND`, `OR`, `NOT`, brackets
- `GROUP BY` (one or more fields)
- `ORDER BY` field `ASC`/`DESC` (one or more)
- `LIMIT`

Not in v2: joins, `HAVING`, subqueries, `INSERT/UPDATE/DELETE`, aliases (`AS`) in Blocks mode. Type mode will execute any read-only SQLite `SELECT` the pupil writes; only Blocks/Tiles are limited to the list above. Statements other than `SELECT` are rejected with a friendly message in every mode.

## 3. Architecture

Static site, no build step, plain ES modules. sql.js (SQLite compiled to WebAssembly) loaded from cdnjs, pinned version.

```
index.html              Home: choose a quest or My Data
quest.html              Quest player
mydata.html             CSV upload + free explore
css/
  base.css              Tokens, layout, light/dark
  editor.css            Editor modes, chips, drop zones
js/
  db.js                 sql.js loader; createTable(); run(sql) -> {columns, rows} | {error}
  query-model.js        Query object <-> SQL text; SQL text -> Query (parser for the supported subset)
  editor/
    editor.js           Mode switch, shared state, teacher lock, and the Blocks / Tiles / Type views
    palette.js          The tray of pieces and the value maker
    chips.js            The label-tape piece element
    dnd.js              Pointer/touch drag + tap-to-place + keyboard placement
  quest-engine.js       Seeded RNG, question selection, marking, hints, stars
  marking.js            Result-set comparison and feedback messages
  progress.js           localStorage stars per quest (try/catch, works without storage)
  csv.js                CSV parse, type guessing, name sanitising, table creation
  quests/
    index.js            Registry of quests
    missing-trophy.js
    river-watch.js
    phantom-login.js
    game-shop.js
    planet-hunters.js
    chart-toppers.js
    wildlife-watch.js
    sports-day.js
samples/                Sample CSVs for My Data
tests/                  Node test runner tests (node --test)
```

Each unit has one job and a small interface:

- **db.js** — `init()`, `loadTables(tableDefs)`, `run(sql)`, `reset()`. Knows nothing about quests or UI.
- **query-model.js** — the single source of truth for a query being built. `toSQL(query)`, `parseSQL(text) -> {ok, query} | {ok:false, reason}`. Pure, fully unit-tested.
- **editor/** — renders a query model in one of three modes and emits `change(query or text)`. Does not run SQL.
- **quest-engine.js** — given a quest module and a seed, produces questions; given a pupil result and the model answer, asks marking.js for a verdict.
- **csv.js** — pure parsing + type guessing; returns a table definition consumed by db.js.

## 4. Editor and modes

A three-way switch above the editor: **Blocks · Tiles · Type**. The generated SQL is always visible under Blocks and Tiles.

### Blocks (default)
Fixed clause rows: SELECT, FROM, WHERE, GROUP BY, ORDER BY, LIMIT. GROUP BY / ORDER BY / LIMIT are folded until opened. A chip palette is grouped into Fields, Aggregates, Operators, Logic, Values. Pupils drag chips into a row; dropping is only allowed where it makes sense (e.g. operators only in WHERE). Values are added via a small "+ value" input that creates a text or number chip (quoting handled automatically). Chips can be reordered within a row and dragged out to delete.

### Tiles
A single line. Pupils drag keyword, field, operator and value tiles into any order. Syntax errors are possible; errors from SQLite are translated into friendly messages (e.g. "SQLite expected FROM after the field list").

### Type
Monospace text area with keyword colouring. Run with button or Ctrl/Cmd+Enter.

### Switching
- Blocks → Tiles → Type: always lossless (via `toSQL` and tokenising).
- Type/Tiles → Blocks: `parseSQL`. If it fails (unsupported construct or invalid SQL), show "This query can't be shown as blocks: <reason>" and offer *Stay here* or *Start blocks from scratch*. The pupil's text is never discarded silently.
- **Teacher lock:** `?mode=blocks|tiles|type` hides the switch and fixes the mode. `?mode=blocks,tiles` restricts to a subset.

### Input methods (dnd.js)
- Pointer drag (mouse and touch via Pointer Events).
- Tap-to-place: tap a chip (it highlights), tap a drop zone.
- Keyboard: Tab to a chip, Enter to pick up, Tab to a zone, Enter to drop; Delete removes a placed chip. Live region announces actions.

## 5. Quests

Each quest module exports:

```js
{
  id, title, kind: 'detective' | 'themed', ethics: boolean,
  intro(seedCtx) -> html,
  generateData(rng) -> { tables: [{ name, columns:[{name,type}], rows }] , ctx },
  questions: [ { id, level, build(rng, ctx) -> {
       prompt, answerSQL, orderMatters, hints:[3 strings], expectColumns? } } ],
  outro(ctx) -> html   // includes discussion prompt for ethics quests
}
```

`tables` is an array so multi-table quests can be added later without engine changes. All v2 quests use exactly one table.

### The eight quests

1. **The Missing Trophy** (detective) — table `visitors`: name, year_group, time_in, time_out, room, club, shoe_size. Culprit, time window and clue values randomised; data generated so exactly one person fits all clues. Skills: WHERE, AND/OR, comparisons on times, LIKE.
2. **River Watch** (environmental/ethics) — table `readings`: site, date, nitrate, temperature, nearest_factory. One randomly chosen site/factory is the polluter. Skills: WHERE, AVG, MAX, GROUP BY, ORDER BY. Outro discussion: jobs vs environment; who should see this data.
3. **The Phantom Login** (detective, cyber ethics) — table `logins`: username, device, day, time, success. Target account, attacker device and day randomised. Skills: COUNT, GROUP BY, ORDER BY, LIMIT. Outro discussion: school monitoring and privacy.
4. **Game Shop** (themed) — table `games`: title, platform, genre, price, rating, age_rating. Skills: WHERE, ORDER BY, LIMIT, COUNT, AVG, GROUP BY.
5. **Planet Hunters** (themed) — table `planets`: name, star, distance_ly, temperature_c, size_earths, year_found. Skills: MIN/MAX/AVG, ranges with AND.
6. **Chart Toppers** (themed) — table `songs`: title, artist, genre, year, streams. Skills: GROUP BY, SUM, ORDER BY, LIMIT.
7. **Wildlife Watch** (environmental/ethics, 10 questions) — table `sightings`: species, animal_type, habitat, site, year, number_seen, status. Skills: everything in scope, including DISTINCT, LIKE, SUM/AVG with GROUP BY. Outro discussion: rewilding vs farmland; who decides how land is used.
8. **Sports Day** (themed, 10 questions) — table `results`: name, house, year_group, event, result, position. Skills: everything in scope, including LIKE on names, MIN for fastest times, COUNT/SUM of house points with GROUP BY.

All data is fictional (no real people). Themed quests use a fixed base dataset; question parameters are randomised from values present in the data. Detective quests generate data per seed.

Quests 1–6 have ~6 questions and quests 7–8 have 10, ordered from simple to combined. A play-through presents them in order; each question's parameters come from the seeded RNG. "New case" reseeds.

### Randomness
- Seeded PRNG (mulberry32). Seed shown on screen as a short code (e.g. `RIVER-4821`) so a teacher can ask a pupil to share or replay a specific case.
- Generators only pick parameters that give a non-empty, non-trivial answer (validated by running `answerSQL` at generation time; regenerate up to N times).

## 6. Marking (marking.js)

Run pupil SQL and `answerSQL` against the same data. Compare:

1. **Columns** — compare by count and values, not names (so `COUNT(*)` vs `COUNT(name)` labels don't matter). If the question sets `expectColumns`, the pupil's result must contain those values per row in any column order.
2. **Rows** — as multisets; if `orderMatters`, as sequences.
3. **Values** — numbers compared with tolerance 1e-6 (AVG); text compared exactly.

Feedback, most specific first:
- SQL error → friendly translation of the SQLite message.
- Too many / too few rows → "You have 12 rows; the answer has 4. Check your WHERE."
- Right rows, wrong columns → "Right records — check which fields you SELECTed."
- Right set, wrong order → "Nearly — the question asks for these in order."
- `SELECT *` when specific columns asked → specific hint.

Hints: up to 3 per question, progressively more specific (clause → field → partial query). Stars per question: 3 with no hints, 2 with one, 1 with two or three. Quest stars saved in localStorage (`dd.progress.v1`); everything works if storage is unavailable.

## 7. My Data (CSV)

Flow: choose/drop file or pick a sample → preview first 10 rows with sanitised column names and type badges → pupil can toggle Number/Text per column → name the table (suggested from file name) → Create table → editor opens with that table's chips.

- Parsing: RFC 4180-style (quoted fields, embedded commas/newlines, `""` escapes), BOM stripped, comma or semicolon delimiter auto-detected, CRLF/LF.
- Type guess: a column is Number if ≥95% of non-empty values parse as numbers; values with leading zeros (e.g. `0123`) keep the column as Text.
- Names: lowercase, spaces/punctuation → `_`, leading digit prefixed with `col_`, SQL keywords suffixed with `_`, duplicates numbered. Original → new name shown.
- Limits: 5 MB, 20,000 rows, 50 columns. Friendly messages for empty file, no header, ragged rows (short rows padded with empty, long rows trimmed, count reported), unparseable numbers (stored as NULL, count reported).
- Several files can be loaded as separate tables; one table is queried at a time (table chooser).
- Starter challenges (unmarked) generated from column types: count rows, max/min/avg of a number column, filter by a common text value, group by a low-cardinality text column.
- Export current results as CSV.
- Data lives in memory only; gone when the tab closes. On-screen notes: data stays on this device; don't upload personal data about real people.
- Samples: `class-survey.csv`, `weather.csv`, `football-results.csv` (fictional).

## 8. Look and accessibility

Clean, friendly "case file" visual style suitable for 13–15 year olds; light and dark themes; colour-coded chip families with text labels (never colour alone); minimum 44px touch targets; WCAG AA contrast; works at 360px width (editor stacks vertically on small screens).

## 9. Error handling

- sql.js fails to load (offline/blocked CDN): clear message with retry; no blank page.
- Query errors: never thrown to console only; always shown in the result panel.
- Large results: display capped at 500 rows with a note; marking uses full results.
- Non-SELECT statements: rejected before execution.

## 10. Testing

Node's built-in test runner (`node --test`) with no npm dependencies. Tests that need a database use Node 22's built-in `node:sqlite` (same SQLite engine as sql.js) through the same small `run(sql)` interface as `db.js`, so marking and quest logic are tested against real SQLite:

- `query-model`: toSQL for every clause combination; parseSQL round-trips; unsupported constructs give reasons.
- `csv`: quoting, delimiters, BOM, type guessing, name sanitising, limits.
- `marking`: equal/unequal sets, ordering, numeric tolerance, column-name independence, feedback messages.
- Quests: for each quest, 200 seeds — every question generates, its `answerSQL` runs, returns ≥1 row, and detective quests have exactly one culprit.
- Manual: Chrome at 360px and 1280px, touch drag, keyboard-only pass.

## 11. Delivery

Replaces the current files in `bwclark14/datadetective` on a branch; merged to `main` after review. GitHub Pages serves from `main`. README updated with teacher notes (quest list, `?mode=` lock, privacy).

## 12. Out of scope (v2)

Multi-table quests and joins; teacher dashboard or class results; accounts; saving uploaded data between visits; HAVING/subqueries/data modification.

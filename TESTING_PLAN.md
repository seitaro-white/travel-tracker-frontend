# Testing Plan — Handover

**Audience:** the engineer (Sonnet) implementing the first test suite for this project.
**Author context:** repo owner comes from a Python/backend background; comments and
explanations should lean toward "here's the JS equivalent of the pytest idea you know".

---

## 1. Goal & scope

Stand up a *small, high-value* test suite for this vanilla-JS Leaflet map project.
The project has **no build system and is served as static files** — that must stay true.
Tests are a dev-only concern: adding a `package.json` + `node_modules` for the test
runner is fine, but **the app itself must still run with `http-server -p 8000` and no
build step**.

Prioritise the parts most likely to break and easiest to test (pure data + pure logic).
Do **not** try to unit-test the Leaflet/DOM glue — low value, high effort.

### In scope (this handover)
1. Test tooling setup (Vitest).
2. Unit tests for `fetchGeoJson()` error handling.
3. Data/schema validation tests for the GeoJSON files.
4. A "dead emoji" sanity test (see §5.3 for the important nuance).
5. (Optional, only if time permits) one Playwright E2E smoke test.

### Explicitly OUT of scope
- Mocking the whole Leaflet API to test marker rendering.
- Testing `animateChainedFeatures.js`, overlay panels, or anything DOM/map-coupled.
- CI setup (can be a follow-up).
- Changing any application code. **This is purely additive.** If a test reveals a real
  data bug, write it up in `todo.MD` — do not fix app code as part of this task.

---

## 2. Decisions already made (do not re-litigate)

- **Runner: Vitest**, not Jest. Reason: native ESM support, which matters because this
  project is all ES6 modules (`import`/`export`) with no transpiler. Jest needs extra
  config for ESM; Vitest just works. Vitest API is Jest-compatible (`describe`/`it`/`expect`).
- **E2E (if done): Playwright**, because the repo already uses the Playwright MCP browser
  (see `CLAUDE.md`), so it's a familiar tool here.
- **Test location:** a top-level `tests/` directory. Keep tests out of `src/` so the
  app's served files stay clean.
- **No app code changes.** See §1.

---

## 3. Setup steps

1. `npm init -y` to create `package.json`.
2. `npm install -D vitest`.
3. Add to `package.json`:
   ```json
   "scripts": {
     "test": "vitest run",
     "test:watch": "vitest"
   }
   ```
4. Confirm `node_modules/` is git-ignored (check `.gitignore`; add `node_modules/` if missing).
5. Create `tests/` directory.
6. Verify the runner works end-to-end with one trivial test (`expect(1+1).toBe(2)`)
   before writing the real ones, so any tooling problem is isolated early.

> Note on `package.json` `"type"`: the source uses ESM (`import`/`export`). Vitest handles
> ESM regardless, but if Node complains about module type when importing `geojsonService.js`,
> add `"type": "module"` to `package.json`. Decide based on what actually errors — don't
> add it pre-emptively if not needed.

---

## 4. Project facts the tests rely on (verified 2026-06-09)

GeoJSON files live in `assets/points/` and `assets/lines/`. Standard GeoJSON shape:
top-level `{ type: "FeatureCollection", features: [...] }`, each feature has
`properties` and `geometry`.

**Required properties per file** (confirmed by inspection):

| File | Required `properties` keys | Notes |
|------|----------------------------|-------|
| `assets/points/photos.geojson` | `filename`, `timestamp` | `description` & `priority` exist but are often `null` — do NOT require them to be non-null |
| `assets/points/places.geojson` | `Title`, `placeList` | `Note`, `Latitude`, `Longitude` also present |
| `assets/points/information.geojson` | `Name`, `Description` | note the **capitalised** keys, unlike photos |

`geometry.coordinates` is `[lng, lat]` (photos sometimes add a 3rd altitude value).
Sanity-check ranges for this trip (mostly Japan): lng roughly 120–145, lat roughly 30–46.
Use **loose** bounds — there are a couple of non-Japan entries (e.g. `placeList`
values `"London Food"`, `"イタリア"`), so don't make geo-bounds tests strict or they'll
false-positive. Geo-bounds tests are optional/nice-to-have, not required.

Emoji map: `src/features/markers/placeEmojis.js` exports `placeEmojis` (object:
Japanese-category-string → emoji). Used in `src/features/markers/placeViewer.js`
`pointToLayerForPlaces()` as `placeEmojis[placeCategory] || '📍'`.

---

## 5. Test specs

### 5.1 `tests/geojsonService.test.js` — unit test `fetchGeoJson()`

Import `fetchGeoJson` from `../src/features/geojson/geojsonService.js`.
`fetch` is a global; mock it with `vi.fn()` (assign `global.fetch = vi.fn()` /
`vi.stubGlobal('fetch', ...)`; restore in `afterEach`). This is the JS equivalent of
`monkeypatch`-ing `requests.get`.

Three cases (the function has exactly three code paths):
1. **Happy path:** `fetch` resolves `{ ok: true, json: async () => ({type:"FeatureCollection",features:[]}) }`
   → returns the parsed object.
2. **Network error:** `fetch` resolves `{ ok: false, statusText: "Not Found" }`
   → `await expect(fetchGeoJson('x')).rejects.toThrow(/Network response was not ok/)`.
3. **Bad JSON:** `fetch` resolves `{ ok: true, json: async () => { throw new Error('bad') } }`
   → rejects with `/Failed to parse JSON/`.

This is the single most "real logic" unit in the codebase; it's the anchor test.

### 5.2 `tests/geojson-schema.test.js` — data validation

Load the three point files. Two viable approaches — **prefer (a)**:

(a) **Read from disk with Node** (`fs.readFileSync` + `JSON.parse`). Simplest, no mocking,
    runs in plain Node. Build absolute paths from the test file location.

(b) Reuse `fetchGeoJson` with a mocked `fetch` — more contrived; skip unless (a) is awkward.

For each file, assert:
- top-level `type === "FeatureCollection"` and `features` is a non-empty array;
- every feature has `geometry.coordinates` as an array of length ≥ 2 with finite numbers;
- every feature's `properties` contains the **required** keys from the §4 table
  (key *present*; for photos do not assert non-null `description`).

Use a data-driven loop (`it.each` / iterate features) so a failure message names the
offending feature. This is your "catch a data-entry typo before it ships" net — very
much in the backend-validation comfort zone.

### 5.3 `tests/placeEmojis.test.js` — emoji sanity (READ THIS NUANCE FIRST)

⚠️ **Do NOT write "every `placeList` value has an emoji".** It will fail by design.
The code intentionally falls back to `📍` via `|| '📍'`, and **most** categories rely on
that fallback — all English lists (`"Niigata"`, `"Admin"`, `"Shikoku"`, …) plus many
Japanese ones (`"駅"` = station, 103 entries; `"定食"`, `"寿司"`, etc.) have no emoji on
purpose. A coverage test would report ~30 "missing" emojis that are all intended.

Instead write the **reverse / dead-data** test, which is genuinely useful:
- Every **key in `placeEmojis`** is used by at least one feature in `places.geojson`
  (catches dead/typo'd emoji entries that will never render).

Optional informational extra (not a hard assertion): compute the set of `placeList`
values with no emoji and `console.log` it, so the owner can eyeball whether any *should*
have had one (`"駅"`/station is a plausible candidate given `"交通"`→🚉 exists). Keep this
as logging, not a failing assertion.

### 5.4 (Optional) `tests/e2e/smoke.spec.js` — Playwright

Only attempt if §5.1–5.3 are green and there's appetite. Setup: `npm i -D @playwright/test`
+ `npx playwright install chromium`. The app needs to be served first
(`http-server -p 8000`) — either start it manually or via Playwright's `webServer` config.

One test, kept deliberately minimal:
- navigate to `http://localhost:8000`;
- assert the Leaflet container renders (`.leaflet-container` is visible);
- assert at least one marker exists (e.g. `.place-marker`, or `.leaflet-marker-icon`);
- assert no uncaught console errors during load.

⚠️ Heed `CLAUDE.md`: the MCP/Playwright browser caches JS between runs — do a fresh
context / hard reload so you're not testing stale files.

---

## 6. Definition of done

- `npm test` runs and passes locally.
- `tests/` contains 5.1, 5.2, 5.3 (5.4 optional, clearly marked if skipped).
- `package.json` has `test` script; `node_modules/` is git-ignored.
- No application source files changed.
- Any *real* data issues discovered (e.g. a feature missing a required key, a dead emoji
  key) are recorded in `todo.MD` for the owner — not silently fixed.
- A one-line note added to `README.MD` on how to run tests (`npm test`).

---

## 7. Suggested order of work

1. §3 setup + trivial sanity test → confirm tooling.
2. §5.1 `fetchGeoJson` (smallest, proves mocking works).
3. §5.2 schema validation (highest practical value).
4. §5.3 emoji sanity (quick, mind the nuance).
5. §5.4 Playwright smoke (optional).
6. §6 wrap-up (README note, todo.MD entries).

# Tests and coverage

## Running the suite

| Command | Purpose |
| --- | --- |
| `npm test` | Vitest: logic and shipped-data checks (4 files, 25 scenarios) |
| `npm run test:e2e` | Playwright: browser integration (8 specs, 28 scenarios) |
| `npm run typecheck` | Check application, tests and configuration types |
| `npm run build` | Check Vite bundling, not browser behaviour of the built site |

Data audits check every record but register one scenario per dataset or integrity
rule, not one test per row. This is a behavioural inventory, **not** a line/branch
coverage report. No coverage instrumentation or percentage threshold is configured.

PR CI runs typecheck, Vitest, build and E2E. Deployment runs the first three,
not E2E. Playwright tests the **Vite development server**, not `dist/` or the
GitHub Pages project path. In pi-box it connects to Browserless; CI launches
local Chromium. It uses one worker, a fresh browser context per test, and one
configured retry. Use `--retries=0` when validating changes without retry masking.

## Logic and data checks (Vitest)

| File | Cases | Coverage |
| --- | ---: | --- |
| `fetchGeoJson.test.ts` | 3 | Requested path reaches fetch; parsed JSON returns successfully; HTTP and JSON-parsing errors are reported. Uses real `Response` objects, not Leaflet layer construction. |
| `favouritePhotos.test.ts` | 14 | Favourite flags and independently missing filename/geometry/properties; shuffle returns a reordered copy without losing items or mutating input; welcome/favourite loading and no-favourites/missing-welcome cases. |
| `markerDrop.test.ts` | 3 | Empty, single-marker and multiple-marker schedules across 0–1.5 seconds. Concrete expected values, not a copy of the spacing formula. Not random assignment or CSS motion. |
| `dataIntegrity.test.ts` | 5 | Three complete point-dataset audits; nonempty favourites with display images; all explicit emoji mappings correspond to current categories. Soft assertions report multiple invalid records with filenames/indices; asset/mapping failures list all offending names. |

### Data-validation limits

- Point checks cover 1,009 photos, 1,091 places and 28 information records.
  Property keys must exist, but values need not be meaningful. Feature/geometry
  types and longitude/latitude ranges are not fully validated.
- Null geometry remains allowed. The known blank photo at index 748 passes the
  schema checks; new null records would also pass. The data issue is tracked in
  `todo.MD`. Synthetic selection tests verify that unusable photos are excluded
  from favourites, without depending on a particular data index.
- All located point records use strict `Number.isFinite` checks, including
  favourites; there is no separate duplicate favourite-coordinate audit.
- Image existence is checked for favourites, not all photos/thumbnails or
  explicitly the unflagged welcome photo on disk. Intro browser tests load the
  welcome image.
- Line datasets, flight endpoints and animation trigger graphs have no equivalent
  schema validation. Logging-only data audits are not part of the test suite.

## Browser coverage (Playwright)

All specs import `test` and `expect` from `e2e/fixtures.ts`. It substitutes small,
decodable tiles for both OSM and Thunderforest. This exercises Leaflet loading
and provider selection without checking external availability or using quota.

`e2e/mapTestHarness.ts` captures the real Leaflet map, supplies a small subset of
real favourite photos plus the welcome photo, and provides two setup paths:

- `openFinishedMap()` uses the app's existing returning-visitor flag. Carousel,
  About, legend and renderer tests need not replay first-visit flip/landing.
- `stubIntroAnimations()` shortens routes for first-visit card tests. Opening
  tests deliberately keep real routes; the synchronous-completion regression
  uses a zero-distance route.

`dismissIntro()` waits for the first-visit handoff to finish. `waitForAnimations()`
waits for finite motion rather than duplicating CSS durations; it ignores the
intro prompt's intentional infinite wobble. Wait separately for `is-cycling` to
clear when browsing must be settled, since one movement has multiple legs.

| Spec | Scenarios | Coverage |
| --- | ---: | --- |
| `smoke.spec.ts` | 2 | Default OSM container/decoded tile/initial marker, startup JS errors, zoom-20 upscaling from native zoom-19 tiles and attribution; configured Thunderforest selection and attribution. |
| `map-layers.spec.ts` | 1 | Finished map with the full photo dataset and visible clusters; place/info markers at zoom 12; info overlay opens and closes via Escape/backdrop; captured JS errors. Marker opening uses synthetic click dispatch, not pointer hit testing. |
| `animation-completion.spec.ts` | 1 | Zero-distance opening motion can finish synchronously without preventing the intro card from appearing. |
| `opening.spec.ts` | 5 | Live skip during plane and route phases; both captions and normal completion; map click versus drag; dismissal persistence followed by reload without animation requests, and About reopening. |
| `intro-card.spec.ts` | 7 | First-visit flip/input lock, decoded welcome image, landing into one four-card pile and welcome insertion/shuffle; About reopening through three dismissal inputs; collapsed desktop handoff; desktop legend content/hover; real-touch portrait skip/intro/resting-pile handoff and legend toggle; scrollable landscape intro on first visit and reopen. |
| `carousel.spec.ts` | 7 | Unflagged-photo state; bidirectional buttons/rapid input and coarse pile clearance at turnaround; bidirectional drag/cancellation; drag interrupting button motion; reduced motion; matching photo overlay/map fly-to; desktop drawer collapse/reopen and map-click isolation. |
| `carousel-sheet.spec.ts` | 4 | Phone resting size/unobstructed map pan → expanded sheet/controls/browsing; bidirectional swipe isolation from map/sheet; short/long sheet drags and grabber dismissal; photo-overlay dismissal preserves sheet, then map tap closes it. |
| `roughLines.spec.ts` | 1 | Nonempty static paths include rough Bézier output and stay identical on Leaflet's private redraw at the same view. Not a visual check of every route. |

Phone sheet scenarios use a narrow viewport with **mouse gestures**, not touch
emulation. Intro phone/legend/landscape scenarios use touch-enabled contexts and
actual taps. Mouse drag coverage is intentional: native image dragging can cancel
a pointer gesture even when touch works.

### Coverage boundaries

- Chromium only; no screenshot comparison, full keyboard-navigation or
  accessibility audit, or actual touch-drag coverage for the phone sheet.
- Photo overlays open through the carousel, not a photo map marker or cluster.
  Place-marker interaction and cluster expansion are not asserted.
- No explicit checks for points disappearing below zoom 10, flight arcs being
  limited to zoomed-out views, arc endpoints/curvature, or transport line popups.
- Fetch error tests cover the helper's response/parse branches, not app-level
  recovery for missing data/images or failed requests.
- JS-error collection exists in selected scenarios, not as a suite-wide guarantee.
- Exact animation distances, z-index values, inline style lists and legend colour
  strings are deliberately not contracts. Manual review is still needed for
  motion quality, visual styling and colour matching.

These limits are context, not a request to add a test for every untested detail.

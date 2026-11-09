# Banjo Practice

A practice app for a 5-string banjo in three-finger Scruggs style: pick a song, read it as notation with chords and banjo tab, hear it at any tempo and key, and play along. It's a Progressive Web App, installed on an iPad from Safari with **Add to Home Screen**, hosted on GitHub Pages, with no server and no App Store.

## Documents

| File | What it is |
| --- | --- |
| [PLAN.md](PLAN.md) | The original product plan: what the app does |
| [BANJO_STYLE_GUIDE.md](BANJO_STYLE_GUIDE.md) | How Scruggs banjo works: the rules the tab and arranger follow |
| [DEVELOPMENT.md](DEVELOPMENT.md) | The build specification: modules, features, dependencies, phases. **Start here** |
| [CHAOS_TESTING.md](CHAOS_TESTING.md) | The stability test plan |

## Status

Every phase (0–6) is built and runs on **staging**. Production (Dad's URL) still serves the
phase-0 placeholder until the iPad checklist (CHAOS_TESTING.md §7) is done and someone runs
*Promote to production*. Phase details: DEVELOPMENT.md §9.

| Phase | Built | Waiting on people |
| --- | --- | --- |
| 0 · Core and tooling | C1–C5, P1–P8 interfaces and fakes, chaos harness, CI, staging/production deploys, spike S0 | Install on Dad's iPad |
| 1 · Read | Library, favorites, recently played, notation + tab aligned line by line (S2), tab-only view, sizes, settings, diagnostics, session restore, offline; 4 songs | **Check the four draft melodies and tabs**; S3 on the iPad |
| 2 · Play | One-clock scheduler, sampled banjo/guitar/fiddle/flute (S4), boom-chuck chords, metronome and count-in, tempo (±1, hold ±5), speed builder, section loops, key change with capo instruction (C8, C1 transposition), follow highlight + auto-scroll, pedal | S1 (how it sounds), S3 (silent switch, calls, Bluetooth) |
| 2b · Practice modes | Part loops, loop pause, step mode, echo mode, finger strip, beat light, tap tempo, notation in the tab's key | |
| 3 · Arrange | C6 arranger (rolls, half-rolls, licks, slurs, exact search; legal for 10,000 random melodies in CI), arranged tabs for keys that need new shapes, roll exercises (F15), printable tab PDF (F32) | Dad rates two generated arrangements "playable"; weight tuning against his feedback |
| 4 · Chords | C7 voicings (every shape in the style guide, incl. D7 with no 3rd), chord finder with neck diagram and sound, opened from chord taps | |
| 5 · Edit | Song editor (note buttons, chords per half measure, roll overrides explained, live tab, autosaved drafts, ABC view), My songs with trash, export/import backup with preview (all-or-nothing) | Dad enters a full song unaided |
| 6 · Practice | Tuner (YIN, ±3 cents on reference tones, capo-aware targets), practice log with tempo chart, recording alone or with backing (last 20 takes) | S6: tuner on a real banjo; recording on the iPad |

## Getting started

You need **Node.js 24 LTS** (see `.nvmrc`; on Windows `winget install OpenJS.NodeJS.LTS --version 24.22.1`) and access to the public npm registry (`.npmrc` points there).

```sh
git clone https://github.com/idislikejefmac/<repo>.git
cd <repo>
npm ci                 # installs exactly what package-lock.json pins
npx playwright install # browsers for the end-to-end tests
npm run verify         # typecheck, lint, tests, build, production-bundle check
npm run dev            # http://localhost:5173
```

| Script | Does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm test` | Unit + property tests (Vitest, fast-check) |
| `npm run typecheck` / `lint` / `format` / `format:check` | TypeScript, ESLint (incl. the `/src/core` purity rule), Prettier |
| `npm run build` / `preview` | Production build / serve it locally |
| `npm run build:chaos` | Test build with the chaos hooks (`window.__banjoChaos`) |
| `npm run check:prod-bundle` | Fails if chaos/test hooks leaked into `dist/` |
| `npm run e2e` | Playwright smoke tests (Chromium + WebKit) |
| `npm run spike:s0` | Spike S0: which platform features work in each engine |
| `npm run icons` | Regenerate the app icons in `public/` |

## Testing on an iPad from your PC

- `npm run dev -- --host` and open the PC's address on the iPad (same Wi-Fi) for quick looks. Service workers and the microphone need HTTPS, so test those on the deployed staging URL.
- **The Home Screen app and a Safari tab keep separate storage and permissions.** Note which one you tested.

## Deploying

One-time setup on GitHub:
1. Create the repository and push `main`.
2. **Settings → Pages → Source: GitHub Actions.**

Then:
- Every push to `main` deploys **staging** at `https://idislikejefmac.github.io/<repo>/staging/`.
- **Actions → Promote to production → Run workflow** moves the `production` tag and deploys Dad's URL `https://idislikejefmac.github.io/<repo>/`. Run it only after the iPad checklist in CHAOS_TESTING.md §7. To roll back, promote the previous commit.
- Until the first promote, production is built from `main` too.

Staging and production use different IndexedDB names and service-worker scopes, so testing staging can never change Dad's saved songs.

## Layout

```
src/core/       pure banjo + music logic (no DOM; lint-enforced)
  music/        C1 notes, keys, spelling, chords
  banjo/        C2 tuning, C3 rolls, C4 validator, C5 types
  tab/          C5 tab text format
src/platform/   P1–P8 interfaces, fakes, real implementations, diagnostics
src/chaos/      fault injection (test builds only)
src/app/        service wiring
src/ui/         Preact components
tests/unit/     Vitest unit tests
tests/property/ fast-check property tests
tests/e2e/      Playwright tests and spikes
scripts/        icon generator, production-bundle check
```

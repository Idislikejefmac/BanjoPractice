# Notes for Claude Code

Banjo practice PWA for Jeff's dad (Scruggs style, open G, reads mainly tab). Read these before changing anything:

- **`HANDOFF.md` first, if it exists**: work done on another machine, with the steps still to do.
- `DEVELOPMENT.md`: the build spec. IDs like C4, P2 and F17 are used in code comments, tests and commits.
- `BANJO_STYLE_GUIDE.md`: banjo rules. Read it before touching the arranger, tab, chord finder or transposition. DEVELOPMENT.md §11 lists where the spec overrides it.
- `CHAOS_TESTING.md`: stability requirements. New platform behavior needs a fault-injection scenario there.

## Conventions

- `src/core/**` is pure TypeScript: no DOM, storage, audio or UI imports (ESLint enforces it). Put banjo and music logic there and test it there.
- Use `.ts` extensions in relative imports and `import type` for types (`verbatimModuleSyntax`, `erasableSyntaxOnly`). This also lets Node run the core directly with type stripping.
- Platform APIs only through the interfaces in `src/platform/types.ts`. Each new service gets a real implementation, a fake in `src/platform/fakes.ts` and, where it can fail, a chaos wrapper in `src/chaos/`.
- Slots are 0-based in code and 1-based in the UI, the tab text format and messages.
- Tab fret numbers are stored capo-relative and displayed as actual frets by default (DEVELOPMENT.md C2).
- Built-in songs and licks are written fresh. Never copy from tab sites, books or recordings (DEVELOPMENT.md §10).
- Song melodies and words come only from a real source: Dad's sheet music or a verified public-domain printing (see `songs/STATUS.md`). Never from memory or guesswork; if there's no source, list the song as waiting for one.
- Every bug fix gets a regression test; chaos failures get a fixed-seed trace in `tests/chaos/regressions/`.

## Commands

Don't run the whole suite for every small change. `npm run check` looks at what changed (git) and picks the tier: **docs** (prettier), **quick** (+ typecheck, ESLint and the unit tests that import the changed files; seconds), **feature** (+ browser tests on Chromium; about a minute; for screen-only changes) or **full** (+ `npm run verify`, e2e on both engines and the chaos suite; many minutes; for storage, model, playback, audio, platform, build/test config, or many files). `npm run check -- --dry` says which tier and why; `--tier <name>` forces one. Run **full** before a phase is pushed; **quick** is enough between edits.

`npm run verify` runs typecheck, lint, tests, build and the production-bundle check.

Run browser suites only through `npm run e2e`, `npm run chaos` or `npm run check` (all go through `scripts/run-tests.mjs`): they stream live, print a heartbeat, write `test-logs/<suite>-progress.log`, stop a stalled run, and free the preview ports (4173–4175) before and after. Never pipe them through `tail` (no output until the end) and never start Playwright directly: a stopped run leaves its `vite preview` servers behind, and the next run then tests a stale build.

## Commits

Git identity for this repo is set locally (Jeff MacDermot, jeff.macdermot@live.com). GitHub account: idislikejefmac.

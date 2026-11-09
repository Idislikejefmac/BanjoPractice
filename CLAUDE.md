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

`npm run verify` runs typecheck, lint, tests, build and the production-bundle check. Run it before committing.

## Commits

Git identity for this repo is set locally (Jeff MacDermot, jeff.macdermot@live.com). GitHub account: idislikejefmac.

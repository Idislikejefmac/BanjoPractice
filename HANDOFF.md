# Handoff: where things stand (updated 2026-11-24)

Read this first in a new session. It tells you what is done, the rules that are easy to miss,
and what is still open. **Before ending a session, update this file**: the date above, "Where
things stand", "Recently done" (keep about ten entries) and the open lists. Lasting decisions
belong in DEVELOPMENT.md §16 or BANJO_STYLE_GUIDE.md; this file only points at them.

## Starting a session (any machine)

Bring both repositories up to date before doing anything else:

```sh
git pull                    # this app (public)
git -C sheet-music pull     # Dad's songs and notes (private); see below if missing
```

If `sheet-music/` doesn't exist yet (a new machine), clone it into this folder (it is
git-ignored here):

```sh
git clone https://github.com/Idislikejefmac/BanjoPractice-Songs.git sheet-music
```

Then `npm ci` if `package-lock.json` changed.

## Where things stand

- **main** = `3f1690b` (2026-11-19). Every phase 0–6 is built (README "Status" table) and the
  learning phases L1–L3 have shipped (LEARNING_SPEC.md §8). The last full tier (`npm run check
  -- --tier full`) passed on `f0465c3`: 168 e2e, 50 chaos, 0 failed. `3f1690b` passed the
  feature tier.
- **Staging** (`/staging/`) builds from every push to main.
- **Production (Dad's URL)** builds from the **`production` tag**, pinned 2026-11-19 to
  `718d551` (before the beginner-hand change). Before that there was no tag, so production
  was following main. Only Jeff runs *Actions → Promote to production*, after checking staging
  on the iPad. **Never promote, and never move or delete the tag yourself.**
- **Uncommitted, not ours: leave alone:** `.claude/`, `banjo-songs-abc.md` and
  `scripts/yt_transcript.py` in this repo.
- **The private songs repo** (`sheet-music/`) is fully committed: songs, photos (including
  Dad's roll page), `compendium/` (instructor notes) and `transcripts/` (lesson transcripts,
  added 2026-11-24, `68ad4f4`). See "Starting a session" above to get them.

## Rules (full versions in CLAUDE.md and memory)

- **Staging only.** Commit and push to main after a verified milestone; never promote.
- **No guessed songs.** Melodies, words and tabs come only from Dad's sheet music or a verified
  public-domain printing, never from memory. **Song content never goes in this public repo**:
  Dad's songs live in the private repo, cloned as `sheet-music/`
  (`https://github.com/Idislikejefmac/BanjoPractice-Songs`, never make it public).
- **Sources over rules.** Where first-tier sources (Deering, Jens Kruger, Tony Trischka, then
  Dad's own page) define something that breaks one of our heuristics, keep the sources' version
  and say so on screen (e.g. the Foggy Mountain roll's "Advanced:" note, guide §3.1). Don't bend
  confirmed material to fit a rule.
- **Tests.** Use `npm run check` (it picks the tier from what changed; `--dry` says why). Run
  the full tier before pushing anything big. Run browser suites only through the runner and
  never pipe them through `tail`. Every bug fix gets a regression test.
- **Stuck?** After two failed fixes, or when a design needs rework, have Opus or Fable audit
  it in a worktree. Give it the goal only, not your hypothesis.
- **Code:** `src/core/**` is pure TS (`.ts` imports, `import type`); platform APIs only through
  `src/platform/types.ts`. Slots are 0-based in code and 1-based on screen.

## Recently done

- 2026-11-19 `3f1690b` Rolls outside a beginner's lanes get an "Advanced: …" note
  (`advancedNote` in `hand.ts`). Only Foggy Mountain has one (the thumb on the 2nd string).
- 2026-11-19 `f0465c3` **Beginner hand** (guide §3.1, `src/core/banjo/hand.ts`). Dad's teacher
  said the 5th-to-2nd-string thumb jumps were expert-only. Generated tabs keep each finger to its
  lane (thumb 5/4/3, index 2/3, middle 1), long moves cost, and Foggy Mountain and index-leading
  are left out unless chosen. Settings → Banjo → "Tabs the app arranges are written for"
  (beginner by default / experienced). Roll exercises and lessons now play each roll's own
  strings (7 of 9 didn't).
- 2026-11-15 Dad's handwritten roll page compared with the library; waltz bars fixed (`b39cedf`).
  Lessons (F47) with first-tier sources (`8f81fd9`).
- 2026-11-14 Roll lesson Learn / Full switch (F36/F37), saved chord patterns (F46), notation
  chord-label fixes, an iPad audio-resume timeout.
- 2026-11-11 Learning phases L1–L3, seventh chords in the exercises (F45), a shorter control bar.
- 2026-11-09/10 Multi-verse playback (`[1,2` / `[3` endings), lyric placement fixes, per-song
  roll choice, a singing voice, notation fills the column width, a faster arranger.

## Outstanding tasks

1. **Dad's songs (private repo):** work through `sheet-music/CHECKLIST.md` (24 items, none
   ticked) against the photos, look at each song in the app (words under the right notes, every
   verse plays), then rebuild the pack with `node scripts/make-song-pack.ts` (the last one is
   from 2026-11-09, before many app fixes) and load it on the iPad with Settings → Restore from a
   backup.
2. **Move the lyric-alignment check** from `sheet-music/tools/abccheck.py` into
   `scripts/make-song-pack.ts`, so it runs everywhere.
3. **Built-in songs waiting for sources** (`songs/STATUS.md`): Cripple Creek and Old Joe Clark
   need Dad's sheet music; Wildwood Flower and Will the Circle Be Unbroken have public-domain
   sources found but aren't transcribed yet.
4. **iPad checks before any promotion** (Jeff): the CHAOS_TESTING.md §7 checklist, S1 (sound),
   S3 (silent switch, calls, Bluetooth), S6 (tuner on a real banjo), and a look at the
   beginner-hand tabs on staging.
5. **Learning phases L4–L5** (LEARNING_SPEC.md §5): the F38 chord-tones card, the F44 chooser,
   the F42 mastery map, and the F40 quiz (ask Dad first). Also left over from L1: a classifier
   test over the built-in songs.
6. **Proposed ideas, not committed** (DEVELOPMENT.md §7 "Ideas still only proposed"): Jeff or Dad
   to accept or cut.

## Open questions for Jeff and Dad

- **Forward/Reverse roll:** Dad's page has T M T I M I T M; Deering, Trischka and Kruger give
  T I M T M I T M. Which does he play? (guide §5 table; pinned in `tests/unit/dadsPage.test.ts`)
- What did the teacher think of the beginner-hand tabs? Any moves still too hard, or rolls
  missing?
- Which 5th-string spikes does his Deering Goodtime Artisan have (frets 7, 9, 10)? Does he want
  a Bluetooth page-turner pedal? (DEVELOPMENT.md §14)
- Dad to rate two generated arrangements "playable" (phase 3 exit), and to enter one song in
  the editor unaided (phase 5 exit).
- LEARNING_SPEC.md §6: a one-line rule beside the picture, or the picture alone? Is 3 "Got it"
  in a row right for fading a step? Is a quiz welcome?
- The `sheet-music/CHECKLIST.md` readings (for example Long Black Veil's last note, B or C♯).

## Things learned the hard way

- **Production builds from the `production` tag if it exists, otherwise from main.**
  `promote.yml` moves the tag. The deploy log prints the tag object's id, not the commit's.
- **Song transcription conventions** (all 17 files): `M:2/2` for cut time, `L:1/8`, one `w:`
  line per verse, `"^Chorus"` text labels, D.S./D.C. written out as repeats and endings.
  `In Tall Buildings` changes key inline. A tied-to note takes no syllable. In `w:` lines `|`
  means "skip to the next bar", a hyphen always splits a syllable, and `~` joins words onto one
  note.
- `make-song-pack.ts` checks that the ABC reads and the tab is legal, **not** the word
  alignment.
- A stopped Playwright run can leave `vite preview` on ports 4173–4175 and an esbuild process
  holding `node_modules`. The runner clears the ports; kill a leftover esbuild before `npm ci`.

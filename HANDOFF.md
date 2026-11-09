# Handoff: Dad's songs transcribed, multi-verse playback fix (2026-11-09)

Work done on a second Windows machine where npm is blocked by IT policy (no Node, so no tests,
no `npm run verify`). This file brings the main development machine to the same place. **Do the
steps in "Next steps" in order.** Delete this file (or move its lasting parts into README, TODO
or DEVELOPMENT.md) once they're done.

## What happened

1. **All 17 songs from Dad's bluegrass songbook were transcribed to ABC** from photos of the
   printed pages: melody, chord symbols and words, never from memory (CLAUDE.md rule). They live
   in a separate **private** repository, not here (see below).
2. **A playback bug was found and fixed** on branch `multi-pass-endings`, **not yet tested or
   merged**: most of these songs have three or four verses, and playback couldn't play them.
3. `songs/STATUS.md` now says where the private songs live (already on `main`).

## The private songs repository

`https://github.com/Idislikejefmac/BanjoPractice-Songs` (**private**; never make it public, since
most songs and the book's arrangements are copyrighted, and Dad owns the book: personal use
only). This repository (BanjoPractice) is public and serves GitHub Pages, so song content must
never be committed here.

Clone it as `sheet-music/` inside this folder (already git-ignored here):

```sh
git clone https://github.com/Idislikejefmac/BanjoPractice-Songs.git sheet-music
```

| Path in it | What |
| --- | --- |
| `songs/<id>.abc` | 17 songs. `N:` lines give the form, Dad's pencil notes and every `N:Uncertain` reading |
| `photos/` | The 20 photos the songs were transcribed from (`S:` in each song names its photo) |
| `tools/abccheck.py` | Python checker used on the machine without Node: bar lengths and word alignment (see below) |
| `CHECKLIST.md` | Every uncertain reading and transcription choice, as a checklist to tick off |
| `README.md` | Layout, use, transcription rules |

Songs: Angel Band, Dark Hollow, Fox on the Run, Head Over Heels in Love with You, I'll Fly Away,
In Tall Buildings, In the Pines, Keep on the Sunny Side, Kentucky Waltz, Long Journey Home,
Mountain Dew, My Home's Across the Blue Ridge Mountains, Rocky Top, Roll in My Sweet Baby's
Arms, Salty Dog Blues, The Long Black Veil, Wayfaring Stranger.

## The playback fix (branch `multi-pass-endings`)

**Bug:** `src/core/playback/order.ts` only recognised a first ending labelled exactly `"1"`
and always played a repeat twice. A song written `|: verse … [1,2 … :|[3 …` (three verses) or
`[1,2,3 … :|[4` (four) would play only two passes, and the `[1,2` ending wasn't treated as a
first ending at all. `parts.ts` (F26 part detection) and `repeatEdges` in `song.ts` (C4 join
checks) compared labels with `"1"`/`"2"` the same way.

**Fix:**
- New `endingPasses(label)` in `order.ts`: `"1"` → [1], `"1,2"` → [1,2], `"1-3"` → [1,2,3];
  unreadable labels count as pass 1. `isFirstEnding(measure)` = an ending that plays on pass 1.
- `playbackOrder` plays a repeated section as many times as its ending labels name (minimum 2).
  An ending before the `:|` runs to the next ending or the `:|` and plays only on its passes;
  endings right after the `:|` play on the last pass, which then carries on.
- `parts.ts` and `song.ts` use `isFirstEnding` instead of comparing with `"1"`/`"2"`.
- New tests in `tests/unit/playback.test.ts`: three passes for `[1,2 … :|[3`, a two-measure
  ending skipped on pass 4 of `[1-3 … :|[4`, and the label parser. The two existing order tests
  were traced by hand against the new code and should still pass. **Nothing has been run.**

## Things learned that aren't written down elsewhere

- **A note tied from the previous note takes no lyric syllable** (abcjs; `lyricLines` in
  `layoutAbc.ts` assumes the same). In `w:` lines, don't put `_` on a tied-to note: the hold
  moves onto the next note and every later word shifts one note late. This bit four of the
  transcriptions until it was fixed. Worth a unit test that pins it (see Next steps).
- **In `w:` lines, `|` means "move past the next bar line"**, not "one segment per bar": a pickup
  can share a segment with the bar after it, and `|||Now` puts "Now" in the fourth bar.
- **A hyphen always splits a syllable**, even without a space (`cap-tain` is two notes; write
  `captain` for one note). `~` joins several words onto one note (`he~said~he`).
- **D.S. / D.C. / Coda aren't followed by playback**, so the transcriptions write the sung form out
  with repeats and endings (each song's `N:` lines describe its printed form).
- **The `make-song-pack.ts` check doesn't catch lyric misalignment**: it checks the ABC reads and
  the tab follows the rules. `tools/abccheck.py` in the songs repo checks words against notes.
- Song conventions used in all 17 files: `M:2/2` for cut time, `L:1/8`, chords where they change,
  one `w:` line per verse under the same notes, `"^Chorus"` as a text label (not `P:`), ties
  inside a bar written as one longer note, instrumental slash bars and "solo over verse" left out.
  `In Tall Buildings` changes key with an inline `[K:E]`.

## Readings to check against the book (each is also an `N:Uncertain` line in its song)

The full list, with checkboxes, is **`sheet-music/CHECKLIST.md`** in the private songs repo (it
includes word readings and transcription choices too). The main ones:

| Song | Check |
| --- | --- |
| The Long Black Veil | Last held note: B or C♯ |
| Wayfaring Stranger | Bars 10–12: D7 carries on (no main chord printed), maybe Dm meant; middle bar of the coda (moderate confidence) |
| Keep on the Sunny Side | Chorus bar 13: C or B |
| Roll in My Sweet Baby's Arms | The eighth on "the" in "shack 'til the": C or B |
| Head Over Heels | Coda "love" eighth has no flat, the chorus has B♭: probably a missing accidental in the book |
| Kentucky Waltz | Bar 9 has an eighth too many for 3/4 (written as a triplet; Dad pencilled "3"); bar 29's printed sharp read as B♯ |
| Angel Band | Chorus bar 15: D or E; bar 19: F or G |
| Rocky Top | Chorus "me." whole note: E or F |
| Fox on the Run | The book's two printed choruses differ in two bars; both kept as printed |

## Next steps (in order)

1. **Get both repositories:**
   ```sh
   git pull                           # main: STATUS.md note and this file
   git fetch origin multi-pass-endings
   git clone https://github.com/Idislikejefmac/BanjoPractice-Songs.git sheet-music
   ```
2. **Test the fix:** `git switch multi-pass-endings`, `npm ci`, `npm run verify`. Fix anything that
   fails (the code was written without running it). Add a test that **pins the tie rule**:
   `indexAbc` of a measure `G4 G4-|G4 A4` with `w:a b|c` puts "c" on the A, not the tied G.
3. **Merge** `multi-pass-endings` into `main` and push (this deploys staging).
4. **Check the songs with the app's own loader:** `node scripts/make-song-pack.ts`. It lists every
   song with ✓/✗; fix any ✗ in `sheet-music/songs/` and commit/push in that repository.
5. **Look at each song in the app** (`npm run dev`): notation, words under the right notes, and
   playback through every verse (three or four passes where the song has `[1,2`/`[1,2,3`
   endings). Work through `sheet-music/CHECKLIST.md` against the photos.
6. **Build the pack for Dad:** `node scripts/make-song-pack.ts` writes
   `sheet-music/dads-songs-YYYY-MM-DD.json` (git-ignored). Send it to the iPad and load it with
   **Settings → Restore from a backup**. Do this only after step 3, or the multi-verse songs
   play wrong.
7. Consider moving the lyric-alignment check into `make-song-pack.ts` (port `tools/abccheck.py`'s
   word-flow check to TypeScript using the indexed melody), so it runs everywhere.

# Learning-support spec: evidence and feature plan

Drafted 2026-11-11, revised after an independent Fable 5.2 review the same day.
Status: **reviewed draft, ready for phase L1.**
Audience: Dad (84, rules-and-technical learner, slow to consolidate, reads tab). Goal: make
rolls and "which note goes where, given the key and melody" learnable from pictures and
explicit rules, with very little prose.

## 1. What the evidence does and doesn't support

Searches and the review were done on 2026-11-11. "Strength" is my reading, not the papers'
claim. Several sources were abstracts or search snippets only; those are marked.
**Nothing here was tested on older banjo learners, and I found no trial of any of it in a
practice app.** Every row is a design hypothesis to check against Dad's actual progress.
Rows marked (verified) were re-checked by a second search after the review.

| # | Finding | Source | Strength / caveat |
| --- | --- | --- | --- |
| E1 | Learning an instrument in later life improves some executive functions (inhibition, switching, speed); no effect on working or verbal memory. | [Meta-analysis, 2024](https://www.sciencedirect.com/science/article/pii/S0278262624000149) | Risk of bias: 3 studies high, 9 "some concerns", 1 low. About cognition, not teaching method. |
| E2 | Older-adult instrument trials differ widely in tasks (scales, simplified notation, computerised instruction, no home practice); I found no review comparing *teaching methods*. | [Systematic review](https://pmc.ncbi.nlm.nih.gov/articles/PMC6387997/) | A gap, not a finding. |
| E3 | Staff notation is argued to load older novices' memory and vision; progress in musical ability predicts cognitive transfer. | [12-month programme, 2025](https://royalsocietypublishing.org/rsos/article/12/12/251022/365477/Progressively-learned-musical-ability-predicts) | **Unread** (403). Snippet only. Dad reads tab. |
| E4 | Worked examples beat problem-solving for novices, **and were more efficient for elderly learners** (less time and load for comparable performance, N=54); support should fade as skill grows (expertise reversal), e.g. backward fading. | [Van Gerven et al. 2002](https://cris.maastrichtuniversity.nl/en/publications/cognitive-load-theory-and-aging-effects-of-worked-examples-on-tra) (verified, abstract only), [expertise reversal](https://en.wikipedia.org/wiki/Expertise_reversal_effect) | Best-supported item here, including for older adults. The fade *schedule* for older people is not established. |
| E5 | Practice schedules: random practice hurts during practice and helps retention in some studies; age did not modulate schedule effects in one study (Pauwels 2015); in an older-adult EEG study a **hybrid blocked/serial/random schedule that adapted to error rate beat both pure blocked and pure random** at retention. | [Pauwels 2015](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4531253/), [Beik 2020](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7304442/) (verified) | Timing task, not instrument playing. Supports a *staged* mix (block first, then mix as errors fall), not "off". |
| E6 | An external focus of attention helped in the 2021 meta-analysis (g ≈ 0.58 retention), **but a 2024 bias-corrected reanalysis shrank the effects to near zero** (retention g ≈ 0.15, Bayes factors favouring no effect). | [Chua 2021](https://pure.psu.edu/en/publications/superiority-of-external-attentional-focus-for-motor-performance-a/); [McKay et al. 2024](https://raw.github.com/cartermaclab/carterlab-papers/main/2024_mckay-etal_reporting-bias-not-external-focus-a-robust-bayesian-meta-analysis-and-systematic-review-of-the-external-focus-of-attention.pdf) (verified) | **Contested.** Keep cues as a harmless, cheap line; do not build features on it. |
| E7 | Spaced retrieval helps learning, strongest in dementia; healthy older adults benefit. **Massed retesting did not help older adults**, so a "missed item returns sooner" rule must still leave a gap. | [Maddox & Balota](https://pmc.ncbi.nlm.nih.gov/articles/PMC4480221), [SRT reviews](https://apps.asha.org/EvidenceMaps/Articles/ArticleSummary/d1982e30-ffe9-42d4-bbef-880b2a299df9) | Limited for healthy older learners; reviewer-reported detail on massed retesting not re-checked. |
| E8 | Load-reducing design (segmenting, signalling, coherence, learner control) is argued to help older adults *especially*; but one thesis found older adults did better with narration plus text than narration plus images. | [Paas, Van Gerven & Tabbers chapter](https://www.cambridge.org/core/books/cambridge-handbook-of-multimedia-learning/cognitive-aging-principle-in-multimedia-learning/117C44E5D565A6DAAE636C96FF289787), [Fenesi thesis](https://macsphere.mcmaster.ca/bitstream/11375/18310/2/Fenesi_Barbara_finalsubmission2015August_PhD.pdf) | The thesis compares conditions with narration; this app has none, so it is weak evidence against pictures. Keep one short rule line beside each picture and test it with Dad. |
| E9 | Real-time visual guidance helps beginners during practice; benefits may not persist and it competes for visual attention while playing. | pitch-feedback and guitar visual-aid studies (mixed) | **Weak and mixed**; the earlier "no long-term advantage" reading was not supported by the reviewer's check (one guitar-light study reported better two-week retention). Use the guidance hypothesis (below) as the reason to fade, not as a reason to avoid visuals. |
| E10 | Personalised, learner-paced, multi-sensory teaching reports better motivation. | [Wang 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC12761604/) | Weakest: abstract of a conference paper, 1 instructor, 8 learners, music *appreciation*. Used only to justify learner control. |
| E11 | Guidance hypothesis: constant concurrent guidance helps practice but can hurt retention, so guidance should fade. Older adults chunk motor sequences poorly, so teach four-slot halves. | Winstein & Schmidt (from memory) | **Not searched or verified by me**; reviewer also from memory. Check before relying on it. C3 already has four-slot halves. |

**Design bet, stated honestly:** the "rules-based learner" framing is Jeff's observation of his
dad; I found no literature on matching teaching to rules-based versus intuitive learners, and
learning-style matching is generally poorly supported. The app states rules explicitly because
Dad wants them, which is a preference to honour, not an evidence-based method.

**What I'm relying on:** worked example then fade (E4, E11); spaced, *gapped* retrieval of rules
(E7); learner control and short segments (E8, E10); a staged practice mix (E5). External-focus
cues (E6) are optional flavour.

## 2. Design principles

1. **One idea per screen**, picture first, one rule sentence of at most ~12 words beside it (E8).
2. **Every pattern is shown as a rule and a picture**, e.g. forward roll `T I M T I M T M` plus the lane diagram.
3. **Worked example, then fade** (E4): full, then last step hidden, last two, blank. Advance after he self-rates success at a set count; step back after misses. Rolls are taught in **four-slot halves** first (E11).
4. **Learner controls pace**; no timeouts, scolding, wrong-answer sounds or streak loss.
5. **Constrain choices** early (design choice; not directly tested in older adults, since I found no support for "errorless learning" claims).
6. **Colour never carries meaning alone** (letters and shapes too).
7. **Teaching is derived from `src/core`** (`rolls.ts`, `arranger.ts`, C8 shapes, `chords.ts`) so it cannot disagree with the arranger. No separately typed theory tables. **Examples of melody come only from songs the app has loaded** (CLAUDE.md), never invented.
8. **The app cannot hear whether he played right** (only a single-pitch tuner exists), so progress uses "Got it / Again" self-rating and tap-the-answer quizzes, never automatic "clean pass" detection.

## 3. Features

IDs continue from F35 and are to be **merged into DEVELOPMENT.md §7** when built; this file is
a working plan, not a second spec. The core module needs a C-number (proposed **C10**, learning
helpers, pure) in DEVELOPMENT.md §3.

Corrections from the review are applied: F38 uses the song's own chords (no I-IV-V table, which
is wrong for modal/minor keys and absent from `keys.ts`); F41 cues derive from each roll's
`fingers` and `accents` (the sample "thumb on the beat" is true only for alternating thumb);
F40 never asks "is B a chord tone in C" (key vs chord); F43 is cut.

| ID | Feature | Built from | Notes |
| --- | --- | --- | --- |
| F39 | **Why this note?** Classify each tab note after the fact (melody, slur into melody, chord tone, drone, open filler, pinch, hold) and show the label on step mode's current note. Also finishes F14's unbuilt "why" popover. | `TabNote` (`src/core/banjo/types.ts`), `chordPitchClasses`, `droneClashes`, exported `melodyTargets`; classifier in new pure `src/core/learning/` | Must be a post-hoc classifier: hand-written tabs never go through `arrange`, and a `reason` field on `TabNote` would break the C5 tab-text round trip. Cannot say *why one roll beat another* (costs are discarded). |
| F36 | **Roll lesson**: one roll as three finger lanes over string rows, taught in four-slot halves, played through the existing `exercise:<roll>` song with a lane band above the tab; default to step mode (F28). | `exercises.ts`, `rolls.ts`, F28 | Must not live in the modal practice-tools page (`Player` only plays `store.currentSong`). F30 strip was removed 2026-11-09 as too fast. |
| F41 | **Listen-for cue** derived per roll from `fingers`/`accents`. | `rolls.ts` | One line, optional. |
| F37 | **Roll fade ladder**: step 1 full picture, 2 second half hidden, 3 only finger names, 4 blank (he taps the finger per note). "Got it / Again" self-rating; advance after 3 in a row, back one level after 2 "Again". | pure state machine in `core/learning` | Needs persistence, backup, validators and chaos rows shipped **with** it (not later). |
| F38 | **Chord-tones card** on the open song's own chords: chord tones on the fretboard and staff, melody note marked chord tone or passing. Uses the shape key and capo from `practicePlan`, or frets disagree with the tab. | `chords.ts`, `voicings.ts`, `practiceArrangement.ts` | `Neck` in `ChordFinder.tsx` is private and draws one voicing; extract. Never says the arranger "moves" a note to the nearest chord tone: it places or drops it. |
| F44 | **Roll chooser**: for a melody string and slot, show which rolls put a legal finger there. | `ROLLS` × `STRINGS_FOR` (`arranger.ts`), guide §7.4 | Added by the review. |
| F42 | **Mastery map**: rolls × progressions (exercises are G only, four progressions), empty / seen / steady; no points. "Seen" derives from the existing practice log. | F37 data, F21 log | Dropped the keys axis: no data. |
| F40 | **Rule quiz (spaced)**: max 5 questions, tap-the-answer, skippable, off in Settings; missed items return after a gap. | `core/learning/schedule.ts` | Last; ask Dad first. Reuse echo mode (F29) as "hear it, then play it". |

**Cut:** F43 optional mixed drill (`PracticePrefs.rolls` already limits rolls per song; 20 of
56 ordered roll pairs fail the H1 no-repeat rule at the bar line, so mixing needs care). A
staged mix (E5) can return later as a plain "mix two rolls" option if Dad wants it.
**Not included:** falling-note game, scores, streaks, adaptive difficulty he can't see.

## 4. Storage and platform

- No new platform service: `KeyValueStore` (`src/platform/types.ts`) with its existing fake and chaos wrapper.
- **Do not add an IndexedDB store** (forces `DB_VERSION` 1→2, which makes a rolled-back build read-only, DEVELOPMENT.md §8.1). Keep learning progress as **one document in the existing `meta` store**.
- Whoever adds that document also owns: backup/restore (`src/app/backup.ts`), validators (`model.ts`), Session shape, chaos-monkey actions, a wall-clock-jump row in CHAOS_TESTING.md, and a fixed-seed regression trace for any failure.

## 5. Phasing

Each phase ends with `npm run verify`, a commit to `main` (staging only; **never** "Promote to
production"), and a line here recording what shipped.

1. **L1 (pure core, tests only):** `src/core/learning/`: note classifier (F39), fade-level state machine (F37), cue derivation (F41), spaced schedule with a minimum gap (F40), roll-chooser query (F44). Tests include: classifier on the built-in songs, every roll shown passes C4, schedule never re-asks inside its gap.
2. **L2:** step-mode reason line (F39 UI, finishing F14's "why").
3. **L3:** F36 roll lesson in the exercise view, with F41 cues; then F37 with its storage, backup and chaos work in the same phase.
4. **L4:** F38 chord-tones card, F44 chooser.
5. **L5:** F42 mastery map; F40 quiz only after asking Dad.

## 6. Open questions for Jeff and Dad (none block L1)

1. One-line rule beside the picture, or picture alone? (E8 is ambiguous for older adults; ask him.)
2. Is 3 "Got it" in a row the right bar to fade a step? It is a guess.
3. Is the quiz welcome? It ships skippable and switchable off.
4. Check E11 (guidance hypothesis, chunking in older adults) against a real source before the fade ladder's thresholds are tuned.

## 7. Review log

- 2026-11-11 Fable 5.2 reviewed the first draft read-only against the code. It found: F39 feasible only as a post-hoc classifier; F36 cannot live in the modal tools page; no ability to hear "clean passes"; F38 and F41 contradicted the arranger and roll data; storage plan would have forced a DB version bump; several evidence misreadings (E4, E5, E6, E8, E9). I re-checked E4, E5 and E6 with searches and confirmed them. E7's massed-retesting detail and E11 are reviewer- or memory-sourced and still unverified. Code claims (line numbers, the 20-of-56 roll-pair count, the F30 removal) are the reviewer's and are to be confirmed when L1 touches them.

## 8. Shipped

- **L1 (2026-11-11):** `src/core/learning/` (`fade.ts`, `schedule.ts`, `cues.ts`, `classify.ts`), `tests/unit/learning.test.ts` (17 tests), and `STRINGS_FOR` exported from `arranger.ts`. Typecheck, lint on `src` and `tests`, all 383 unit tests, build and production-bundle check pass. Not yet done: a classifier test over the built-in songs, and the C10 / F36–F44 entries in DEVELOPMENT.md. `npm run lint` as a whole fails only because ESLint scans the untracked `.claude/worktrees/` folder, which predates this work.
- **L2 (2026-11-11):** step mode (F28) now shows a fixed box at the bottom left saying what the note under the cursor is for (F39): measure and note number, its role (melody, chord tone, 5th-string drone, hammer/pull/slide, not in the chord), string, fret (actual or capo-relative per the setting) and finger. Pinches list every note. `explainSlot` in `core/learning/classify.ts`, UI in `SongView.tsx`, one Playwright test in `phase2b.spec.ts`. No new platform behaviour, so no chaos scenario. Not done: showing the reason during normal playback, and an explicit "why this roll" (the arranger discards its costs). Unit tests 384, Chromium e2e 49 passed (1 skipped), build and bundle check pass.

## 9. Visual design approaches (added 2026-11-11)

Sources are reviews and practitioner guides, not controlled studies; I could not use the apps
themselves. Nothing is copied: only general approaches are taken, drawn in the app's own style.
Reviews: [Yousician](https://americansongwriter.com/yousician-review/),
[Simply Guitar vs Yousician](https://www.kunstplaza.de/en/music/simply-guitar-or-yousician/),
[Flowkey](https://pianistscompass.org/reviews/apps/flowkey/),
[Melodics](https://deviantnoise.com/piano/online-lessons/melodics-review/).
Older-adult guides: [IEEE age-friendly UI](https://agetech.ieee.org/publications/topics/why-age-friendly-ui-ux-design-is-the-most-overlooked-skill-in-modern-tech-development/),
[Bentley UX Center](https://www.bentley.edu/centers/user-experience-center/designing-mobile-experiences-seniors-mind),
[Glance guide](https://thisisglance.com/learning-centre/how-do-i-design-apps-for-elderly-people).
Roll-specific: [ArtistWorks Banjo Roll Trainer](https://go.artistworks.com/banjo-roll-trainer) (hear and see each roll, finger letters plus open-G strings, adjustable speed); I found no reviewed banjo app with finger-lane diagrams, so F36's lanes are our own design.

| Approach seen | Where | Use here | Verdict |
| --- | --- | --- | --- |
| Restrained, limited interface for beginners, not overwhelming | Simply Guitar reviews | One idea per screen (principle 1) | Adopt |
| Small fixed main menu, no nested menus; same layout on every device | Flowkey reviews | The Learn page is one list of rolls; same layout at every width | Adopt |
| Hand separation and wait mode as practice tools | Flowkey reviews | We already have step mode (F28), loops and echo mode; lessons should use them, not add new modes | Adopt (reuse) |
| App rewinds to the section after repeated errors | Simply Guitar reviews | After two "Again" ratings, the lesson steps back a level and restarts the half (F37) | Adopt |
| Streaks, combos, achievements, scores | Melodics, Yousician | Conflicts with principle 4 (no scolding or streak loss) and reviewers note the game look can feel childish to some players | **Reject**; the mastery map (F42) shows steadiness, never points |
| Falling-note, game-like scrolling display | Yousician | Needs constant eye tracking while also playing (E9) | **Reject** as the main view |
| Touch targets 44 pt minimum, 48 better; spacing so neighbours aren't hit | Older-adult guides (practitioner consensus) | All lesson buttons at least 48 px with a clear gap | Adopt |
| Body text 18 px or more; contrast 7:1 where possible (practitioner preference; WCAG 4.5:1 is the baseline) | Older-adult guides | Lesson text 18 px+, check contrast of the finger colours and the step box | Adopt, and measure |
| Test with real older users | All guides | Dad is the test; leave room for his feedback after each phase | Adopt |

**Concrete visual rules for F36–F44**
1. Finger lanes use the existing finger colours **and** letters (T, I, M), as elsewhere in the app; never colour alone.
2. One accent colour for "current note"; everything else quiet. Hidden hints (fade levels) show as plain dashed outlines, so he sees something is expected there.
3. Rating buttons are two large, equal buttons: "Got it" and "Again", with words, no icons alone.
4. No sounds for "wrong"; progress shown as filled steps (1 of 4), never as a score.
5. Every new screen gets a Playwright screenshot at iPad sizes (744, 820, 1180 wide) that is looked at before it ships, plus a contrast check of text on its backgrounds.

**Limit:** this is a survey of opinions. The real check is Dad using it; the design is a first draft for him to react to.
- **L3 (2026-11-11):** the roll lesson (F36, F37, F41). Opening a roll exercise now shows a "Learn the … roll" panel under the title: the roll as thumb / index / middle lanes in two halves of four, the string and note number under each, a one-line rule and listen-for cue, two large buttons ("Again", "Got it") and "Show me" / "Start over". Three "Got it" in a row remove a level of help (full → second half hidden → strings hidden → all hidden); two "Again" put one back. Progress is saved per roll as one `meta/learning` document, included in backups (merged on restore so an old backup never takes progress away), and covered by chaos scenarios (`tests/chaos/lesson.spec.ts`) and a shown-equals-stored check in the shared checkpoint. Code: `core/learning/{progress,lesson}.ts`, `RollLesson.tsx`, `store.ts` (`learning`, `rateRollPass`, `resetRollLesson`), `backup.ts`. Screenshots at 744, 820 and 1180 wide were looked at. Known: the panel is tall, so at 1180 wide the tab starts just below the fold; the quiz, chord-tones card, roll chooser and mastery map are still to do.

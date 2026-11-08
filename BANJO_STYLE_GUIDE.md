# Scruggs-Style Banjo: Reference for the Arranger

This file is the domain reference for anyone (human or AI agent) writing the banjo parts of the app: the roll arranger, tab rendering, the chord finder and transposition. Read it before touching any of those. `PLAN.md` says *what* the app does; this file says *how the banjo actually works*.

Where players and teachers disagree, this file says so. Where something is a firm rule of the style, it is marked **Hard rule**. Everything else is a preference the arranger should score, not enforce.

---

## 1. The instrument

### 1.1 Strings and tuning

Standard 5-string banjo, **open G tuning: g D G B D** (5th string to 1st string).

| String | Name | Open pitch | MIDI | Notes |
| --- | --- | --- | --- | --- |
| 5 | short drone | G4 | 67 | Starts at the 5th fret; the highest open string |
| 4 | | D3 | 50 | Lowest pitch |
| 3 | | G3 | 55 | |
| 2 | | B3 | 59 | |
| 1 | | D4 | 62 | Highest of the full-length strings |

Key facts:

- **String numbering runs 1 to 5 from the floor side up.** String 1 is nearest the floor; string 5 is the short string on the thumb side, nearest the player's face.
- **The 5th string is a "re-entrant" drone:** it is physically on the thumb side but higher in pitch than strings 4–2. Its open note (G4) equals the 1st string at fret 5.
- **5th-string fret numbers** are counted from the main nut like every other string. The 5th string has no frets 1–5, so a fretted 5th-string note is always fret 6 or higher. Open 5th = `0` in tab.
- Typical neck: 22 frets. Treat frets above about 17 as rare.
- **Other tunings** (later options, not phase 1): double C (g C G C D), open D (f♯ D F♯ A D), G modal / "sawmill" (g D G C D). The tuning must be data, not hard-coded, so these can be added.

### 1.2 Capo and the 5th string

A capo on the main neck raises strings 1–4. The 5th string is not affected, so it must be raised separately, either by retuning it or by hooking it under a **5th-string spike** (small railroad spikes in the fingerboard). Many Deering banjos have spikes at **frets 7, 9 and 10**, which raise the 5th string to a, b and c: exactly what is needed for capo 2 (key of A), capo 4 (key of B) and capo 5 (key of C).

Rule for the app: **capo at fret `c` means the 5th string must also go up `c` semitones**, so its spike is at fret `5 + c`. If no spike exists for that fret, say "tune the 5th string up to X" instead.

### 1.3 Right hand

- Scruggs players wear a **plastic thumbpick and two metal fingerpicks** (index, middle). The ring and/or pinky finger usually rest on the banjo head as an anchor.
- Only **thumb (T), index (I) and middle (M)** pick strings. Ring and pinky never pick in this style.
- Every note is a single pluck. No strumming in lead playing.

---

## 2. Rhythm

- Scruggs style is a **continuous stream of evenly spaced eighth notes**: 8 picked (or slurred) notes per measure of 4/4. Many tab books write it as 2/4 with sixteenth notes; it is the same thing. The app's internal model should be **8 slots per 4/4 measure**, numbered 1–8.
- Bluegrass is played **straight, not swung**, with drive: notes land on or slightly ahead of the beat.
- The banjo almost never rests. Where the melody holds a long note, the roll keeps going around it.
- **Accents.** A forward roll naturally groups the 8 notes as **3 + 3 + 2**, putting accents on slots **1, 4 and 7**. This syncopation is a big part of the bluegrass sound. Other rolls accent the downbeats (slots 1, 3, 5, 7). Melody notes should be played slightly louder than filler notes (see §5).

---

## 3. Which finger plays which string

Teachers vary, and the roll and surrounding notes decide the finger, not the string alone. These defaults are the consensus:

| Finger | Usual strings | Occasionally | Practically never |
| --- | --- | --- | --- |
| Thumb (T) | 5, 4, 3 | 2 (e.g. the Foggy Mountain roll) | 1 |
| Index (I) | 2, 3 | 4 | 1 (rare), 5 |
| Middle (M) | 1 | 2 | 3, 4, 5 |

Notes for the arranger:

- **The 3rd string is played by either thumb or index**, depending on the roll. In a 5-3-1 or 4-3-1 forward roll, the index takes the 3rd string (T-I-M). In a 3-2-1 roll the thumb takes it. A 3-2-5-1 alternating roll starts with the thumb on the 3rd; a 4-3-5-1 alternating roll uses the index on the 3rd.
- **The middle finger stays on the 1st string** for beginners and nearly all Scruggs patterns. The middle finger on the 3rd string is effectively never seen.
- **The thumb owns the 5th string.**

---

## 4. Rules for picked notes

### 4.1 Hard rules (the arranger must never break these)

1. **No finger picks two notes in a row.** Each consecutive picked note uses a different finger. This includes across bar lines: if a measure ends with M, the next measure must not start with M.
2. **No two consecutive picked notes on the same string.** Rolls move across strings. Repeated notes on one string come from left-hand slurs (§6), not repeated picking. (Melodic and single-string styles relax this; Scruggs style does not.)
3. **Fingers don't cross.** At any moment the thumb is on a string at or above (higher-numbered than) the index, and the index at or above the middle. In a **pinch** (simultaneous notes) this is strict: string(T) > string(I) > string(M). In a sequence, a short-term crossing such as I on 3 immediately followed by T on 2 is wrong. Equal strings in sequence are fine when the fingers differ (the Foggy Mountain roll has I and T both on the 2nd string, one after the other).
4. **Only allowed finger-string pairs** from §3's "usual" and "occasionally" columns. Never the "practically never" column.
5. **Left-hand reach.** All fretted notes that ring together, or follow within the same chord shape, must fit within about a 4-fret span, using at most 4 fretting fingers. Open strings are free. Fretting the 5th string is rare in Scruggs style; allow it only inside specific licks.
6. **Every slot is filled.** Each of the 8 slots holds a picked note, a pinch, or a slurred note (§6). Rests are allowed only at the very end of a piece or phrase-final pinch/hold.

### 4.2 Strong preferences (score these)

- **Use a named roll** (§5) or a recognised mixture of named half-rolls. A random-looking but legal finger sequence sounds wrong.
- **Melody on accented slots**: 1, 4, 7 for forward rolls; 1, 3, 5, 7 for alternating thumb and others.
- **Melody on strings 1–3**, picked by M, I or T as the roll dictates. Thumb-lead melody on strings 3 and 4 is idiomatic too.
- **Prefer open strings and first position** (frets 0–4) for "down-the-neck" arrangements. Up-the-neck arrangements use the movable shapes in §8.
- **Filler notes are chord tones** from the current chord shape, plus the open 5th-string drone.
- **The 5th-string drone (g) is acceptable over almost any chord in G-family keys**, including C and D. That clash is part of the sound. Use it freely in filler slots.
- **Change rolls to follow the melody.** Players switch roll patterns phrase by phrase so the strings they hit line up with the melody.

---

## 5. The roll library

Each roll is 8 slots. The finger sequences are standard; the string sequences are the usual examples over a G chord in open G. The arranger should treat each roll as a **finger template**, then choose strings (and frets) to fit the melody and chord.

| Roll | Fingers | Example strings (G chord) | Typical use |
| --- | --- | --- | --- |
| Forward | T I M T I M T M | 3 2 1 5 2 1 5 1 | The core Scruggs drive; 3+3+2 accents |
| Forward (thumb-start variant) | T M T I M T I M | (varies) | More power from the thumb on the downbeat |
| Backward (reverse) | M I T M I T M I | 1 2 5 1 2 5 1 2 | Melody on the 1st string |
| Forward-reverse | T I M T M I T M | 3 2 1 5 1 2 3 1 | Melody on strings 1 and 3; pivots midway |
| Alternating thumb ("square") | T I T M T I T M | 3 2 5 1 4 2 5 1 | Melody on 2nd/3rd strings; thumb alternates |
| Foggy Mountain | I M T M T I M T | 2 1 2 1 5 2 1 5 | Thumb crosses to the 2nd string |
| Middle-leading ("Osborne") | M I M T M I M T | 1 2 1 5 1 2 1 5 | Melody repeated on the 1st string |
| Index-leading | I T I M I T I M | 2 3 2 1 2 3 2 1 | Melody repeated on the 2nd string |

**Pinches:** two or three strings struck at once, most often T+M (strings 5 and 1) or T+I+M. Used on strong beats, phrase endings and as the last note of a piece. A **thumb–pinch–thumb–pinch** pattern is a common way to fill long held notes.

**Half-rolls:** players often combine the first or second half of one roll with half of another. The arranger may build a measure from two 4-slot halves, as long as the hard rules hold at the join.

**Checking a roll:** run every roll in the library (and every generated measure) through the hard-rule validator in automated tests. A roll that fails is a bug in the library or the validator.

---

## 6. Left-hand techniques

These add notes without a new right-hand pick. In the 8-slot model, the slurred note **takes its own slot and has no picking finger**. The right-hand pattern continues around it, and the finger rule (§4.1 rule 1) applies to the picked notes on either side of it.

| Technique | Tab mark | What happens | Typical example |
| --- | --- | --- | --- |
| Hammer-on | h | Pick a note, then fret a higher note on the same string without picking | 3rd string open → 2nd fret (G to A) |
| Pull-off | p | Pick a fretted note, then pull the finger off to sound a lower note | 1st string 3rd → 2nd fret, or 2nd fret → open |
| Slide | / (up), \ (down), or sl | Pick a note, then slide the finger to a new fret | 3rd string, fret 2 → 3 (A to B♭) under a G chord, often followed by the open 2nd string (B) |
| Choke (bend) | ch or b | Bend the string sideways to raise the pitch | 2nd string 10th fret choke in up-the-neck licks |

- The 3rd-string slide from fret 2 to 3 under a G chord is idiomatic even though B♭ isn't in G major. It is a blue note, approached and left quickly.
- A slide or hammer-on usually lands on the **next eighth-note slot**. Some licks time the slurred note against a picked note on another string; support that later, not in phase 3.
- **Melody often arrives by slur.** A hammer-on or slide is a good way to reach a melody note on a strong slot.

---

## 7. Building an arrangement from a melody

This is the method human players use, turned into steps the arranger can follow.

1. **Find the melody notes** and their durations, measure by measure, with the chord for each measure or half-measure.
2. **Simplify the melody to the slots.** A Scruggs break doesn't play every passing note. Keep notes on strong beats and long notes; drop or slur quick passing notes. A melody moving in fast steps is a sign the tune may suit melodic style better (out of scope for now).
3. **Locate each melody note on the neck**: list every (string, fret) that produces it, preferring strings 1–3, open strings and frets that fit the current chord shape.
4. **Choose a roll** (or two half-rolls) per measure whose finger template puts a usable finger on the melody string at the melody note's slot. Alternating thumb and forward-reverse are good defaults for melody on the 2nd and 3rd strings; backward roll for melody on the 1st string; forward roll for drive.
5. **Hold long melody notes** by returning to the melody string later in the roll, or by a thumb–pinch pattern.
6. **Fill the remaining slots** with chord tones on allowed strings, using the open 5th string freely.
7. **Validate the hard rules**, including the joins between measures and half-measures.
8. **Score the soft preferences** and pick the best candidate.
9. **End phrases and pieces properly.** End of a phrase where the melody holds: use a fill-in lick (a short stock phrase) or a roll on the chord. End of the piece: a tag ending (the familiar "shave and a haircut" style ending in Scruggs breaks) finishing on a pinch.

Implementation notes:

- Treat this as a **search over each measure, with continuity between measures** (dynamic programming or beam search works well): the cost depends on the previous measure's last finger, string and hand position.
- Keep the generated licks **generic and generated by rules**. Don't copy licks note for note from books or recordings; they're copyrighted transcriptions, and the app's built-in material must be written fresh.
- **Explainability:** store which roll template produced each measure, so the UI can show it ("forward roll") and the song editor can offer overrides.

---

## 8. Chords and left-hand shapes (open G tuning)

Fret numbers below are for strings **4, 3, 2, 1**; the 5th string is open unless stated. All shapes were checked by computing their pitches.

### 8.1 First-position chords

| Chord | 4 | 3 | 2 | 1 | Notes |
| --- | --- | --- | --- | --- | --- |
| G | 0 | 0 | 0 | 0 | D G B D |
| C | 2 | 0 | 1 | 2 | E G C E |
| D | 0 | 2 | 3 | 4 | D A D F♯ |
| D7 | 0 | 2 | 1 | 0 | D A C D |
| G7 | 0 | 0 | 0 | 3 | D G B F |
| Em | 2 | 0 | 0 | 2 | E G B E |
| Am | 2 | 2 | 1 | 2 | E A C E |
| E | 2 | 1 | 0 | 2 | E G♯ B E |
| F | 3 | 2 | 1 | 3 | F A C F |
| Dm | 0 | 2 | 3 | 3 | D A D F |

### 8.2 Movable shapes

On the banjo there are effectively three movable major-chord shapes, named **F, D and barre**. Each moves up the neck to give every chord. `x` is the shift in frets.

| Shape | 4 | 3 | 2 | 1 | Root at x = 0 | Example |
| --- | --- | --- | --- | --- | --- | --- |
| Barre (major) | x | x | x | x | G (open) | x = 2 → A, x = 5 → C, x = 7 → D |
| F shape (major) | x+3 | x+2 | x+1 | x+3 | F | x = 2 → G (5 4 3 5) |
| D shape (major) | x+4 | x+2 | x+3 | x+4 | D | x = 5 → G (9 7 8 9) |
| F-minor shape | x+3 | x+1 | x+1 | x+3 | Fm | |
| D-minor shape | x+3 | x+2 | x+3 | x+3 | Dm | |
| A-minor (barre-style minor) | x+2 | x+2 | x+1 | x+2 | Am | |
| Barre 7th (F shape, one finger lifted) | x+1 | x+2 | x+1 | x+3 | F7 | x = 2 → G7 (3 4 3 5) |

- For the same chord, the **D shape sits four frets above the F shape** (G: F shape at 5-4-3-5, D shape at 9-7-8-9).
- The chord finder (`PLAN.md` § Fretboard) should generate voicings by computing chord tones across the neck, not from this table alone. Use the table as a test oracle: the generator must find each of these shapes.
- Validate every generated voicing for reach (4-fret span, 4 fingers, open strings free) and reject voicings missing the root or third.

### 8.3 Backup ("vamping")

When the banjo accompanies a singer rather than taking a lead break, it often **vamps**: short, muted chord chops on beats 2 and 4 using the closed F, D and barre shapes up the neck, switching between F and D shapes for smooth chord changes. Rolling backup (rolls on the chord, quieter, no melody) is the other common approach. Both would make good extra playback modes later; not in the current plan.

---

## 9. Keys, capo and transposition

| Key | Usual approach in open G | 5th string |
| --- | --- | --- |
| G | No capo | g (open) |
| A | Capo 2, play G shapes | a: spike at 7 or tune up 2 |
| B♭ | Capo 3, play G shapes | b♭: tune up 3 (no standard spike) |
| B | Capo 4, play G shapes | b: spike at 9 |
| C | Capo 5, play G shapes; or play C-position chords in open G | c: spike at 10 (if capoed) |
| D | Play D-position chords in open G; or retune to open D | Usually left at g, or tuned to a (open D tuning uses f♯) |
| E | Capo 2, play D position | Raise 2 |

- The app's default (per `PLAN.md`) is: **notation and chord symbols in the sounding key; tab in G-shape positions with a capo instruction.**
- Capo math: sounding pitch = tab pitch + capo semitones, for strings 1–4. For the 5th string, sounding pitch = open 5th + its own raise.
- Keys outside the table: choose the capo fret that makes the key a G-shape key, unless that fret is above 7 (awkward); then fall back to a D-position or C-position arrangement and say so.

---

## 10. Tab and notation conventions

- **Banjo tab has 5 lines. The top line is the 1st string** (highest-pitched full string); the bottom line is the 5th string. This is the usual bluegrass convention; it's opposite to the instrument's physical orientation when held, so don't flip it.
- Numbers on the lines are frets; `0` is open.
- **Rhythm** is shown with stems and beams below the tab (eighth notes beamed in groups of 4 or 8).
- **Right-hand finger letters (T, I, M)** go under each note. In this app they're also color-coded with a color-blind-safe palette and always shown as letters too.
- **Slurs**: a curved line between the two notes with `h`, `p`, `sl` (or `/` and `\`) or `ch` above it.
- **Pinches**: notes stacked vertically in the same slot.
- **Left-hand finger numbers**, if shown, go above the tab staff (optional, later).
- **Melody notes** are shown in bold in this app (an app convention, not a universal one).

---

## 11. Data model sketch (TypeScript)

```ts
type Finger = "T" | "I" | "M";
type Technique = "pick" | "hammer" | "pull" | "slide-up" | "slide-down" | "choke";

interface TabNote {
  slot: number;          // 0..7 within the measure (8 eighth notes)
  string: 1 | 2 | 3 | 4 | 5;
  fret: number;          // 0 = open; 5th string fretted >= 6
  finger: Finger | null; // null for slurred notes (technique !== "pick")
  technique: Technique;
  isMelody: boolean;
  pinchGroup?: number;   // notes sharing a pinchGroup in the same slot sound together
}

interface ArrangedMeasure {
  rollName: string;      // e.g. "forward", "alternating-thumb", or "forward+backward" for half-rolls
  chord: string;         // e.g. "G", "C", "D7"; half-measure chords via two measures' worth of metadata
  notes: TabNote[];
}

interface Tuning {
  name: string;          // "Open G"
  openMidi: [number, number, number, number, number]; // strings 1..5: [62, 59, 55, 50, 67]
}
```

Keep the validator (§4.1) as a pure function: `validate(measures: ArrangedMeasure[], tuning, capo) => Violation[]`, and unit-test it against every roll in §5 and every chord in §8.

---

## 12. Out of scope (for now)

- **Clawhammer / frailing**: a different technique (down-strokes with the back of the nail, thumb on the 5th string off the beat). Different rules entirely; it would need its own guide.
- **Melodic (Keith) style**: plays scales with each consecutive note on a different string, using notes far up the neck on low strings. It breaks the Scruggs "chord shape + rolls" model.
- **Single-string (Reno) style**: thumb and index alternating on one string, like flatpicking.

---

## 13. Glossary

- **Break**: an instrumental solo section.
- **Roll**: a repeating 8-note right-hand pattern.
- **Pinch**: two or more strings picked at once.
- **Drone**: the open 5th string, used as a constant high G.
- **Lick**: a short stock phrase; **fill-in lick**: one used where the melody holds; **tag**: the ending phrase.
- **Down the neck / up the neck**: first position (frets 0–4) vs higher positions using movable shapes.
- **Vamping**: chopped, muted backup chords on the off-beats.
- **Spike**: a small hook on the fingerboard that capoes the 5th string.

---

## Sources

- [Bluegrass Banjo For Dummies: Roll patterns on the banjo](https://www.dummies.com/article/roll-patterns-on-the-banjo-155951): roll finger sequences and string orders.
- [Bluegrass Banjo For Dummies: Scruggs, melodic and single-string styles](https://dummies.com/article/academics-the-arts/music/instruments/banjo/playing-scruggs-melodic-and-single-string-banjo-a-bluegrass-crash-course-158282): "a different right-hand finger consecutively for each eighth note".
- [Bluegrass Banjo For Dummies: Creating your own solos](https://dummies.com/article/how-to-create-your-own-bluegrass-banjo-solos-158299): building breaks from melody and rolls.
- [Bluegrass Banjo For Dummies: Up-the-neck chords](https://dummies.com/art-center/music/banjo/mapping-out-up-the-neck-chords-on-the-bluegrass-banjo) and [vamping with F and D shapes](https://dummies.com/article/how-to-vamp-with-f-and-d-shapes-on-the-bluegrass-banjo-143067): movable shapes.
- [ArtistWorks: Banjo Roll Trainer](https://go.artistworks.com/banjo-roll-trainer): Foggy Mountain roll pattern.
- [Banjo Hangout: which finger plays the 3rd string](https://www.banjohangout.org/topic/409119): finger-string conventions.
- [Wikipedia: Banjo roll](https://en.wikipedia.org/wiki/Banjo_roll).

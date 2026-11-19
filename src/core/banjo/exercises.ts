// F15 · Roll exercises (DEVELOPMENT.md F15): each roll on open strings first (right hand
// only), then over G–C–D, G–C–G–D and G–Em–C–D. Generated with the roll fixed via C6 and
// checked by C4; the notation shows the roll's own notes so both staves agree.
//
// Each progression is a part (P: label), so the part loops (F26) loop one progression and
// the section loop (F8) can hold a single measure.

import { formatNoteName } from "../music/notes.ts";
import type { NoteName } from "../music/notes.ts";
import { spellInKey } from "../music/spelling.ts";
import { parseKey } from "../music/keys.ts";
import { indexAbc } from "../song/abcIndex.ts";
import type { Song } from "../song/song.ts";
import { SONG_SCHEMA_VERSION } from "../song/song.ts";
import { serializeTab } from "../tab/tabText.ts";
import { chordPitchClasses, parseChord } from "../music/chords.ts";
import { scalePitchClasses } from "../music/keys.ts";
import { mod12 } from "../music/notes.ts";
import { arrange, droneClashes } from "./arranger.ts";
import type { RollTemplate } from "./rolls.ts";
import { ROLLS, rollById, rollSlice, rollTitle } from "./rolls.ts";
import { OPEN_G, pitchAt } from "./tuning.ts";
import type { ArrangedMeasure, StringNo } from "./types.ts";
import { isLegal } from "./validator.ts";

export const EXERCISE_PROGRESSIONS: readonly {
  label: string;
  name: string;
  chords: readonly string[];
}[] = [
  { label: "A", name: "Open strings", chords: ["G", "G"] },
  { label: "B", name: "G–C–D", chords: ["G", "C", "D", "G"] },
  { label: "C", name: "G–C–G–D", chords: ["G", "C", "G", "D"] },
  { label: "D", name: "G–Em–C–D", chords: ["G", "Em", "C", "D"] },
];

/**
 * The chords he can choose for a measure, as G-shape names. First the chords of the key; then the
 * dominant sevenths: D7 is the one that leads home to G, and the rest follow the circle of
 * fifths (each seventh chord leads to the next one: B7 to E7 to A7 to D7 to G7 to C7).
 */
export const EXERCISE_CHORD_CHOICES: readonly {
  chord: string;
  degree: string;
  group: "key" | "seventh";
}[] = [
  { chord: "G", degree: "I", group: "key" },
  { chord: "Am", degree: "ii", group: "key" },
  { chord: "Bm", degree: "iii", group: "key" },
  { chord: "C", degree: "IV", group: "key" },
  { chord: "D", degree: "V", group: "key" },
  { chord: "Em", degree: "vi", group: "key" },
  { chord: "F", degree: "♭VII", group: "key" },
  { chord: "D7", degree: "V7", group: "seventh" },
  { chord: "G7", degree: "I7", group: "seventh" },
  { chord: "C7", degree: "IV7", group: "seventh" },
  { chord: "A7", degree: "II7", group: "seventh" },
  { chord: "E7", degree: "VI7", group: "seventh" },
  { chord: "B7", degree: "III7", group: "seventh" },
];
/** Chords per measure, chosen by him: measure position (0-based, whole exercise) → chord. */
export type ChordOverrides = Readonly<Record<string, string>>;

/** The first part is open strings, right hand only: its chords aren't changeable. */
export const OPEN_STRING_MEASURES = EXERCISE_PROGRESSIONS[0]!.chords.length;
export const EXERCISE_MEASURES = EXERCISE_PROGRESSIONS.reduce((n, p) => n + p.chords.length, 0);

/** True for chord choices that are usable: each key a changeable measure, each chord on offer. */
export function validChordOverrides(v: unknown): v is ChordOverrides {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  return Object.entries(v).every(([k, c]) => {
    const i = Number(k);
    return (
      Number.isInteger(i) &&
      String(i) === k &&
      i >= OPEN_STRING_MEASURES &&
      i < EXERCISE_MEASURES &&
      EXERCISE_CHORD_CHOICES.some((o) => o.chord === c)
    );
  });
}

/** The chord at a measure position: his choice, or the exercise's own. */
export function exerciseChordAt(chosen: ChordOverrides, position: number): string {
  let pos = 0;
  for (const p of EXERCISE_PROGRESSIONS) {
    for (const c of p.chords) if (pos++ === position) return chosen[String(position)] ?? c;
  }
  return "G";
}

export const EXERCISE_ID_PREFIX = "exercise:";
export const LESSON_ID_PREFIX = "lesson:";
/** The tempo a roll's lesson starts at: slow, while the pattern is new (F36). */
export const LESSON_START_BPM = 60;

/** The roll a song id belongs to, whether it is the full exercise or its two-measure lesson. */
export function rollIdOfSong(id: string | null | undefined): string | null {
  if (!id) return null;
  if (id.startsWith(EXERCISE_ID_PREFIX)) return id.slice(EXERCISE_ID_PREFIX.length);
  if (id.startsWith(LESSON_ID_PREFIX)) return id.slice(LESSON_ID_PREFIX.length);
  return null;
}
export const isLessonSongId = (id: string | null | undefined): boolean =>
  id?.startsWith(LESSON_ID_PREFIX) ?? false;

/** True when a chord is one he can choose (the same list as in the exercise). */
export const isChordChoice = (c: unknown): c is string =>
  EXERCISE_CHORD_CHOICES.some((o) => o.chord === c);

const G_KEY = parseKey("G")!;
const G_SCALE = scalePitchClasses(G_KEY);

/**
 * A measure of the roll on its own strings (the pattern its source teaches, e.g. the Foggy
 * Mountain roll's 2 1 2 1 5 2 1 5), each fretted on a chord tone: the chord shape held under
 * the roll. The thumb takes the 4th string where the open 5th would clash with the chord.
 * The arranger only picks strings by its own preferences (the thumb on the 5th), which changed
 * the patterns; its measure is kept wherever the roll's strings would break a C4 rule.
 */
function onRollStrings(
  m: ArrangedMeasure,
  roll: RollTemplate,
  prev: ArrangedMeasure | undefined,
): ArrangedMeasure {
  const chord = parseChord(m.chords[0]?.chord ?? "G");
  if (!chord || m.chords.length !== 1 || m.notes.length !== m.slots) return m;
  const pcs = chordPitchClasses(chord);
  const fingers = rollSlice(roll.fingers, m.slots);
  const strings = rollSlice(roll.exampleStrings, m.slots);
  const clash = droneClashes(pitchAt(OPEN_G, 5, 0), pcs, G_SCALE);
  const fretOn = (s: StringNo): number | null => {
    if (s === 5) return 0;
    for (let fret = 0; fret <= 4; fret++) if (pcs.has(mod12(pitchAt(OPEN_G, s, fret)))) return fret;
    return null;
  };
  const notes = [];
  for (let slot = 0; slot < m.slots; slot++) {
    const s: StringNo = strings[slot] === 5 && clash ? 4 : strings[slot]!;
    const fret = fretOn(s);
    if (fret === null) return m;
    notes.push({
      slot,
      durationSlots: 1,
      string: s,
      fret,
      finger: fingers[slot]!,
      technique: "pick" as const,
      isMelody: false,
      isAccent: m.notes.find((n) => n.slot === slot)?.isAccent ?? false,
    });
  }
  const out: ArrangedMeasure = { ...m, notes };
  return isLegal(prev ? [prev, out] : [out]) ? out : m;
}

/** Every measure of an exercise or lesson on the roll's own strings, where the rules allow. */
function rollStrings(measures: readonly ArrangedMeasure[], roll: RollTemplate): ArrangedMeasure[] {
  const out: ArrangedMeasure[] = [];
  for (const m of measures) out.push(onRollStrings(m, roll, out.at(-1)));
  return out;
}

/** ABC pitch for a written MIDI note in G (key signature has F♯). */
function abcPitch(midi: number): string {
  const n: NoteName = spellInKey(midi, G_KEY);
  const octave = Math.floor((midi - n.accidental - letterPc(n.letter)) / 12) - 1;
  const acc =
    n.letter === "F"
      ? n.accidental === 1
        ? ""
        : "="
      : n.accidental === 1
        ? "^"
        : n.accidental === -1
          ? "_"
          : "";
  const letter =
    octave >= 5
      ? n.letter.toLowerCase() + "'".repeat(octave - 5)
      : n.letter + ",".repeat(4 - octave);
  return acc + letter;
}

function letterPc(l: string): number {
  return { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[l] ?? 0;
}

/** The exercise song for a roll: tab via C6 with the roll fixed, notation from the tab. */
export function rollExercise(rollId: string, chosen: ChordOverrides = {}): Song | null {
  const roll = rollById(rollId);
  if (!roll) return null;
  // His chord for a measure replaces the default one (not in the open-strings part).
  const overrides = validChordOverrides(chosen) ? chosen : {};
  let pos = 0;
  const progressions = EXERCISE_PROGRESSIONS.map((p) => ({
    ...p,
    chords: p.chords.map((c) => overrides[String(pos++)] ?? c),
  }));
  // 1. Chords only (rests for melody), arranged with the roll forced on every measure.
  const chordsOnly = progressions
    .map((p) => `P:${p.label}\n` + p.chords.map((c) => `"${c}"z8`).join("|") + "|")
    .join("\n");
  const header = `X:1\nT:${rollTitle(roll)}\nM:4/4\nL:1/8\nQ:1/4=80\nK:G\n`;
  const idx = indexAbc(header + chordsOnly);
  const rollFor = new Map(idx.measures.map((m) => [m.index, roll.id]));
  // The roll as its source teaches it (the Foggy Mountain roll keeps its thumb on the 2nd
  // string), not the beginner lanes used for songs.
  const result = arrange(idx, { overrides: rollFor, level: "experienced" });
  // Open-strings part: right hand only, every note open.
  const measures = rollStrings(result.arrangement.measures, roll).map((m, i) =>
    i < EXERCISE_PROGRESSIONS[0]!.chords.length
      ? { ...m, notes: m.notes.map((n) => ({ ...n, fret: 0, technique: "pick" as const })) }
      : m,
  );
  // 2. Notation from the tab: each slot's note as written (an octave above sounding).
  let at = 0;
  const body = progressions
    .map((p) => {
      const bars = p.chords.map((c) => {
        const m = measures[at++]!;
        const notes = Array.from({ length: m.slots }, (_, slot) => {
          const here = m.notes.filter((n) => n.slot === slot);
          if (here.length === 0) return "x";
          const top = here.reduce((a, b) =>
            pitchAt(OPEN_G, a.string, a.fret) >= pitchAt(OPEN_G, b.string, b.fret) ? a : b,
          );
          return abcPitch(pitchAt(OPEN_G, top.string, top.fret) + 12);
        });
        // Beam in fours.
        return `"${c}"${notes.slice(0, 4).join("")} ${notes.slice(4).join("")}`;
      });
      return `P:${p.label}\n${bars.join("|")}|`;
    })
    .join("\n");
  const abc = `${header.replace("T:", "T:")}${body.replace(/\|$/, "|]")}\n`;
  return {
    schemaVersion: SONG_SCHEMA_VERSION,
    id: `exercise:${roll.id}`,
    title: rollTitle(roll),
    source: "builtin",
    abc,
    tab: serializeTab(measures),
    tags: ["exercise"],
    credit: roll.use,
  };
}

/**
 * The roll's lesson: two measures of one chord, the roll on every slot. It is a song of its own
 * (so tempo, count-in and the transport are the ones he already knows) that repeats until stopped.
 */
export function rollLesson(rollId: string, chord = "G"): Song | null {
  const roll = rollById(rollId);
  if (!roll) return null;
  const c = isChordChoice(chord) ? chord : "G";
  const header = `X:1
T:${rollTitle(roll)}
M:4/4
L:1/8
Q:1/4=${LESSON_START_BPM}
K:G
`;
  const idx = indexAbc(header + `"${c}"z8|"${c}"z8|`);
  const rollFor = new Map(idx.measures.map((m) => [m.index, roll.id]));
  const measures = rollStrings(
    arrange(idx, { overrides: rollFor, level: "experienced" }).arrangement.measures,
    roll,
  );
  const bars = measures.map((m) => {
    const notes = Array.from({ length: m.slots }, (_, slot) => {
      const here = m.notes.filter((n) => n.slot === slot);
      if (here.length === 0) return "x";
      const top = here.reduce((a, b) =>
        pitchAt(OPEN_G, a.string, a.fret) >= pitchAt(OPEN_G, b.string, b.fret) ? a : b,
      );
      return abcPitch(pitchAt(OPEN_G, top.string, top.fret) + 12);
    });
    return `"${c}"${notes.slice(0, 4).join("")} ${notes.slice(4).join("")}`;
  });
  return {
    schemaVersion: SONG_SCHEMA_VERSION,
    id: `${LESSON_ID_PREFIX}${roll.id}`,
    title: rollTitle(roll),
    source: "builtin",
    abc: `${header}${bars.join("|")}|]
`,
    tab: serializeTab(measures),
    tags: ["lesson"],
    credit: roll.use,
  };
}

export function allRollLessons(): Song[] {
  return ROLLS.map((r) => rollLesson(r.id)).filter((s): s is Song => s !== null);
}

export function allRollExercises(): Song[] {
  return ROLLS.map((r) => rollExercise(r.id)).filter((s): s is Song => s !== null);
}

/** For tests: the note name of a fretted pitch (helps readable assertions). */
export function noteNameAt(string: 1 | 2 | 3 | 4 | 5, fret: number): string {
  return formatNoteName(spellInKey(pitchAt(OPEN_G, string, fret), G_KEY));
}

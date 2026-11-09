// C1 · Keys, modes and key signatures.

import type { AccidentalStyle, NoteName } from "./notes.ts";
import { formatNoteName, noteAt, parseNoteName } from "./notes.ts";

export type Mode = "major" | "minor" | "dorian" | "mixolydian";

export const MODES: readonly Mode[] = ["major", "minor", "dorian", "mixolydian"];

export interface Key {
  readonly tonic: NoteName;
  readonly mode: Mode;
}

/** How to get from a mode's tonic to its relative major tonic: letters and semitones. */
const RELATIVE_MAJOR: Readonly<Record<Mode, { letters: number; semitones: number }>> = {
  major: { letters: 0, semitones: 0 },
  minor: { letters: 2, semitones: 3 }, // A minor → C major
  dorian: { letters: -1, semitones: -2 }, // A Dorian → G major
  mixolydian: { letters: 3, semitones: 5 }, // A Mixolydian → D major
};

const LETTER_FIFTHS: Readonly<Record<string, number>> = {
  F: -1,
  C: 0,
  G: 1,
  D: 2,
  A: 3,
  E: 4,
  B: 5,
};

export function relativeMajorTonic(key: Key): NoteName {
  const r = RELATIVE_MAJOR[key.mode];
  return noteAt(key.tonic, r.letters, r.semitones);
}

/** Key signature as a count on the circle of fifths: +n sharps, -n flats. */
export function keySignature(key: Key): number {
  const t = relativeMajorTonic(key);
  return (LETTER_FIFTHS[t.letter] ?? 0) + 7 * t.accidental;
}

const MODE_ALIASES: Readonly<Record<string, Mode>> = {
  "": "major",
  maj: "major",
  major: "major",
  ion: "major",
  ionian: "major",
  m: "minor",
  min: "minor",
  minor: "minor",
  aeo: "minor",
  aeolian: "minor",
  dor: "dorian",
  dorian: "dorian",
  mix: "mixolydian",
  mixolydian: "mixolydian",
};

const KEY_RE = /^([A-Ga-g](?:##|bb|#|b|♯|♭)?)\s*([A-Za-z]*)$/u;

/** Parses ABC-style keys: "G", "Am", "AMix", "ADor", "Bb", "F# minor", "E dorian". */
export function parseKey(text: string): Key | null {
  const m = KEY_RE.exec(text.trim());
  if (!m || m[1] === undefined) return null;
  const tonic = parseNoteName(m[1]);
  // "m" is case-sensitive in ABC ("Am"); other mode names are not.
  const rawMode = m[2] ?? "";
  const mode = rawMode === "m" ? "minor" : MODE_ALIASES[rawMode.toLowerCase()];
  if (!tonic || mode === undefined) return null;
  return { tonic, mode };
}

const MODE_LABEL: Readonly<Record<Mode, string>> = {
  major: "major",
  minor: "minor",
  dorian: "Dorian",
  mixolydian: "Mixolydian",
};

/** "A Mixolydian", "E minor", "B♭ major". */
export function formatKey(key: Key, style: AccidentalStyle = "unicode"): string {
  return `${formatNoteName(key.tonic, style)} ${MODE_LABEL[key.mode]}`;
}

const ABC_MODE: Readonly<Record<Mode, string>> = {
  major: "",
  minor: "m",
  dorian: "Dor",
  mixolydian: "Mix",
};

/** ABC K: field value, e.g. "AMix", "Em", "Bb". */
export function toAbcKey(key: Key): string {
  return formatNoteName(key.tonic, "ascii") + ABC_MODE[key.mode];
}

export function sameKey(a: Key, b: Key): boolean {
  return (
    a.mode === b.mode &&
    a.tonic.letter === b.tonic.letter &&
    a.tonic.accidental === b.tonic.accidental
  );
}

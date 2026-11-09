// C1 · Chord symbols: parse, format, pitch classes, transposition.

import type { Key } from "./keys.ts";
import type { AccidentalStyle, NoteName } from "./notes.ts";
import { formatNoteName, mod12, parseNoteName, pitchClass } from "./notes.ts";
import { transposeNote } from "./spelling.ts";

export interface ChordQuality {
  readonly id: string;
  /** Canonical symbol suffix, unicode accidentals (e.g. "m7♭5"). */
  readonly symbol: string;
  /** Semitones above the root. */
  readonly intervals: readonly number[];
  /**
   * Tones a voicing must contain (C7). Triads need root and third; 7th chords need root
   * and 7th, with the third optional and labeled "no 3rd" (the guide's D7 0-2-1-0 has no F♯).
   */
  readonly required: readonly number[];
}

export const QUALITIES: readonly ChordQuality[] = [
  { id: "maj", symbol: "", intervals: [0, 4, 7], required: [0, 4] },
  { id: "min", symbol: "m", intervals: [0, 3, 7], required: [0, 3] },
  { id: "7", symbol: "7", intervals: [0, 4, 7, 10], required: [0, 10] },
  { id: "m7", symbol: "m7", intervals: [0, 3, 7, 10], required: [0, 10] },
  { id: "maj7", symbol: "maj7", intervals: [0, 4, 7, 11], required: [0, 11] },
  { id: "6", symbol: "6", intervals: [0, 4, 7, 9], required: [0, 4, 9] },
  { id: "m6", symbol: "m6", intervals: [0, 3, 7, 9], required: [0, 3, 9] },
  { id: "9", symbol: "9", intervals: [0, 4, 7, 10, 2], required: [0, 10, 2] },
  { id: "add9", symbol: "add9", intervals: [0, 4, 7, 2], required: [0, 4, 2] },
  { id: "sus4", symbol: "sus4", intervals: [0, 5, 7], required: [0, 5] },
  { id: "sus2", symbol: "sus2", intervals: [0, 2, 7], required: [0, 2] },
  { id: "7sus4", symbol: "7sus4", intervals: [0, 5, 7, 10], required: [0, 5, 10] },
  { id: "dim", symbol: "dim", intervals: [0, 3, 6], required: [0, 3, 6] },
  { id: "dim7", symbol: "dim7", intervals: [0, 3, 6, 9], required: [0, 3, 6] },
  { id: "m7b5", symbol: "m7♭5", intervals: [0, 3, 6, 10], required: [0, 3, 6] },
  { id: "aug", symbol: "aug", intervals: [0, 4, 8], required: [0, 4, 8] },
];

const QUALITY_BY_ID = new Map(QUALITIES.map((q) => [q.id, q]));

/** Accepted spellings (after ♭→b, ♯→# normalization) → quality id. */
const ALIASES: Readonly<Record<string, string>> = {
  "": "maj",
  M: "maj",
  maj: "maj",
  m: "min",
  min: "min",
  "-": "min",
  "7": "7",
  dom7: "7",
  m7: "m7",
  min7: "m7",
  "-7": "m7",
  maj7: "maj7",
  M7: "maj7",
  "Δ": "maj7",
  "Δ7": "maj7",
  "6": "6",
  m6: "m6",
  min6: "m6",
  "9": "9",
  add9: "add9",
  sus: "sus4",
  sus4: "sus4",
  sus2: "sus2",
  "7sus4": "7sus4",
  "7sus": "7sus4",
  dim: "dim",
  "°": "dim",
  o: "dim",
  dim7: "dim7",
  "°7": "dim7",
  o7: "dim7",
  m7b5: "m7b5",
  min7b5: "m7b5",
  "-7b5": "m7b5",
  "ø": "m7b5",
  "ø7": "m7b5",
  aug: "aug",
  "+": "aug",
};

export interface Chord {
  readonly root: NoteName;
  readonly quality: ChordQuality;
  readonly bass?: NoteName;
}

const CHORD_RE = /^([A-G](?:#|b)?)(.*?)(?:\/([A-G](?:#|b)?))?$/;

/** Parses chord symbols such as "G", "Bb", "B♭", "D7", "Em", "C♯m7♭5", "G/B". */
export function parseChord(text: string): Chord | null {
  const normalized = text.trim().replace(/♭/g, "b").replace(/♯/g, "#");
  const m = CHORD_RE.exec(normalized);
  if (!m || m[1] === undefined) return null;
  const root = parseNoteName(m[1]);
  const qualityId = ALIASES[m[2] ?? ""];
  const quality = qualityId === undefined ? undefined : QUALITY_BY_ID.get(qualityId);
  if (!root || !quality) return null;
  if (m[3] !== undefined) {
    const bass = parseNoteName(m[3]);
    if (!bass) return null;
    return { root, quality, bass };
  }
  return { root, quality };
}

export function formatChord(chord: Chord, style: AccidentalStyle = "unicode"): string {
  const symbol = style === "ascii" ? chord.quality.symbol.replace(/♭/g, "b") : chord.quality.symbol;
  const bass = chord.bass ? `/${formatNoteName(chord.bass, style)}` : "";
  return formatNoteName(chord.root, style) + symbol + bass;
}

export function chordPitchClasses(chord: Chord): Set<number> {
  const root = pitchClass(chord.root);
  const pcs = new Set(chord.quality.intervals.map((i) => mod12(root + i)));
  if (chord.bass) pcs.add(pitchClass(chord.bass));
  return pcs;
}

export function requiredPitchClasses(chord: Chord): Set<number> {
  const root = pitchClass(chord.root);
  return new Set(chord.quality.required.map((i) => mod12(root + i)));
}

export function transposeChord(chord: Chord, semitones: number, toKey: Key): Chord {
  const root = transposeNote(chord.root, semitones, toKey);
  if (chord.bass) {
    return { root, quality: chord.quality, bass: transposeNote(chord.bass, semitones, toKey) };
  }
  return { root, quality: chord.quality };
}

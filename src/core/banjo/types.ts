// C5 · Arrangement model (DEVELOPMENT.md §3 C5, style guide §11 with the rev-2 changes).

import type { Key } from "../music/keys.ts";

export type StringNo = 1 | 2 | 3 | 4 | 5;
export type Finger = "T" | "I" | "M";
export type Technique = "pick" | "hammer" | "pull" | "slide-up" | "slide-down" | "choke";

export const FINGERS: readonly Finger[] = ["T", "I", "M"];
export const STRINGS: readonly StringNo[] = [1, 2, 3, 4, 5];

export const FINGER_NAME: Readonly<Record<Finger, string>> = {
  T: "Thumb",
  I: "Index finger",
  M: "Middle finger",
};

export interface TabNote {
  /** 0-based slot within the measure (one slot = one roll note). The UI shows slot + 1. */
  slot: number;
  /** How many slots the note sounds for: 1 = one roll note, 2 = twice as long, … */
  durationSlots: number;
  string: StringNo;
  /** Capo-relative fret (DEVELOPMENT.md C2). 0 = open; a fretted 5th string is ≥ 6. */
  fret: number;
  /** null if and only if technique !== "pick". */
  finger: Finger | null;
  technique: Technique;
  isMelody: boolean;
  isAccent: boolean;
  /** Notes in the same slot with the same pinchGroup are struck together. */
  pinchGroup?: number;
}

export interface MeasureChord {
  /** 0-based slot where the chord starts. */
  atSlot: number;
  /** Chord symbol as written, e.g. "G", "D7", "Bb". */
  chord: string;
}

export type MeasureSource = "hand" | "generated" | "override";

export interface ArrangedMeasure {
  /** Written measure number; 0 = pickup. */
  index: number;
  /** Slots in this measure: normally 8; fewer for a pickup. */
  slots: number;
  chords: MeasureChord[];
  /** "forward", "alternating-thumb", "forward+backward", "tag", "lick:<id>", … */
  rollName: string;
  source: MeasureSource;
  /** The measure ends a phrase, so silent slots are allowed (H6). */
  phraseEnd?: boolean;
  notes: TabNote[];
}

export interface Arrangement {
  schemaVersion: number;
  /** The key the tab shapes are in (usually G). */
  shapeKey: Key;
  /** Per-song 5th-string choice where there is one, e.g. "b" for the key of E. */
  fifthStringDefault?: string;
  measures: ArrangedMeasure[];
}

export const ARRANGEMENT_SCHEMA_VERSION = 1;

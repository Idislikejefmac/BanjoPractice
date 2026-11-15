// C3 · Roll library (style guide §5). Each roll is a finger template; the arranger chooses
// strings and frets to fit the melody. Example strings are the usual ones over open G.
//
// Where each roll comes from (`sources`): three instructors are first tier, chosen by Jeff
// because Dad plays and trusts them: Deering ("The Four Essential 5-String Banjo Rolls",
// blog.deeringbanjos.com, L. Witt, 2023), Jens Kruger and Tony Trischka (ArtistWorks). A roll
// lists every first-tier source that describes it the same way. Where other tutorials differ,
// the first-tier version is the roll of that name and the other version is kept under a name that
// says how it differs. A roll with source "app" is our own label: no published source was found.

import type { ArrangedMeasure, Finger, StringNo, TabNote } from "./types.ts";

/**
 * Where a roll's pattern comes from. Deering, Jens Kruger and Tony Trischka are first tier; then
 * tutorial sites; then our own label. A roll names a source only when that instructor states the
 * pattern (checked against the transcripts of their videos, see the compendium notes).
 */
export type RollSource = "deering" | "jens-kruger" | "tony-trischka" | "tutorials" | "app";

export const ROLL_SOURCE_LABEL: Readonly<Record<RollSource, string>> = {
  deering: "Deering, The Four Essential 5-String Banjo Rolls",
  "jens-kruger": "Jens Kruger",
  "tony-trischka": "Tony Trischka (ArtistWorks)",
  tutorials: "tutorial sites (not a first-tier instructor)",
  app: "this app's own pattern (no published source found)",
};

/** The short form shown beside a roll's name: "Forward roll (Deering)". */
export const ROLL_SOURCE_SHORT: Readonly<Record<RollSource, string>> = {
  deering: "Deering",
  "jens-kruger": "Jens Kruger",
  "tony-trischka": "Tony Trischka",
  tutorials: "tutorial sites",
  app: "our own pattern",
};

export interface RollTemplate {
  readonly id: string;
  readonly name: string;
  readonly fingers: readonly Finger[];
  readonly exampleStrings: readonly StringNo[];
  /** 0-based accented slots. Forward rolls group 3+3+2 (slots 1, 4, 7); others the downbeats. */
  readonly accents: readonly number[];
  readonly use: string;
  /** Every source that describes this roll the same way, first-tier ones first. */
  readonly sources: readonly RollSource[];
}

const FORWARD_ACCENTS = [0, 3, 6] as const;
const DOWNBEAT_ACCENTS = [0, 2, 4, 6] as const;

export const ROLLS: readonly RollTemplate[] = [
  {
    // Deering: index, middle, thumb, repeated, ending index-middle (strings 2 1 5 2 1 5 2 1); "the
    // first two notes can be moved to the end", which gives this thumb-first form, 3+3+2.
    id: "forward",
    name: "Forward",
    fingers: ["T", "I", "M", "T", "I", "M", "I", "M"],
    exampleStrings: [5, 2, 1, 5, 2, 1, 2, 1],
    accents: FORWARD_ACCENTS,
    use: "The simplest roll: a rising pattern, bubbly and bright",
    sources: ["deering"],
  },
  {
    // The forward roll most tab books print: the same, ending on the thumb.
    id: "forward-thumb-ending",
    name: "Forward (thumb ending)",
    fingers: ["T", "I", "M", "T", "I", "M", "T", "M"],
    exampleStrings: [3, 2, 1, 5, 2, 1, 5, 1],
    accents: FORWARD_ACCENTS,
    use: "The core Scruggs drive, with a firmer thumb ending",
    sources: ["tutorials"],
  },
  {
    id: "forward-thumb-start",
    name: "Forward (thumb-start)",
    fingers: ["T", "M", "T", "I", "M", "T", "I", "M"],
    // The guide leaves this one's strings open; this is our own example over G.
    exampleStrings: [3, 1, 5, 2, 1, 5, 2, 1],
    accents: DOWNBEAT_ACCENTS,
    use: "More power from the thumb on the downbeat",
    sources: ["tutorials"],
  },
  {
    id: "backward",
    name: "Backward",
    fingers: ["M", "I", "T", "M", "I", "T", "M", "I"],
    exampleStrings: [1, 2, 5, 1, 2, 5, 1, 2],
    accents: DOWNBEAT_ACCENTS,
    use: "A falling pattern, plaintive; melody on the 1st string",
    sources: ["deering", "tony-trischka"],
  },
  {
    id: "forward-reverse",
    name: "Forward-reverse",
    fingers: ["T", "I", "M", "T", "M", "I", "T", "M"],
    exampleStrings: [3, 2, 1, 5, 1, 2, 3, 1],
    accents: DOWNBEAT_ACCENTS,
    use: "Melody on strings 1 and 3; up, then down",
    sources: ["deering", "tony-trischka", "jens-kruger"],
  },
  {
    id: "alternating-thumb",
    name: "Alternating thumb",
    fingers: ["T", "I", "T", "M", "T", "I", "T", "M"],
    exampleStrings: [3, 2, 5, 1, 4, 2, 5, 1],
    accents: DOWNBEAT_ACCENTS,
    use: "Melody on the 2nd and 3rd strings; the thumb plays every other note",
    sources: ["deering", "tony-trischka"],
  },
  {
    id: "foggy-mountain",
    name: "Foggy Mountain",
    fingers: ["I", "M", "T", "M", "T", "I", "M", "T"],
    exampleStrings: [2, 1, 2, 1, 5, 2, 1, 5],
    accents: DOWNBEAT_ACCENTS,
    use: "Thumb crosses to the 2nd string",
    sources: ["tony-trischka"],
  },
  {
    // Tony Trischka calls this the Osborne roll (after Sonny Osborne); some call it the Dillard
    // roll. The id stays "middle-leading": it is stored in songs and tabs.
    id: "middle-leading",
    name: "Osborne",
    fingers: ["M", "I", "M", "T", "M", "I", "M", "T"],
    exampleStrings: [1, 2, 1, 5, 1, 2, 1, 5],
    accents: DOWNBEAT_ACCENTS,
    use: "Melody repeated on the 1st string; also called the Dillard roll",
    sources: ["tony-trischka"],
  },
  {
    id: "index-leading",
    name: "Index-leading",
    fingers: ["I", "T", "I", "M", "I", "T", "I", "M"],
    exampleStrings: [2, 3, 2, 1, 2, 3, 2, 1],
    accents: DOWNBEAT_ACCENTS,
    use: "Melody repeated on the 2nd string",
    sources: ["app"],
  },
];

/** A roll's title with where it comes from: "Forward roll (Deering)". */
export function rollTitle(roll: RollTemplate): string {
  return `${roll.name} roll (${roll.sources.map((x) => ROLL_SOURCE_SHORT[x]).join(", ")})`;
}

/** The long form for a "Pattern from" line: every source, first tier first. */
export function rollSourceLabel(roll: RollTemplate): string {
  return roll.sources.map((x) => ROLL_SOURCE_LABEL[x]).join("; ");
}

export function rollById(id: string): RollTemplate | undefined {
  return ROLLS.find((r) => r.id === id);
}

export interface RollMeasureOptions {
  index?: number;
  chord?: string;
  /** Strings per slot; defaults to the roll's example strings. */
  strings?: readonly StringNo[];
  /** Capo-relative frets per slot; defaults to all open. */
  frets?: readonly number[];
}

function noteFor(
  slot: number,
  finger: Finger,
  string: StringNo,
  fret: number,
  accent: boolean,
): TabNote {
  return {
    slot,
    durationSlots: 1,
    string,
    fret,
    finger,
    technique: "pick",
    isMelody: false,
    isAccent: accent,
  };
}

/** One measure of a roll, e.g. for roll exercises and tests. */
export function rollMeasure(roll: RollTemplate, opts: RollMeasureOptions = {}): ArrangedMeasure {
  const strings = opts.strings ?? roll.exampleStrings;
  const frets = opts.frets ?? [];
  return {
    index: opts.index ?? 1,
    slots: roll.fingers.length,
    chords: [{ atSlot: 0, chord: opts.chord ?? "G" }],
    rollName: roll.id,
    source: "generated",
    notes: roll.fingers.map((finger, slot) =>
      noteFor(
        slot,
        finger,
        strings[slot] as StringNo,
        frets[slot] ?? 0,
        roll.accents.includes(slot),
      ),
    ),
  };
}

/**
 * A measure built from the first or second half of one roll followed by a half of another.
 * Legal only if the join passes C4 (checked by the caller).
 */
export function halfRollMeasure(
  first: RollTemplate,
  firstHalf: 0 | 1,
  second: RollTemplate,
  secondHalf: 0 | 1,
  opts: { index?: number; chord?: string } = {},
): ArrangedMeasure {
  const a = rollMeasure(first, opts).notes.slice(firstHalf * 4, firstHalf * 4 + 4);
  const b = rollMeasure(second, opts).notes.slice(secondHalf * 4, secondHalf * 4 + 4);
  const notes = [...a, ...b].map((n, slot) => ({ ...n, slot }));
  return {
    index: opts.index ?? 1,
    slots: 8,
    chords: [{ atSlot: 0, chord: opts.chord ?? "G" }],
    // e.g. "forward/1+backward/2" = first half of forward, second half of backward.
    rollName: `${first.id}/${firstHalf + 1}+${second.id}/${secondHalf + 1}`,
    source: "generated",
    notes,
  };
}

// C3 · Roll library (style guide §5). Each roll is a finger template; the arranger chooses
// strings and frets to fit the melody. Example strings are the usual ones over open G.

import type { ArrangedMeasure, Finger, StringNo, TabNote } from "./types.ts";

export interface RollTemplate {
  readonly id: string;
  readonly name: string;
  readonly fingers: readonly Finger[];
  readonly exampleStrings: readonly StringNo[];
  /** 0-based accented slots. Forward rolls group 3+3+2 (slots 1, 4, 7); others the downbeats. */
  readonly accents: readonly number[];
  readonly use: string;
}

const FORWARD_ACCENTS = [0, 3, 6] as const;
const DOWNBEAT_ACCENTS = [0, 2, 4, 6] as const;

export const ROLLS: readonly RollTemplate[] = [
  {
    id: "forward",
    name: "Forward",
    fingers: ["T", "I", "M", "T", "I", "M", "T", "M"],
    exampleStrings: [3, 2, 1, 5, 2, 1, 5, 1],
    accents: FORWARD_ACCENTS,
    use: "The core Scruggs drive",
  },
  {
    id: "forward-thumb-start",
    name: "Forward (thumb-start)",
    fingers: ["T", "M", "T", "I", "M", "T", "I", "M"],
    // The guide leaves this one's strings open; this is our own example over G.
    exampleStrings: [3, 1, 5, 2, 1, 5, 2, 1],
    accents: DOWNBEAT_ACCENTS,
    use: "More power from the thumb on the downbeat",
  },
  {
    id: "backward",
    name: "Backward",
    fingers: ["M", "I", "T", "M", "I", "T", "M", "I"],
    exampleStrings: [1, 2, 5, 1, 2, 5, 1, 2],
    accents: DOWNBEAT_ACCENTS,
    use: "Melody on the 1st string",
  },
  {
    id: "forward-reverse",
    name: "Forward-reverse",
    fingers: ["T", "I", "M", "T", "M", "I", "T", "M"],
    exampleStrings: [3, 2, 1, 5, 1, 2, 3, 1],
    accents: DOWNBEAT_ACCENTS,
    use: "Melody on strings 1 and 3",
  },
  {
    id: "alternating-thumb",
    name: "Alternating thumb",
    fingers: ["T", "I", "T", "M", "T", "I", "T", "M"],
    exampleStrings: [3, 2, 5, 1, 4, 2, 5, 1],
    accents: DOWNBEAT_ACCENTS,
    use: "Melody on the 2nd and 3rd strings",
  },
  {
    id: "foggy-mountain",
    name: "Foggy Mountain",
    fingers: ["I", "M", "T", "M", "T", "I", "M", "T"],
    exampleStrings: [2, 1, 2, 1, 5, 2, 1, 5],
    accents: DOWNBEAT_ACCENTS,
    use: "Thumb crosses to the 2nd string",
  },
  {
    id: "middle-leading",
    name: "Middle-leading",
    fingers: ["M", "I", "M", "T", "M", "I", "M", "T"],
    exampleStrings: [1, 2, 1, 5, 1, 2, 1, 5],
    accents: DOWNBEAT_ACCENTS,
    use: "Melody repeated on the 1st string",
  },
  {
    id: "index-leading",
    name: "Index-leading",
    fingers: ["I", "T", "I", "M", "I", "T", "I", "M"],
    exampleStrings: [2, 3, 2, 1, 2, 3, 2, 1],
    accents: DOWNBEAT_ACCENTS,
    use: "Melody repeated on the 2nd string",
  },
];

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

function noteFor(slot: number, finger: Finger, string: StringNo, fret: number, accent: boolean): TabNote {
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
      noteFor(slot, finger, strings[slot] as StringNo, frets[slot] ?? 0, roll.accents.includes(slot)),
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

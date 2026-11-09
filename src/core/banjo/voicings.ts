// C7 · Chord voicing generator (DEVELOPMENT.md §3 C7, style guide §8).
//
// Every playable combination of strings 1–4 (frets 0–17, capo-relative) whose notes are all
// chord tones and which contains the chord's required tones (triads: root and 3rd; 7th
// chords: root and 7th, with the 3rd optional and labeled "no 3rd"). Reach: fretted notes span
// at most 4 frets (open strings are free), at most 4 fretting fingers. Ranked open/first
// position first, then up the neck. Named movable shapes (barre, F, D, minor variants) are
// labeled. The 5th string is always the open drone, flagged as in the chord or adding color.

import type { Chord } from "../music/chords.ts";
import { chordPitchClasses, requiredPitchClasses } from "../music/chords.ts";
import { mod12, pitchClass } from "../music/notes.ts";
import type { CapoPlan, Tuning } from "./tuning.ts";
import { NO_CAPO, OPEN_G, pitchAt } from "./tuning.ts";
import type { StringNo } from "./types.ts";

export interface Voicing {
  /** Capo-relative frets for strings 1, 2, 3, 4 (index 0 = string 1). */
  readonly frets: readonly [number, number, number, number];
  /** Lowest fretted fret (0 if all open): the position on the neck. */
  readonly position: number;
  /** Named movable shape, if it is one (style guide §8.2). */
  readonly shape: string | null;
  /** A 7th chord voiced without its 3rd (e.g. D7 0-2-1-0). */
  readonly noThird: boolean;
  /** The open 5th string is a chord tone ("in chord") or not ("adds color"). */
  readonly fifthString: "in chord" | "adds color";
  /** Sounding MIDI notes of strings 1–4, for playing it. */
  readonly midi: readonly [number, number, number, number];
}

export const MAX_VOICING_FRET = 17;
const MAX_SPAN = 3; // four adjacent frets

/** Movable shapes as fret offsets for strings 4, 3, 2, 1 (style guide §8.2). */
const SHAPES: readonly { name: string; offsets: readonly [number, number, number, number] }[] = [
  { name: "Barre", offsets: [0, 0, 0, 0] },
  { name: "F shape", offsets: [3, 2, 1, 3] },
  { name: "D shape", offsets: [4, 2, 3, 4] },
  { name: "F-minor shape", offsets: [3, 1, 1, 3] },
  { name: "D-minor shape", offsets: [3, 2, 3, 3] },
  { name: "A-minor shape", offsets: [2, 2, 1, 2] },
  { name: "Barre 7th", offsets: [1, 2, 1, 3] },
];

function shapeName(frets: readonly [number, number, number, number]): string | null {
  // Strings 4, 3, 2, 1 from frets indexed by string 1..4.
  const f = [frets[3], frets[2], frets[1], frets[0]];
  for (const s of SHAPES) {
    const x = f[0]! - s.offsets[0];
    if (x < 0) continue;
    if (s.offsets.every((o, i) => f[i] === o + x) && (x > 0 || s.name !== "Barre")) {
      return s.name;
    }
  }
  return null;
}

export interface VoicingOptions {
  readonly tuning?: Tuning;
  readonly plan?: CapoPlan;
  readonly maxFret?: number;
}

export function voicings(chord: Chord, opts: VoicingOptions = {}): Voicing[] {
  const tuning = opts.tuning ?? OPEN_G;
  const plan = opts.plan ?? NO_CAPO;
  const maxFret = opts.maxFret ?? MAX_VOICING_FRET;
  const tones = chordPitchClasses(chord);
  const required = requiredPitchClasses(chord);
  const third = mod12(pitchClass(chord.root) + (chord.quality.intervals.includes(3) ? 3 : 4));
  const isSeventh = chord.quality.intervals.some((i) => i === 10 || i === 11);

  // Frets on each string that give a chord tone.
  const options: number[][] = ([1, 2, 3, 4] as StringNo[]).map((s) => {
    const out: number[] = [];
    for (let fret = 0; fret <= maxFret; fret++) {
      if (tones.has(mod12(pitchAt(tuning, s, fret, plan)))) out.push(fret);
    }
    return out;
  });

  const fifthPc = mod12(pitchAt(tuning, 5, 0, plan));
  const out: Voicing[] = [];
  for (const f1 of options[0]!) {
    for (const f2 of options[1]!) {
      for (const f3 of options[2]!) {
        for (const f4 of options[3]!) {
          const frets = [f1, f2, f3, f4] as const;
          const fretted = frets.filter((f) => f > 0);
          if (fretted.length > 0 && Math.max(...fretted) - Math.min(...fretted) > MAX_SPAN)
            continue;
          const midi = ([1, 2, 3, 4] as StringNo[]).map((s, i) =>
            pitchAt(tuning, s, frets[i]!, plan),
          ) as unknown as [number, number, number, number];
          const pcs = new Set(midi.map(mod12));
          if (![...required].every((pc) => pcs.has(pc))) continue;
          out.push({
            frets,
            position: fretted.length ? Math.min(...fretted) : 0,
            shape: shapeName(frets),
            noThird: isSeventh && !pcs.has(third),
            fifthString: tones.has(fifthPc) ? "in chord" : "adds color",
            midi,
          });
        }
      }
    }
  }

  // Open/first position first (fewest high frets), then up the neck; named shapes and
  // complete chords (with the 3rd and 5th) before partial ones at the same position.
  const score = (v: Voicing) => {
    const pcs = new Set(v.midi.map(mod12));
    const complete = [...tones].filter((pc) => pcs.has(pc)).length;
    const openCount = v.frets.filter((f) => f === 0).length;
    const mixedOpen = v.position > 4 && openCount > 0 ? 1 : 0;
    return (
      v.position * 10 +
      Math.max(...v.frets) * 2 +
      (v.shape ? -3 : 0) -
      complete +
      (v.noThird ? 2 : 0) +
      mixedOpen * 20
    );
  };
  return out.sort((a, b) => score(a) - score(b));
}

/** Sounding notes for "strum" (low to high) including the open 5th string drone. */
export function strumNotes(v: Voicing, opts: VoicingOptions = {}): number[] {
  const tuning = opts.tuning ?? OPEN_G;
  const plan = opts.plan ?? NO_CAPO;
  return [pitchAt(tuning, 5, 0, plan), v.midi[3], v.midi[2], v.midi[1], v.midi[0]];
}

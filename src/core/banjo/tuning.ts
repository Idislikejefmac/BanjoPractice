// C2 · Tuning and fretboard model (style guide §1.1, §1.2; DEVELOPMENT.md C2).

import type { StringNo } from "./types.ts";

export interface Tuning {
  readonly id: string;
  readonly name: string;
  /** Open-string MIDI numbers for strings 1..5 (index 0 = string 1). */
  readonly openMidi: readonly [number, number, number, number, number];
}

/** Open G: g D G B D (5th → 1st). Strings 1..5 = D4 B3 G3 D3 G4. */
export const OPEN_G: Tuning = { id: "open-g", name: "Open G", openMidi: [62, 59, 55, 50, 67] };
/** Later options (style guide §1.1). Tunings are data so these can be added without code. */
export const DOUBLE_C: Tuning = {
  id: "double-c",
  name: "Double C",
  openMidi: [62, 60, 55, 48, 67],
};
export const OPEN_D: Tuning = { id: "open-d", name: "Open D", openMidi: [62, 57, 54, 50, 66] };
export const G_MODAL: Tuning = {
  id: "g-modal",
  name: "G modal (sawmill)",
  openMidi: [62, 60, 55, 50, 67],
};

export const TUNINGS: readonly Tuning[] = [OPEN_G, DOUBLE_C, OPEN_D, G_MODAL];

export const MAX_FRET = 22;
/** The 5th string starts at the 5th fret. */
export const FIFTH_STRING_NUT = 5;

export interface FifthRaise {
  /** Semitones the 5th string is raised (normally equal to the capo). */
  readonly semitones: number;
  readonly by: "none" | "spike" | "retune";
  readonly spikeFret?: number;
}

export interface CapoPlan {
  readonly capo: number;
  readonly fifth: FifthRaise;
}

export const NO_CAPO: CapoPlan = { capo: 0, fifth: { semitones: 0, by: "none" } };

/** Spike frets found on many Deering banjos (a, b, c). Offered as a preset in settings. */
export const DEERING_SPIKES: readonly number[] = [7, 9, 10];

/**
 * Default spike setting: none. Dad's Goodtime Artisan isn't confirmed to have spikes, and
 * "tune the 5th string up" always works, while naming a spike he doesn't have doesn't.
 */
export const DEFAULT_SPIKES: readonly number[] = [];

/**
 * How to raise the 5th string for a capo: a spike at fret 5 + capo if there is one,
 * otherwise retune (style guide §1.2).
 */
export function fifthStringPlan(
  capo: number,
  spikes: readonly number[] = DEFAULT_SPIKES,
): FifthRaise {
  if (capo === 0) return { semitones: 0, by: "none" };
  const spikeFret = FIFTH_STRING_NUT + capo;
  if (spikes.includes(spikeFret)) return { semitones: capo, by: "spike", spikeFret };
  return { semitones: capo, by: "retune" };
}

export function capoPlan(capo: number, spikes: readonly number[] = DEFAULT_SPIKES): CapoPlan {
  return { capo, fifth: fifthStringPlan(capo, spikes) };
}

/**
 * The physical fret for a capo-relative tab fret.
 * Strings 1–4: fret + capo. 5th string: fret + raise when spiked, fret when retuned.
 * Open strings return 0 (or the spike fret for an open spiked 5th string).
 */
export function actualFret(string: StringNo, fret: number, plan: CapoPlan = NO_CAPO): number {
  if (string !== 5) return fret === 0 ? plan.capo : fret + plan.capo;
  if (plan.fifth.by === "spike") {
    return fret === 0 ? (plan.fifth.spikeFret ?? 0) : fret + plan.fifth.semitones;
  }
  return fret;
}

/** Whether a capo-relative fret exists on this string with this capo. */
export function isPlayableFret(string: StringNo, fret: number, plan: CapoPlan = NO_CAPO): boolean {
  if (!Number.isInteger(fret) || fret < 0) return false;
  if (string === 5 && fret !== 0 && fret <= FIFTH_STRING_NUT) return false;
  return actualFret(string, fret, plan) <= MAX_FRET;
}

/**
 * Sounding MIDI pitch of a capo-relative tab note.
 * Strings 1–4: open + capo + fret. 5th string: open + raise + (fret − 5 if fretted).
 * With capo-relative numbers that one formula holds for both a spike and a retune.
 */
export function pitchAt(
  tuning: Tuning,
  string: StringNo,
  fret: number,
  plan: CapoPlan = NO_CAPO,
): number {
  if (!isPlayableFret(string, fret, plan)) {
    throw new RangeError(`String ${string} has no fret ${fret} with capo ${plan.capo}`);
  }
  const open = tuning.openMidi[string - 1] as number;
  if (string === 5) return open + plan.fifth.semitones + (fret === 0 ? 0 : fret - FIFTH_STRING_NUT);
  return open + plan.capo + fret;
}

export interface FretPosition {
  readonly string: StringNo;
  readonly fret: number;
}

/** Every capo-relative (string, fret) that sounds `midi`. */
export function positionsFor(
  tuning: Tuning,
  midi: number,
  plan: CapoPlan = NO_CAPO,
): FretPosition[] {
  const out: FretPosition[] = [];
  for (const string of [1, 2, 3, 4, 5] as const) {
    for (let fret = 0; fret <= MAX_FRET; fret++) {
      if (isPlayableFret(string, fret, plan) && pitchAt(tuning, string, fret, plan) === midi) {
        out.push({ string, fret });
      }
    }
  }
  return out;
}

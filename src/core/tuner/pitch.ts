// F19 tuner core (DEVELOPMENT.md F19): pitch detection and string targets. Pure: tested on
// synthetic signals here; spike S6 checks it on a real banjo recording.
//
// YIN (de Cheveigné & Kawahara 2002): the cumulative mean normalized difference function,
// absolute threshold, parabolic interpolation. Banjo strings have strong harmonics, so the
// first dip under the threshold is taken (not the global minimum), which avoids the classic
// octave-too-high error, and very low-confidence frames are rejected.

import type { CapoPlan, Tuning } from "../banjo/tuning.ts";
import { NO_CAPO, OPEN_G, pitchAt } from "../banjo/tuning.ts";
import type { StringNo } from "../banjo/types.ts";

export interface PitchResult {
  readonly hz: number;
  /** 0–1: how periodic the frame is (1 − YIN's d′ at the chosen lag). */
  readonly clarity: number;
}

/** Banjo range with headroom: D3 (147 Hz) down to ~70 Hz, up to ~1.2 kHz. */
const MIN_HZ = 70;
const MAX_HZ = 1200;

export function detectPitch(
  samples: Float32Array,
  sampleRate: number,
  threshold = 0.12,
): PitchResult | null {
  const maxLag = Math.min(Math.floor(sampleRate / MIN_HZ), Math.floor(samples.length / 2));
  const minLag = Math.max(2, Math.floor(sampleRate / MAX_HZ));
  if (maxLag <= minLag) return null;

  // Silence check: nothing to tune.
  let energy = 0;
  for (let i = 0; i < samples.length; i++) energy += samples[i]! * samples[i]!;
  if (energy / samples.length < 1e-6) return null;

  const window = samples.length - maxLag;
  const d = new Float32Array(maxLag + 1);
  for (let tau = 1; tau <= maxLag; tau++) {
    let sum = 0;
    for (let i = 0; i < window; i++) {
      const delta = samples[i]! - samples[i + tau]!;
      sum += delta * delta;
    }
    d[tau] = sum;
  }
  // Cumulative mean normalized difference.
  const cmnd = new Float32Array(maxLag + 1);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= maxLag; tau++) {
    running += d[tau]!;
    cmnd[tau] = running > 0 ? (d[tau]! * tau) / running : 1;
  }
  // First dip under the threshold, then down to its local minimum.
  let tau = -1;
  for (let t = minLag; t <= maxLag; t++) {
    if (cmnd[t]! < threshold) {
      while (t + 1 <= maxLag && cmnd[t + 1]! < cmnd[t]!) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) return null;
  // Parabolic interpolation for sub-sample accuracy.
  let better = tau;
  if (tau > 1 && tau < maxLag) {
    const a = cmnd[tau - 1]!;
    const b = cmnd[tau]!;
    const c = cmnd[tau + 1]!;
    const denom = a + c - 2 * b;
    if (denom !== 0) better = tau + (a - c) / (2 * denom);
  }
  return { hz: sampleRate / better, clarity: Math.max(0, Math.min(1, 1 - cmnd[tau]!)) };
}

export function hzToMidi(hz: number): number {
  return 69 + 12 * Math.log2(hz / 440);
}

export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export interface StringTarget {
  readonly string: StringNo;
  readonly midi: number;
  readonly hz: number;
}

/**
 * The open-string pitches to tune to (F19): with the capo plan, so a 5th string raised to a
 * gets target a, and "capo on" tunes to the capoed pitches.
 */
export function stringTargets(tuning: Tuning = OPEN_G, plan: CapoPlan = NO_CAPO): StringTarget[] {
  return ([1, 2, 3, 4, 5] as StringNo[]).map((s) => {
    const midi = pitchAt(tuning, s, 0, plan);
    return { string: s, midi, hz: midiToHz(midi) };
  });
}

export interface TunerReading {
  readonly target: StringTarget;
  /** Cents sharp (+) or flat (−) of the target. */
  readonly cents: number;
}

/**
 * Which string is being tuned (or the locked one) and how far off it is. Octave slips are
 * folded: a reading an octave from every target is compared an octave over.
 */
export function readString(
  hz: number,
  targets: readonly StringTarget[],
  locked?: StringNo,
): TunerReading {
  const m = hzToMidi(hz);
  const pool = locked ? targets.filter((t) => t.string === locked) : targets;
  let best: TunerReading | null = null;
  for (const t of pool) {
    // Fold within ±6 semitones of the target when locked (octave errors), else compare as-is.
    let diff = m - t.midi;
    if (locked) diff = ((((diff + 6) % 12) + 12) % 12) - 6;
    const cents = diff * 100;
    if (!best || Math.abs(cents) < Math.abs(best.cents)) best = { target: t, cents };
  }
  return best!;
}

import { describe, expect, it } from "vitest";
import { capoPlan } from "../../src/core/banjo/tuning.ts";
import {
  detectPitch,
  hzToMidi,
  midiToHz,
  readString,
  stringTargets,
} from "../../src/core/tuner/pitch.ts";

const RATE = 44100;
function tone(
  hz: number,
  opts: { harmonics?: number[]; seconds?: number; noise?: number } = {},
): Float32Array {
  const n = Math.floor(RATE * (opts.seconds ?? 0.1));
  const out = new Float32Array(n);
  const h = opts.harmonics ?? [1];
  let seed = 7;
  for (let i = 0; i < n; i++) {
    let v = 0;
    h.forEach((amp, k) => (v += amp * Math.sin((2 * Math.PI * hz * (k + 1) * i) / RATE)));
    seed = (seed * 1664525 + 1013904223) >>> 0;
    out[i] = v * 0.5 + (opts.noise ?? 0) * (seed / 2 ** 31 - 1);
  }
  return out;
}
const cents = (a: number, b: number) => 1200 * Math.log2(a / b);

describe("F19 pitch detection (YIN)", () => {
  it("is within ±3 cents on a reference tone (phase-6 exit)", () => {
    for (const midi of [50, 55, 59, 62, 67, 74]) {
      const hz = midiToHz(midi);
      const r = detectPitch(tone(hz), RATE)!;
      expect(Math.abs(cents(r.hz, hz))).toBeLessThan(3);
      expect(r.clarity).toBeGreaterThan(0.8);
    }
  });

  it("doesn't jump an octave on a banjo-like tone with a strong 2nd harmonic", () => {
    const hz = midiToHz(50); // D3, the lowest string
    const r = detectPitch(tone(hz, { harmonics: [0.6, 1, 0.7, 0.4, 0.3] }), RATE)!;
    expect(Math.abs(cents(r.hz, hz))).toBeLessThan(5);
  });

  it("copes with some noise and returns null for silence", () => {
    const hz = midiToHz(59);
    const r = detectPitch(tone(hz, { noise: 0.05 }), RATE)!;
    expect(Math.abs(cents(r.hz, hz))).toBeLessThan(5);
    expect(detectPitch(new Float32Array(4410), RATE)).toBeNull();
  });
});

describe("F19 string targets", () => {
  it("are open G without a capo, and move with the capo (5th string raised too)", () => {
    expect(stringTargets().map((t) => t.midi)).toEqual([62, 59, 55, 50, 67]);
    expect(stringTargets(undefined, capoPlan(2)).map((t) => t.midi)).toEqual([64, 61, 57, 52, 69]);
  });

  it("finds the nearest string and how far off it is", () => {
    const targets = stringTargets();
    const r = readString(midiToHz(55.1), targets);
    expect(r.target.string).toBe(3);
    expect(r.cents).toBeCloseTo(10, 0);
  });

  it("with a string locked, folds an octave slip back onto that string", () => {
    const targets = stringTargets();
    const r = readString(midiToHz(50 + 12 - 0.2), targets, 4);
    expect(r.target.string).toBe(4);
    expect(r.cents).toBeCloseTo(-20, 0);
    expect(hzToMidi(440)).toBe(69);
  });
});

import { describe, expect, it } from "vitest";
import {
  actualFret,
  capoPlan,
  DEERING_SPIKES,
  fifthStringPlan,
  isPlayableFret,
  NO_CAPO,
  OPEN_G,
  pitchAt,
  positionsFor,
} from "../../src/core/banjo/tuning.ts";
import { chordPitchClasses, parseChord } from "../../src/core/music/chords.ts";
import { mod12 } from "../../src/core/music/notes.ts";

describe("open G tuning", () => {
  it("has the style guide's MIDI numbers (strings 1..5 = D4 B3 G3 D3 G4)", () => {
    expect([1, 2, 3, 4, 5].map((s) => pitchAt(OPEN_G, s as 1 | 2 | 3 | 4 | 5, 0))).toEqual([
      62, 59, 55, 50, 67,
    ]);
  });

  it("puts the open 5th string at the same pitch as the 1st string, 5th fret", () => {
    expect(pitchAt(OPEN_G, 5, 0)).toBe(pitchAt(OPEN_G, 1, 5));
  });

  it("has no 5th-string frets 1–5", () => {
    for (const fret of [1, 2, 3, 4, 5]) expect(isPlayableFret(5, fret)).toBe(false);
    expect(isPlayableFret(5, 6)).toBe(true);
    expect(pitchAt(OPEN_G, 5, 7)).toBe(69); // a
    expect(() => pitchAt(OPEN_G, 5, 3)).toThrow();
  });
});

// Style guide §8.1 and §8.2, frets for strings 4, 3, 2, 1. The guide checked these by
// computing pitches; this is the same check as a permanent test (and C7's future oracle).
const SHAPES: readonly (readonly [string, readonly [number, number, number, number]])[] = [
  ["G", [0, 0, 0, 0]],
  ["C", [2, 0, 1, 2]],
  ["D", [0, 2, 3, 4]],
  ["D7", [0, 2, 1, 0]],
  ["G7", [0, 0, 0, 3]],
  ["Em", [2, 0, 0, 2]],
  ["Am", [2, 2, 1, 2]],
  ["E", [2, 1, 0, 2]],
  ["F", [3, 2, 1, 3]],
  ["Dm", [0, 2, 3, 3]],
  ["G", [5, 4, 3, 5]], // F shape, x = 2
  ["G", [9, 7, 8, 9]], // D shape, x = 5
  ["Fm", [3, 1, 1, 3]], // F-minor shape
  ["Dm", [3, 2, 3, 3]], // D-minor shape, x = 0
  ["F7", [1, 2, 1, 3]], // barre 7th
  ["G7", [3, 4, 3, 5]], // barre 7th, x = 2
  ["A", [2, 2, 2, 2]], // barre, x = 2
  ["C", [5, 5, 5, 5]], // barre, x = 5
  ["D", [7, 7, 7, 7]], // barre, x = 7
];

describe("guide §8 chord shapes", () => {
  for (const [name, frets] of SHAPES) {
    it(`${name} at ${frets.join("-")} sounds only chord tones`, () => {
      const chord = parseChord(name);
      expect(chord).not.toBeNull();
      if (!chord) return;
      const tones = chordPitchClasses(chord);
      const strings = [4, 3, 2, 1] as const;
      const pcs = strings.map((s, i) => mod12(pitchAt(OPEN_G, s, frets[i] ?? 0)));
      for (const pc of pcs) expect(tones.has(pc)).toBe(true);
    });
  }
});

describe("capo and the 5th string", () => {
  it("uses Deering spikes at 7, 9 and 10 for capo 2, 4 and 5", () => {
    expect(fifthStringPlan(2, DEERING_SPIKES)).toEqual({ semitones: 2, by: "spike", spikeFret: 7 });
    expect(fifthStringPlan(4, DEERING_SPIKES)).toEqual({ semitones: 4, by: "spike", spikeFret: 9 });
    expect(fifthStringPlan(5, DEERING_SPIKES)).toEqual({
      semitones: 5,
      by: "spike",
      spikeFret: 10,
    });
  });

  it("defaults to no spikes, so a capo means retuning the 5th string", () => {
    expect(fifthStringPlan(2)).toEqual({ semitones: 2, by: "retune" });
    expect(capoPlan(4).fifth).toEqual({ semitones: 4, by: "retune" });
    expect(actualFret(5, 0, capoPlan(2))).toBe(0); // retuned: open is still at the 5th-string nut
  });

  it("says to retune when there is no spike (capo 3 for B♭)", () => {
    expect(fifthStringPlan(3, DEERING_SPIKES)).toEqual({ semitones: 3, by: "retune" });
    expect(fifthStringPlan(3, [7, 8, 9, 10])).toEqual({ semitones: 3, by: "spike", spikeFret: 8 });
    expect(fifthStringPlan(0)).toEqual({ semitones: 0, by: "none" });
  });

  it("raises every string by the capo, including the 5th", () => {
    const plan = capoPlan(2, DEERING_SPIKES);
    expect(pitchAt(OPEN_G, 3, 0, plan)).toBe(57); // open 3rd = a
    expect(pitchAt(OPEN_G, 5, 0, plan)).toBe(69); // 5th at the 7th-fret spike = a
    // Capo-relative frets: the same tab shape sounds two semitones higher.
    expect(pitchAt(OPEN_G, 1, 2, plan) - pitchAt(OPEN_G, 1, 2, NO_CAPO)).toBe(2);
  });

  it("gives the same 5th-string pitch for a spike and a retune", () => {
    const spiked = capoPlan(2, DEERING_SPIKES);
    const retuned = { capo: 2, fifth: { semitones: 2, by: "retune" as const } };
    expect(pitchAt(OPEN_G, 5, 0, spiked)).toBe(pitchAt(OPEN_G, 5, 0, retuned));
    expect(pitchAt(OPEN_G, 5, 9, spiked)).toBe(pitchAt(OPEN_G, 5, 9, retuned));
  });

  it("converts capo-relative frets to actual frets", () => {
    const plan = capoPlan(2, DEERING_SPIKES);
    expect(actualFret(1, 3, plan)).toBe(5);
    expect(actualFret(1, 0, plan)).toBe(2);
    expect(actualFret(5, 0, plan)).toBe(7); // open at the spike
    expect(actualFret(5, 9, { capo: 2, fifth: { semitones: 2, by: "retune" } })).toBe(9);
  });
});

describe("positionsFor", () => {
  it("finds every place a pitch can be played", () => {
    // G4 (67): open 5th, 1st string fret 5, 2nd fret 8, 3rd fret 12, 4th fret 17.
    expect(positionsFor(OPEN_G, 67)).toEqual([
      { string: 1, fret: 5 },
      { string: 2, fret: 8 },
      { string: 3, fret: 12 },
      { string: 4, fret: 17 },
      { string: 5, fret: 0 },
    ]);
  });

  it("round-trips with pitchAt", () => {
    for (let midi = 50; midi <= 84; midi++) {
      for (const p of positionsFor(OPEN_G, midi))
        expect(pitchAt(OPEN_G, p.string, p.fret)).toBe(midi);
    }
  });
});

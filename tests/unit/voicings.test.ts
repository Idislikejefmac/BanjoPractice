import { describe, expect, it } from "vitest";
import { voicings } from "../../src/core/banjo/voicings.ts";
import { capoPlan } from "../../src/core/banjo/tuning.ts";
import {
  chordPitchClasses,
  parseChord,
  requiredPitchClasses,
} from "../../src/core/music/chords.ts";
import { mod12 } from "../../src/core/music/notes.ts";

/** Style guide shapes are written for strings 4, 3, 2, 1; voicings store 1, 2, 3, 4. */
const s4321 = (f4: number, f3: number, f2: number, f1: number) => [f1, f2, f3, f4].join(",");
const find = (chord: string) => voicings(parseChord(chord)!).map((v) => v.frets.join(","));

describe("C7 voicings: every shape in style guide §8 is found (test oracle)", () => {
  const firstPosition: [string, [number, number, number, number]][] = [
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
  ];
  for (const [chord, f] of firstPosition) {
    it(`${chord}: ${f.join("-")}`, () => {
      expect(find(chord)).toContain(s4321(...f));
    });
  }

  it("finds the movable shapes up the neck and names them", () => {
    const g = voicings(parseChord("G")!);
    const byFrets = (f: [number, number, number, number]) =>
      g.find((v) => v.frets.join(",") === s4321(...f));
    expect(byFrets([5, 4, 3, 5])?.shape).toBe("F shape");
    expect(byFrets([9, 7, 8, 9])?.shape).toBe("D shape");
    const a = voicings(parseChord("A")!).find((v) => v.frets.join(",") === "2,2,2,2");
    expect(a?.shape).toBe("Barre");
    const g7 = voicings(parseChord("G7")!).find((v) => v.frets.join(",") === s4321(3, 4, 3, 5));
    expect(g7?.shape).toBe("Barre 7th");
  });

  it("labels D7 0-2-1-0 as having no 3rd", () => {
    const d7 = voicings(parseChord("D7")!).find((v) => v.frets.join(",") === s4321(0, 2, 1, 0));
    expect(d7?.noThird).toBe(true);
  });

  it("puts the open shape first", () => {
    expect(find("G")[0]).toBe("0,0,0,0");
    expect(find("C")[0]).toBe(s4321(2, 0, 1, 2));
    expect(find("D7")[0]).toBe(s4321(0, 2, 1, 0));
  });
});

describe("C7 voicings: every voicing is playable and complete (phase-4 exit)", () => {
  for (const name of [
    "G",
    "C",
    "D",
    "D7",
    "Em",
    "Am",
    "Gm7",
    "Bb",
    "C#m7b5",
    "Bbsus4",
    "F#7",
    "E9",
  ]) {
    it(`${name}: reach ≤ 4 frets, only chord tones, required tones present`, () => {
      const chord = parseChord(name)!;
      const vs = voicings(chord);
      expect(vs.length).toBeGreaterThan(0);
      const tones = chordPitchClasses(chord);
      for (const v of vs) {
        const fretted = v.frets.filter((f) => f > 0);
        if (fretted.length)
          expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThanOrEqual(3);
        const pcs = new Set(v.midi.map(mod12));
        for (const pc of pcs) expect(tones.has(pc)).toBe(true);
        for (const pc of requiredPitchClasses(chord)) expect(pcs.has(pc)).toBe(true);
      }
    });
  }

  it("is capo-aware: with capo 2, G shapes sound A", () => {
    const vs = voicings(parseChord("A")!, { plan: capoPlan(2) });
    expect(vs[0]!.frets.join(",")).toBe("0,0,0,0");
    expect(vs[0]!.midi).toEqual([64, 61, 57, 52]);
  });

  it("flags the 5th-string drone as in the chord or adding color", () => {
    expect(voicings(parseChord("G")!)[0]!.fifthString).toBe("in chord");
    expect(voicings(parseChord("D")!)[0]!.fifthString).toBe("adds color");
  });
});

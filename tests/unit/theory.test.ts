import { describe, expect, it } from "vitest";
import {
  chordPitchClasses,
  formatChord,
  parseChord,
  requiredPitchClasses,
  transposeChord,
} from "../../src/core/music/chords.ts";
import { formatKey, keySignature, parseKey, toAbcKey } from "../../src/core/music/keys.ts";
import type { Key } from "../../src/core/music/keys.ts";
import { formatNoteName, parseNoteName, pitchClass } from "../../src/core/music/notes.ts";
import { spellInKey, transposeKey } from "../../src/core/music/spelling.ts";

const key = (text: string): Key => {
  const k = parseKey(text);
  if (!k) throw new Error(`bad key ${text}`);
  return k;
};
const spell = (pc: number, k: string) => formatNoteName(spellInKey(pc, key(k)));

describe("note names", () => {
  it("parses ASCII and unicode accidentals", () => {
    expect(parseNoteName("Bb")).toEqual({ letter: "B", accidental: -1 });
    expect(parseNoteName("B♭")).toEqual({ letter: "B", accidental: -1 });
    expect(parseNoteName("F#")).toEqual({ letter: "F", accidental: 1 });
    expect(parseNoteName("G")).toEqual({ letter: "G", accidental: 0 });
    expect(parseNoteName("H")).toBeNull();
  });

  it("computes pitch classes", () => {
    expect(pitchClass({ letter: "B", accidental: -1 })).toBe(10);
    expect(pitchClass({ letter: "C", accidental: -1 })).toBe(11);
    expect(pitchClass({ letter: "E", accidental: 1 })).toBe(5);
  });
});

describe("keys", () => {
  it("parses ABC-style keys with modes", () => {
    expect(key("AMix")).toEqual({ tonic: { letter: "A", accidental: 0 }, mode: "mixolydian" });
    expect(key("Em").mode).toBe("minor");
    expect(key("ADor").mode).toBe("dorian");
    expect(key("Bb").tonic).toEqual({ letter: "B", accidental: -1 });
    expect(parseKey("Q")).toBeNull();
  });

  it("computes key signatures for majors and modes", () => {
    expect(keySignature(key("G"))).toBe(1);
    expect(keySignature(key("Bb"))).toBe(-2);
    expect(keySignature(key("F#"))).toBe(6);
    expect(keySignature(key("Am"))).toBe(0);
    expect(keySignature(key("ADor"))).toBe(1); // same notes as G major
    expect(keySignature(key("AMix"))).toBe(2); // same notes as D major
    expect(keySignature(key("GMix"))).toBe(0); // Old Joe Clark in G: no sharps
  });

  it("formats keys", () => {
    expect(formatKey(key("AMix"))).toBe("A Mixolydian");
    expect(formatKey(key("Bb"))).toBe("B♭ major");
    expect(toAbcKey(key("E dorian"))).toBe("EDor");
  });
});

describe("conventional spelling", () => {
  it("spells chromatic notes the bluegrass way in G", () => {
    expect(spell(10, "G")).toBe("B♭"); // ♭3, the blue note (not A♯)
    expect(spell(5, "G")).toBe("F"); // ♭7 (not E♯)
    expect(spell(1, "G")).toBe("C♯"); // ♯4
    expect(spell(3, "G")).toBe("E♭"); // ♭6
  });

  it("uses flats in flat keys and sharps in sharp keys", () => {
    expect(spell(10, "F")).toBe("B♭");
    expect(spell(3, "Bb")).toBe("E♭");
    expect(spell(6, "D")).toBe("F♯");
    expect(spell(8, "E")).toBe("G♯");
  });

  it("spells every diatonic note of all 12 major keys without double accidentals", () => {
    for (let pc = 0; pc < 12; pc++) {
      const k = transposeKey(key("C"), pc);
      for (const step of [0, 2, 4, 5, 7, 9, 11]) {
        const n = spellInKey(pitchClass(k.tonic) + step, k);
        expect(Math.abs(n.accidental) <= 1).toBe(true);
      }
    }
  });

  it("chooses the simplest tonic spelling when transposing", () => {
    expect(formatNoteName(transposeKey(key("G"), 3).tonic)).toBe("B♭");
    expect(formatNoteName(transposeKey(key("G"), 6).tonic)).toBe("D♭");
    expect(formatNoteName(transposeKey(key("C"), 6).tonic)).toBe("F♯"); // tie goes to sharps
    expect(formatNoteName(transposeKey(key("Em"), 1).tonic)).toBe("F");
  });
});

describe("chords", () => {
  it("parses and formats common bluegrass chords", () => {
    for (const [input, output] of [
      ["G", "G"],
      ["D7", "D7"],
      ["Em", "Em"],
      ["Bb", "B♭"],
      ["B♭", "B♭"],
      ["C#m7b5", "C♯m7♭5"],
      ["C♯m7♭5", "C♯m7♭5"],
      ["G/B", "G/B"],
      ["Gmaj7", "Gmaj7"],
      ["Bbsus4", "B♭sus4"],
    ] as const) {
      const c = parseChord(input);
      expect(c).not.toBeNull();
      if (c) expect(formatChord(c)).toBe(output);
    }
    expect(parseChord("Gzz")).toBeNull();
    expect(parseChord("")).toBeNull();
  });

  it("knows chord tones and required tones", () => {
    const d7 = parseChord("D7");
    expect(d7).not.toBeNull();
    if (!d7) return;
    expect([...chordPitchClasses(d7)].sort((a, b) => a - b)).toEqual([0, 2, 6, 9]);
    // 7th chords require root and 7th; the third is optional (guide §8.1 D7 has no F♯).
    expect([...requiredPitchClasses(d7)].sort((a, b) => a - b)).toEqual([0, 2]);
  });

  it("transposes chords with conventional spelling", () => {
    const f = parseChord("F");
    if (!f) throw new Error("parse");
    // ♭VII in G (F) moved up to A becomes G, and to B♭ becomes A♭.
    expect(formatChord(transposeChord(f, 2, key("A")))).toBe("G");
    expect(formatChord(transposeChord(f, 3, key("Bb")))).toBe("A♭");
  });
});

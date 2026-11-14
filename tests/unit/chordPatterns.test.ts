import { describe, expect, it } from "vitest";
import {
  addPattern,
  cleanName,
  MAX_CHORD_PATTERNS,
  patternSummary,
  removePattern,
  renamePattern,
  replacePatternChords,
  sameChords,
  validChordPatterns,
} from "../../src/core/banjo/chordPatterns.ts";
import type { ChordPattern } from "../../src/core/banjo/chordPatterns.ts";

const d7: ChordPattern = { id: "a", name: "D7 version", chords: { "5": "D7", "9": "D7" } };
const filler = (n: number): ChordPattern[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, chords: {} }));

describe("saved chord patterns (F46)", () => {
  it("saves the chords under a name, and tidies the name", () => {
    expect(addPattern([], "  my   D7  version ", { "5": "D7" }, "x")).toEqual({
      ok: true,
      patterns: [{ id: "x", name: "my D7 version", chords: { "5": "D7" } }],
    });
  });

  it("refuses an empty or over-long name, a name in use (any case), and a full list", () => {
    expect(addPattern([], "   ", {}, "x").ok).toBe(false);
    expect(addPattern([], "x".repeat(41), {}, "x").ok).toBe(false);
    expect(addPattern([d7], "d7 VERSION", {}, "y")).toMatchObject({ ok: false });
    expect(addPattern(filler(MAX_CHORD_PATTERNS), "One more", {}, "z")).toMatchObject({
      ok: false,
    });
  });

  it("keeps its own copy: later changes to the chords leave the pattern alone", () => {
    const chords: Record<string, string> = { "5": "D7" };
    const r = addPattern([], "A", chords, "x");
    chords["5"] = "G";
    expect(r.ok && r.patterns[0]!.chords).toEqual({ "5": "D7" });
  });

  it("renames, replaces chords and removes, leaving the others as they were", () => {
    const other: ChordPattern = { id: "b", name: "Plain", chords: {} };
    const list = [d7, other];
    expect(renamePattern(list, "a", "Dominant")).toEqual({
      ok: true,
      patterns: [{ ...d7, name: "Dominant" }, other],
    });
    expect(renamePattern(list, "a", "plain")).toMatchObject({ ok: false });
    expect(renamePattern(list, "a", "D7 version").ok).toBe(true); // its own name is fine
    expect(replacePatternChords(list, "b", { "3": "Am" })[1]!.chords).toEqual({ "3": "Am" });
    expect(removePattern(list, "a")).toEqual([other]);
    expect(removePattern(list, "nope")).toEqual(list);
  });

  it("compares chords regardless of order", () => {
    expect(sameChords({ "5": "D7", "9": "C" }, { "9": "C", "5": "D7" })).toBe(true);
    expect(sameChords({ "5": "D7" }, { "5": "D" })).toBe(false);
    expect(sameChords({}, { "5": "D" })).toBe(false);
  });

  it("summarises the changeable measures, standard chords where none was chosen", () => {
    expect(patternSummary({})).toBe("G C D G  G C G D  G Em C D");
    expect(patternSummary({ "2": "Am", "13": "B7" })).toBe("Am C D G  G C G D  G Em C B7");
  });

  it("reads a stored list defensively", () => {
    expect(validChordPatterns([])).toBe(true);
    expect(validChordPatterns([d7])).toBe(true);
    for (const bad of [
      null,
      "x",
      [{ id: "a" }],
      [{ ...d7, id: "" }],
      [d7, d7], // the same id twice
      [{ ...d7, name: "  untidy  " }],
      [{ ...d7, chords: { "5": "H#" } }],
      [{ ...d7, chords: { "0": "D7" } }], // the open-strings measures can't change
      [{ ...d7, chords: ["D7"] }],
      filler(MAX_CHORD_PATTERNS + 1),
    ]) {
      expect(validChordPatterns(bad), JSON.stringify(bad)).toBe(false);
    }
  });

  it("a name's tidy form is stable", () => {
    expect(cleanName(cleanName("  a  b ")!)).toBe("a b");
    expect(cleanName("")).toBeNull();
  });
});

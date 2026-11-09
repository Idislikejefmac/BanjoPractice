import { describe, expect, it } from "vitest";
import { parseTab, serializeTab } from "../../src/core/tab/tabText.ts";
import { SPEC_FIXTURE, tab } from "../helpers/tab.ts";

describe("tab text format", () => {
  it("parses the spec fixture", () => {
    const ms = tab(SPEC_FIXTURE);
    expect(ms.map((m) => m.index)).toEqual([1, 2, 3, 4]);
    expect(ms.map((m) => m.rollName)).toEqual(["forward", "alt-thumb", "lick:slide-3", "tag"]);
    expect(ms[1]?.chords).toEqual([
      { atSlot: 0, chord: "C" },
      { atSlot: 4, chord: "G" },
    ]);
  });

  it("reads notes, melody and accent marks", () => {
    const [m] = tab("m1 G forward | 3:0T* 2:0I 1:0M 5:0T> 2:0I 1:0M* 5:0T> 1:0M |");
    expect(m?.notes[0]).toEqual({
      slot: 0,
      durationSlots: 1,
      string: 3,
      fret: 0,
      finger: "T",
      technique: "pick",
      isMelody: true,
      isAccent: false,
    });
    expect(m?.notes[3]?.isAccent).toBe(true);
  });

  it("reads slurs, pinches, holds and rests", () => {
    const [m3] = tab("m3 G lick:slide-3 | 3:2T /3:3 2:0I* 1:0M 5:0T 2:0I 1:0M - |");
    expect(m3?.notes[1]).toMatchObject({ slot: 1, technique: "slide-up", finger: null, fret: 3 });
    expect(m3?.notes[6]?.durationSlots).toBe(2);

    const [m4] = tab("m4 G tag | 3:0T 2:0I [5:0T,1:0M] - 3:0T . [5:0T,1:0M] - |");
    const pinch = m4?.notes.filter((n) => n.slot === 2) ?? [];
    expect(pinch).toHaveLength(2);
    expect(pinch.every((n) => n.durationSlots === 2 && n.pinchGroup === 0)).toBe(true);
    expect(m4?.notes.some((n) => n.slot === 5)).toBe(false); // the rest
  });

  it("reads flags", () => {
    const [m] = tab("m8 G forward !end !generated | 3:0T 2:0I 1:0M 5:0T 2:0I 1:0M . . |");
    expect(m?.phraseEnd).toBe(true);
    expect(m?.source).toBe("generated");
  });

  it("skips comments and blank lines", () => {
    expect(tab("# Cripple Creek, A part\n\nm1 G forward | 3:0T 2:0I 1:0M 5:0T 2:0I 1:0M 5:0T 1:0M |\n")).toHaveLength(1);
  });

  it("round-trips the fixture through serialize and parse", () => {
    const ms = tab(SPEC_FIXTURE);
    const text = serializeTab(ms);
    expect(tab(text)).toEqual(ms);
    expect(serializeTab(tab(text))).toBe(text);
  });

  it("reports errors with line and column, never throwing", () => {
    const cases: readonly [string, number, number][] = [
      ["m1 G forward 3:0T 2:0I", 1, 1], // no '|'
      ["m1 G forward | 3:0T 2:0I", 1, 25], // no closing '|'
      ["x1 G forward | 3:0T |", 1, 1], // bad measure number
      ["m1 G forward | 3:0 |", 1, 16], // picked note without a finger
      ["m1 G forward | h3:2T |", 1, 16], // slur with a finger
      ["m1 G forward | - 3:0T |", 1, 16], // hold at the start
      ["m1 Gzz forward | 3:0T |", 1, 4], // unknown chord
      ["m1 G@9 forward | 3:0T |", 1, 4], // chord outside the measure
      ["\nm1 G forward | 9:0T |", 2, 16], // no string 9
      ["m1 G | 3:0T |", 1, 6], // missing roll name
    ];
    for (const [text, line, column] of cases) {
      const r = parseTab(text);
      expect(r.ok).toBe(false);
      if (!r.ok) expect([r.errors[0]?.line, r.errors[0]?.column]).toEqual([line, column]);
    }
  });

  it("rejects duplicate measure numbers", () => {
    const r = parseTab("m1 G forward | 3:0T |\nm1 G forward | 3:0T |");
    expect(r.ok).toBe(false);
  });

  it("survives garbage input", () => {
    for (const junk of ["|||", "[[[", "m1 | [ |", "m1 x | [1:0T, |", "\u0000\u0001", "m99999 G f | . |"]) {
      expect(() => parseTab(junk)).not.toThrow();
    }
  });
});

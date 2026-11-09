import { describe, expect, it } from "vitest";
import { capoPlan } from "../../src/core/banjo/tuning.ts";
import { evenGeometry, layoutTabLine, rollLabel } from "../../src/render/tabLayout.ts";
import { SPEC_FIXTURE, tab } from "../helpers/tab.ts";

const measures = tab(SPEC_FIXTURE);
const geometry = evenGeometry(measures, 800, 30);
const base = {
  scale: 1,
  showRollNames: true,
  showAccents: false,
  showChords: false,
  fretNumbering: "actual" as const,
  showMeasureNumber: true,
};

describe("R2 tab layout", () => {
  const p = layoutTabLine(measures, geometry, 800, base);

  it("draws five strings with string 1 on top", () => {
    expect(p.stringY).toHaveLength(5);
    expect(p.stringY[0]).toBeLessThan(p.stringY[4]!);
  });

  it("puts a finger badge under every picked note, none under slurred notes", () => {
    const picked = measures.flatMap((m) =>
      m.notes.filter((n) => n.technique === "pick" && n.finger),
    );
    expect(p.badges).toHaveLength(picked.length);
    expect(p.badges.every((b) => b.y > p.stringY[4]!)).toBe(true);
    // m3 has a slide (/3:3): it gets an arc labeled "sl" and no badge.
    expect(p.slurs.map((s) => s.label.text)).toEqual(["sl"]);
  });

  it("marks melody notes and places each fret on its string and slot", () => {
    const m1 = p.frets.filter((f) => f.measure === 1);
    expect(m1.filter((f) => f.melody).map((f) => f.slot)).toEqual([0, 5]);
    for (const f of p.frets) {
      expect(f.y).toBe(p.stringY[f.string - 1]);
      expect(f.x).toBeCloseTo(geometry.find((g) => g.index === f.measure)!.slotX[f.slot]!);
    }
  });

  it("stacks pinch badges and leaves silent slots as rests", () => {
    const pinch = p.badges.filter((b) => b.measure === 4 && b.slot === 2);
    expect(pinch).toHaveLength(2);
    expect(pinch[0]!.y).not.toBe(pinch[1]!.y);
    expect(p.rests).toHaveLength(1); // the "." in m4
  });

  it("beams runs of eighths in groups of four slots", () => {
    // m1 and m2 are all eighths: two beams each.
    expect(
      p.beams.filter((b) => b.x1 >= geometry[0]!.left && b.x2 <= geometry[1]!.right),
    ).toHaveLength(4);
  });

  it("shows actual frets with a capo, or frets counted from the capo", () => {
    const plan = capoPlan(2);
    const actual = layoutTabLine(measures, geometry, 800, { ...base, plan });
    const relative = layoutTabLine(measures, geometry, 800, {
      ...base,
      plan,
      fretNumbering: "capo-relative",
    });
    const first = (q: typeof p) => q.frets.find((f) => f.measure === 1 && f.slot === 0)!.text;
    expect(first(relative)).toBe("0");
    expect(first(actual)).toBe("2");
  });

  it("can hide roll names and show chords for the tab-only view", () => {
    const q = layoutTabLine(measures, geometry, 800, {
      ...base,
      showRollNames: false,
      showChords: true,
    });
    expect(q.rollLabels).toEqual([]);
    expect(q.chordLabels.map((c) => c.text)).toEqual(["G", "C", "G", "G", "G"]);
  });
});

describe("roll labels", () => {
  it("uses the roll library's names", () => {
    expect(rollLabel("forward")).toBe("Forward");
    expect(rollLabel("alt-thumb")).toBe("Alternating thumb");
    expect(rollLabel("lick:slide-3")).toBe("Lick: slide 3");
    expect(rollLabel("middle-leading+pull-off")).toBe("Middle-leading + pull off");
  });
});

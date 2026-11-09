import { describe, expect, it } from "vitest";
import type { RuleId } from "../../src/core/banjo/validator.ts";
import { isLegal, validate } from "../../src/core/banjo/validator.ts";
import { capoPlan } from "../../src/core/banjo/tuning.ts";
import { SPEC_FIXTURE, tab } from "../helpers/tab.ts";

const rules = (text: string): RuleId[] => validate(tab(text)).map((v) => v.rule);

describe("validator: legal music", () => {
  it("accepts the DEVELOPMENT.md C5 fixture as one piece", () => {
    expect(validate(tab(SPEC_FIXTURE))).toEqual([]);
  });

  it("accepts a thumb–pinch fill on strong beats", () => {
    expect(
      rules(
        "m1 G thumb-pinch | 3:0T [2:0I,1:0M] 4:0T [2:0I,1:0M] 3:0T [2:0I,1:0M] 4:0T [2:0I,1:0M] |",
      ),
    ).toEqual([]);
  });

  it("accepts a thumb note followed by a thumb pinch on a strong beat (tag ending)", () => {
    expect(rules("m1 G tag | 3:0T 2:0I 1:0M 3:0T [5:0T,1:0M] - . . |")).toEqual([]);
  });

  it("accepts a hammer-on and a pull-off", () => {
    expect(rules("m1 G forward | 3:0T h3:2 2:0I 1:0M 5:0T 1:3M p1:2 2:0I |")).toEqual([]);
  });

  it("skips slurs when checking for a repeated finger", () => {
    // M picks, a pull-off sounds (no pick), then M picks again: still M twice in a row.
    expect(rules("m1 G forward | 3:0T 2:0I 1:3M p1:2 1:0M 5:0T 2:0I 1:0M |")).toContain("H1");
  });
});

describe("validator: one known-bad measure per rule", () => {
  it("H1: the same finger twice in a row", () => {
    expect(rules("m1 G forward | 3:0T 2:0I 1:0M 1:0M 2:0I 1:0M 5:0T 1:0M |")).toContain("H1");
  });

  it("H1: across a bar line", () => {
    const v = validate(
      tab(
        "m1 G forward | 3:0T 2:0I 1:0M 5:0T 2:0I 1:0M 5:0T 1:0M |\nm2 G backward | 1:0M 2:0I 5:0T 1:0M 2:0I 5:0T 1:0M 2:0I |",
      ),
    );
    expect(v.map((x) => x.rule)).toContain("H1");
    expect(v.find((x) => x.rule === "H1")?.measure).toBe(2);
  });

  it("H2: the same string picked twice in a row", () => {
    expect(rules("m1 G forward | 3:0T 3:0I 1:0M 5:0T 2:0I 1:0M 5:0T 1:0M |")).toContain("H2");
  });

  it("H3: fingers crossing in sequence (index on 3, then thumb on 2)", () => {
    expect(rules("m1 G x | 3:0I 2:0T 1:0M 5:0T 2:0I 1:0M 5:0T 1:0M |")).toContain("H3");
  });

  it("H3: fingers crossing in a pinch", () => {
    expect(rules("m1 G x | [1:0T,5:0M] - 3:0T 2:0I 1:0M 5:0T 2:0I 1:0M |")).toContain("H3");
  });

  it("H4: middle finger on the 3rd string", () => {
    expect(rules("m1 G x | 4:0T 2:0I 3:0M 5:0T 2:0I 1:0M 5:0T 1:0M |")).toContain("H4");
  });

  it("H5: a stretch wider than four frets", () => {
    expect(rules("m1 G x | 3:2T 2:0I 1:9M 5:0T 2:0I 1:0M 5:0T 1:0M |")).toContain("H5");
  });

  it("H5: fretting the 5th string outside a lick", () => {
    expect(rules("m1 G forward | 3:0T 2:0I 1:0M 5:7T 2:0I 1:0M 5:0T 1:0M |")).toContain("H5");
    expect(rules("m1 G lick:fifth | 3:0T 2:0I 1:0M 5:7T 2:0I 1:0M 5:0T 1:0M |")).not.toContain(
      "H5",
    );
  });

  it("H6: a silent slot in the middle of a piece", () => {
    const v = validate(
      tab(
        "m1 G forward | 3:0T 2:0I . 5:0T 2:0I 1:0M 5:0T 1:0M |\nm2 G forward | 3:0T 2:0I 1:0M 5:0T 2:0I 1:0M 5:0T 1:0M |",
      ),
    );
    expect(v.map((x) => x.rule)).toContain("H6");
  });

  it("H6: rests are fine at a phrase end", () => {
    const v = validate(
      tab(
        "m1 G forward !end | 3:0T 2:0I 1:0M 5:0T 2:0I 1:0M . . |\nm2 G forward | 3:0T 2:0I 1:0M 5:0T 2:0I 1:0M 5:0T 1:0M |",
      ),
    );
    expect(v).toEqual([]);
  });

  it("H7: a slur on a different string, and one going the wrong way", () => {
    expect(rules("m1 G x | 3:0T h2:2 2:0I 1:0M 5:0T 2:0I 1:0M 5:0T |")).toContain("H7");
    expect(rules("m1 G x | 3:2T h3:0 2:0I 1:0M 5:0T 2:0I 1:0M 5:0T |")).toContain("H7");
    expect(rules("m1 G x | 3:2T p3:0 2:0I 1:0M 5:0T 2:0I 1:0M 5:0T |")).toEqual([]);
  });

  it("H8: a fret that doesn't exist", () => {
    expect(rules("m1 G x | 3:0T 2:0I 1:0M 5:3T 2:0I 1:0M 5:0T 1:0M |")).toContain("H8");
    expect(
      validate(tab("m1 G x | 3:0T 2:0I 1:21M 5:0T 2:0I 1:0M 5:0T 1:0M |"), {
        plan: capoPlan(5),
      }).map((v) => v.rule),
    ).toContain("H8");
  });

  it("H9: a pinch reusing the finger that just picked (not a thumb on a strong beat)", () => {
    expect(rules("m1 G x | 3:0T 2:0I 1:0M [2:0I,1:0M] 5:0T 2:0I 1:0M 5:0T |")).toContain("H9");
    // Thumb, then a thumb pinch on a strong beat (note 5): allowed, the pinch resets the hand.
    expect(rules("m1 G x | 3:0T 2:0I 1:0M 4:0T [5:0T,1:0M] - 2:0I 1:0M |")).toEqual([]);
    // Thumb, then a thumb pinch on a weak beat (note 4): not allowed.
    expect(rules("m1 G x | 3:0T 2:0I 4:0T [5:0T,1:0M] - 3:0T 2:0I 1:0M |")).toContain("H9");
  });
});

describe("validator: joins and robustness", () => {
  it("reports repeat joins as warnings, not errors", () => {
    const ms = tab(
      "m1 G backward | 1:0M 2:0I 5:0T 1:0M 2:0I 5:0T 1:0M 2:0I |\nm2 G forward | 3:0T 2:0I 1:0M 5:0T 2:0I 1:0M 5:0T 1:0M |",
    );
    expect(validate(ms)).toEqual([]);
    // Repeat m2 → m1: middle finger on the 1st string twice across the repeat.
    const v = validate(ms, { extraEdges: [{ from: 1, to: 0 }] });
    expect(v.map((x) => [x.rule, x.severity])).toEqual([
      ["H1", "warning"],
      ["H2", "warning"],
    ]);
    expect(isLegal(ms, { extraEdges: [{ from: 1, to: 0 }] })).toBe(true);
  });

  it("never throws on malformed data", () => {
    const junk = [
      { index: 1, slots: 8, chords: null, rollName: "x", source: "hand", notes: [null] },
    ];
    expect(() => validate(junk as never)).not.toThrow();
    expect(validate(junk as never)[0]?.rule).toBe("STRUCT");
  });
});

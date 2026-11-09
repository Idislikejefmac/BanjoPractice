import { describe, expect, it } from "vitest";
import { halfRollMeasure, rollMeasure, ROLLS } from "../../src/core/banjo/rolls.ts";
import { validate } from "../../src/core/banjo/validator.ts";

describe("roll library (style guide §5)", () => {
  it("has the eight named rolls, each eight notes long", () => {
    expect(ROLLS).toHaveLength(8);
    for (const r of ROLLS) {
      expect(r.fingers).toHaveLength(8);
      expect(r.exampleStrings).toHaveLength(8);
    }
  });

  for (const roll of ROLLS) {
    it(`${roll.name} passes every hard rule, including the wrap into the next measure`, () => {
      const twice = [rollMeasure(roll, { index: 1 }), rollMeasure(roll, { index: 2 })];
      expect(validate(twice)).toEqual([]);
    });
  }

  it("accents the forward roll 3+3+2 (slots 1, 4, 7)", () => {
    const forward = ROLLS.find((r) => r.id === "forward");
    expect(forward?.accents).toEqual([0, 3, 6]);
  });

  it("finds legal half-roll combinations and rejects illegal joins", () => {
    let legal = 0;
    let illegal = 0;
    for (const a of ROLLS) {
      for (const b of ROLLS) {
        for (const ha of [0, 1] as const) {
          for (const hb of [0, 1] as const) {
            const m = halfRollMeasure(a, ha, b, hb);
            if (validate([m]).length === 0) legal++;
            else illegal++;
          }
        }
      }
    }
    // Same-roll halves in order are always legal, so there are at least 8 legal pairs.
    expect(legal).toBeGreaterThanOrEqual(8);
    // Some joins repeat a finger at the half-measure; the validator must catch those.
    expect(illegal).toBeGreaterThan(0);
  });
});

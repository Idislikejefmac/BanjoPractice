import { describe, expect, it } from "vitest";
import { halfRollMeasure, rollMeasure, ROLLS } from "../../src/core/banjo/rolls.ts";
import { validate } from "../../src/core/banjo/validator.ts";

describe("roll library (style guide §5)", () => {
  it("has the nine named rolls, each eight notes long", () => {
    expect(ROLLS).toHaveLength(9);
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

  // Deering, "The Four Essential 5-String Banjo Rolls" (blog.deeringbanjos.com, 2023) is the
  // first-tier source. These are its four rolls, finger by finger and string by string. Its forward
  // roll is written index-middle-thumb (strings 2 1 5 2 1 5 2 1) and says "the first two notes can
  // be moved to the end", which gives the thumb-first form below.
  describe("Deering's four essential rolls", () => {
    const deering = {
      forward: ["T I M T I M I M", "5 2 1 5 2 1 2 1"],
      backward: ["M I T M I T M I", "1 2 5 1 2 5 1 2"],
      "forward-reverse": ["T I M T M I T M", "3 2 1 5 1 2 3 1"],
      "alternating-thumb": ["T I T M T I T M", "3 2 5 1 4 2 5 1"],
    } as const;
    for (const [id, [fingers, strings]] of Object.entries(deering)) {
      it(`${id}: ${fingers} on strings ${strings}`, () => {
        const roll = ROLLS.find((r) => r.id === id)!;
        expect(roll.fingers.join(" ")).toBe(fingers);
        expect(roll.exampleStrings.join(" ")).toBe(strings);
        expect(roll.source).toBe("deering");
      });
    }

    it("is the only roll set with source 'deering'", () => {
      expect(ROLLS.filter((r) => r.source === "deering").map((r) => r.id)).toEqual(
        Object.keys(deering),
      );
    });

    it("rolls that differ from Deering's keep a name that says how, and a lower tier", () => {
      const ending = ROLLS.find((r) => r.id === "forward-thumb-ending")!;
      expect(ending.fingers.join(" ")).toBe("T I M T I M T M");
      expect(ending.source).toBe("tutorials");
      // Every roll says where it comes from; the two without a published source say so.
      expect(ROLLS.filter((r) => r.source === "app").map((r) => r.id)).toEqual([
        "middle-leading",
        "index-leading",
      ]);
    });
  });

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

describe("a roll's title says where it comes from", () => {
  it("shows the source beside the name", async () => {
    const { rollTitle, ROLL_SOURCE_SHORT } = await import("../../src/core/banjo/rolls.ts");
    const title = (id: string) => rollTitle(ROLLS.find((r) => r.id === id)!);
    expect(title("forward")).toBe("Forward roll (Deering)");
    expect(title("alternating-thumb")).toBe("Alternating thumb roll (Deering)");
    expect(title("forward-thumb-ending")).toBe("Forward (thumb ending) roll (tutorial sites)");
    expect(title("middle-leading")).toBe("Middle-leading roll (our own pattern)");
    expect(ROLL_SOURCE_SHORT["jens-kruger"]).toBe("Jens Kruger");
  });

  it("is the title of the exercise and of the lesson, and in their ABC", async () => {
    const { rollExercise, rollLesson } = await import("../../src/core/banjo/exercises.ts");
    for (const song of [rollExercise("forward")!, rollLesson("forward")!]) {
      expect(song.title).toBe("Forward roll (Deering)");
      expect(song.abc).toContain("T:Forward roll (Deering)");
    }
  });

  it("no roll claims Jens Kruger until his patterns are written down from his own material", () => {
    expect(ROLLS.filter((r) => r.source === "jens-kruger")).toEqual([]);
  });
});

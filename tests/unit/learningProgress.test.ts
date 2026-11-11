import { describe, expect, it } from "vitest";
import { rollById, ROLLS } from "../../src/core/banjo/rolls.ts";
import { INITIAL_FADE } from "../../src/core/learning/fade.ts";
import { lessonCells } from "../../src/core/learning/lesson.ts";
import {
  EMPTY_PROGRESS,
  fadeFor,
  rateRoll,
  readProgress,
  resetRoll,
} from "../../src/core/learning/progress.ts";

describe("saved learning progress (F37)", () => {
  it("starts empty and rates one roll at a time", () => {
    expect(fadeFor(EMPTY_PROGRESS, "forward")).toEqual(INITIAL_FADE);
    let p = EMPTY_PROGRESS;
    for (let i = 0; i < 3; i++) p = rateRoll(p, "forward", "got-it");
    expect(fadeFor(p, "forward").level).toBe(2);
    expect(fadeFor(p, "backward")).toEqual(INITIAL_FADE);
    // The old value is untouched (the record is immutable).
    expect(EMPTY_PROGRESS.rolls).toEqual({});
  });

  it("ignores a roll it doesn't know, and can start a roll over", () => {
    expect(rateRoll(EMPTY_PROGRESS, "no-such-roll", "got-it")).toBe(EMPTY_PROGRESS);
    let p = rateRoll(EMPTY_PROGRESS, "forward", "got-it");
    p = resetRoll(p, "forward");
    expect(p.rolls).toEqual({});
  });

  it("round-trips through JSON", () => {
    let p = EMPTY_PROGRESS;
    for (let i = 0; i < 4; i++) p = rateRoll(p, "backward", "got-it");
    expect(readProgress(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });

  it("reads damaged or hostile records without throwing", () => {
    for (const bad of [
      null,
      undefined,
      7,
      "x",
      [],
      { rolls: null },
      { rolls: [] },
      { version: 2 },
    ]) {
      expect(readProgress(bad)).toEqual(EMPTY_PROGRESS);
    }
    // JSON.parse makes "__proto__" a real own key, as a damaged or hostile file would.
    const mixed = readProgress(
      JSON.parse(`{"version":1,"rolls":{
        "forward":{"level":3,"gotItRun":1,"againRun":0},
        "backward":{"level":99},
        "__proto__":{"level":4},
        "constructor":{"level":4},
        "nonsense":{"level":4}}}`),
    );
    expect(Object.keys(mixed.rolls)).toEqual(["forward"]);
    expect(fadeFor(mixed, "forward")).toEqual({ level: 3, gotItRun: 1, againRun: 0 });
    expect(fadeFor(mixed, "constructor")).toEqual(INITIAL_FADE);
    expect(fadeFor(mixed, "__proto__")).toEqual(INITIAL_FADE);
  });

  it("does not use a document from a newer version", () => {
    expect(readProgress({ version: 2, rolls: { forward: { level: 4 } } })).toEqual(EMPTY_PROGRESS);
  });
});

describe("lesson diagram cells (F36, F37)", () => {
  const forward = rollById("forward")!;

  it("shows everything at level 1, in two halves of four", () => {
    const cells = lessonCells(forward, 1);
    expect(cells.map((c) => c.finger)).toEqual([...forward.fingers]);
    expect(cells.map((c) => c.string)).toEqual([...forward.exampleStrings]);
    expect(cells.map((c) => c.half)).toEqual([0, 0, 0, 0, 1, 1, 1, 1]);
  });

  it("hides the second half at level 2, the strings at level 3 and all at level 4", () => {
    const l2 = lessonCells(forward, 2);
    expect(l2.slice(0, 4).every((c) => c.finger !== null && c.string !== null)).toBe(true);
    expect(l2.slice(4).every((c) => c.finger === null && c.string === null)).toBe(true);
    const l3 = lessonCells(forward, 3);
    expect(l3.every((c) => c.finger !== null && c.string === null)).toBe(true);
    const l4 = lessonCells(forward, 4);
    expect(l4.every((c) => c.finger === null && c.string === null)).toBe(true);
  });

  it("'show me' reveals everything at any level, and the accents always show", () => {
    for (const roll of ROLLS) {
      expect(lessonCells(roll, 4, true)).toEqual(lessonCells(roll, 1));
      expect(
        lessonCells(roll, 4)
          .filter((c) => c.accent)
          .map((c) => c.slot),
      ).toEqual([...roll.accents]);
    }
  });
});

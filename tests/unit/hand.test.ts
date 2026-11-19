// C6 hand profiles (hand.ts, style guide §3.1): generated tabs are written for a beginner's hand.
// Regression: Dad's teacher saw generated tabs with the thumb jumping from the 5th string to the
// 2nd, which beginners can't do at speed and experienced players avoid (2026-11-19). Cripple
// Creek measure 1 used to be `2:3I 1:0M 2:3T …` (the thumb on the 2nd string).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { arrange } from "../../src/core/banjo/arranger.ts";
import {
  EXERCISE_CHORD_CHOICES,
  rollExercise,
  rollLesson,
} from "../../src/core/banjo/exercises.ts";
import type { PlayerLevel } from "../../src/core/banjo/hand.ts";
import { advancedNote, defaultRollIds, HAND_PROFILES } from "../../src/core/banjo/hand.ts";
import { ROLLS } from "../../src/core/banjo/rolls.ts";
import type { ArrangedMeasure, Finger, StringNo } from "../../src/core/banjo/types.ts";
import { validate } from "../../src/core/banjo/validator.ts";
import { indexAbc } from "../../src/core/song/abcIndex.ts";
import { parseTab } from "../../src/core/tab/tabText.ts";

const fixture = (name: string) =>
  indexAbc(readFileSync(new URL(`../fixtures/songs/${name}.abc`, import.meta.url), "utf8"));
const SONGS = ["cripple-creek", "old-joe-clark", "wildwood-flower", "will-the-circle-be-unbroken"];

/** Every way a tab breaks a hand profile: strings outside a finger's lane, long jumps. */
function handProblems(measures: readonly ArrangedMeasure[], level: PlayerLevel): string[] {
  const hand = HAND_PROFILES[level];
  const out: string[] = [];
  const last: Record<Finger, StringNo | null> = { T: null, I: null, M: null };
  for (const m of measures) {
    for (const n of m.notes) {
      if (!n.finger) continue;
      const at = `measure ${m.index}, note ${n.slot + 1}`;
      if (!hand.strings[n.finger].includes(n.string))
        out.push(`${n.finger} on string ${n.string} (${at})`);
      const from = last[n.finger];
      if (from !== null && Math.abs(from - n.string) > hand.easyTravel[n.finger])
        out.push(`${n.finger} jumps ${from}→${n.string} (${at})`);
      last[n.finger] = n.string;
    }
  }
  return out;
}

const errors = (ms: readonly ArrangedMeasure[]) =>
  validate(ms).filter((v) => v.severity === "error");

describe("hand profiles", () => {
  it("the beginner's lanes hold every roll a beginner is taught, and not the Foggy Mountain roll", () => {
    for (const roll of ROLLS) {
      const fits = roll.fingers.every((f, i) =>
        HAND_PROFILES.beginner.strings[f].includes(roll.exampleStrings[i]!),
      );
      // The Foggy Mountain roll puts the thumb on the 2nd string: that is why it is left out.
      expect(fits, roll.id).toBe(roll.id !== "foggy-mountain");
    }
  });

  it("a beginner's lanes sit inside the experienced ones (and C4's H4)", () => {
    for (const f of ["T", "I", "M"] as const) {
      for (const s of HAND_PROFILES.beginner.strings[f])
        expect(HAND_PROFILES.experienced.strings[f]).toContain(s);
    }
  });

  it("the default rolls are every roll but the ones a beginner leaves out", () => {
    expect(defaultRollIds()).not.toContain("foggy-mountain");
    expect(defaultRollIds()).not.toContain("index-leading");
    expect(defaultRollIds("experienced")).toEqual(ROLLS.map((r) => r.id));
  });
});

describe("generated tabs for a beginner (the default)", () => {
  for (const name of SONGS) {
    it(`${name}: fingers stay in their lanes, no long jumps, no left-out rolls`, () => {
      const { arrangement, problems } = arrange(fixture(name));
      expect(errors(arrangement.measures)).toEqual([]);
      expect(problems).toEqual([]);
      expect(handProblems(arrangement.measures, "beginner")).toEqual([]);
      for (const m of arrangement.measures) {
        expect(m.rollName).not.toMatch(/foggy-mountain|index-leading/);
      }
    });
  }

  it("Cripple Creek measure 1 no longer puts the thumb on the 2nd string (regression)", () => {
    const old = arrange(fixture("cripple-creek"), {
      level: "experienced",
      weights: { fingerTravel: 0 },
    }).arrangement.measures[0]!;
    // The old behavior, kept reachable so this test keeps proving something.
    expect(old.notes.some((n) => n.finger === "T" && n.string === 2)).toBe(true);
    const now = arrange(fixture("cripple-creek")).arrangement.measures[0]!;
    expect(now.notes.some((n) => n.finger === "T" && n.string === 2)).toBe(false);
  });

  it("an unknown roll list doesn't bring the left-out rolls back", () => {
    const idx = fixture("cripple-creek");
    const names = (rolls?: string[]) =>
      arrange(idx, rolls ? { rolls } : {}).arrangement.measures.map((m) => m.rollName);
    expect(names(["nope"])).toEqual(names());
  });

  it("a roll list that names a left-out roll may use it, still in a beginner's lanes", () => {
    const chordsOnly = indexAbc(`X:1
M:4/4
L:1/8
K:G
"G"z8|"C"z8|"G"z8|"D"z8|"G"z8|]`);
    const { arrangement } = arrange(chordsOnly, { rolls: ["foggy-mountain"] });
    expect(arrangement.measures.some((m) => m.rollName.startsWith("foggy-mountain"))).toBe(true);
    expect(handProblems(arrangement.measures, "beginner")).toEqual([]);
  });
});

describe("experienced hand", () => {
  for (const name of SONGS) {
    it(`${name}: no finger jumps further than it easily reaches`, () => {
      const { arrangement } = arrange(fixture(name), { level: "experienced" });
      expect(errors(arrangement.measures)).toEqual([]);
      expect(handProblems(arrangement.measures, "experienced")).toEqual([]);
    });
  }
});

describe("roll exercises and lessons play the roll's own strings", () => {
  // Regression (2026-11-19): the arranger put the thumb on its home string, the 5th, so the
  // Foggy Mountain exercise played 2 1 5 1 … instead of 2 1 2 1 …, and the forward-reverse
  // lesson 5 2 1 5 1 2 5 1 instead of 3 2 1 5 1 2 3 1.
  const strings = (tab: string) => parseTab(tab).measures.map((m) => m.notes.map((n) => n.string));

  for (const roll of ROLLS) {
    it(`${roll.id}: every measure is the roll's strings, legal, over every chord on offer`, () => {
      const exercise = rollExercise(roll.id)!;
      expect(
        validate(parseTab(exercise.tab!).measures).filter((v) => v.severity === "error"),
      ).toEqual([]);
      for (const s of strings(exercise.tab!)) expect(s).toEqual(roll.exampleStrings);
      for (const { chord } of EXERCISE_CHORD_CHOICES) {
        const lesson = rollLesson(roll.id, chord)!;
        const measures = parseTab(lesson.tab!).measures;
        expect(errors(measures), chord).toEqual([]);
        // The thumb moves to the 4th string only where the open 5th clashes (E7's G♯).
        const want = roll.exampleStrings.map((s) => (s === 5 && chord === "E7" ? 4 : s));
        for (const s of strings(lesson.tab!)) expect(s, chord).toEqual(want);
      }
    });
  }
});

describe("rolls outside a beginner's lanes are called out, not changed", () => {
  it("only the Foggy Mountain roll is advanced, and it says why", () => {
    const advanced = ROLLS.filter((r) => advancedNote(r) !== null).map((r) => r.id);
    expect(advanced).toEqual(["foggy-mountain"]);
    expect(advancedNote(ROLLS.find((r) => r.id === "foggy-mountain")!)).toBe(
      "Advanced: the thumb plays the 2nd string. Tabs written for a beginner leave it out unless you choose it.",
    );
  });

  it("its exercise and lesson still play the thumb on the 2nd string, tagged advanced", () => {
    for (const song of [rollExercise("foggy-mountain"), rollLesson("foggy-mountain")]) {
      const notes = parseTab(song!.tab ?? "").measures.flatMap((m) => m.notes);
      expect(notes.some((n) => n.finger === "T" && n.string === 2)).toBe(true);
      expect(song!.tags).toContain("advanced");
      expect(song!.credit).toContain("Advanced:");
    }
    expect(rollExercise("forward")!.tags).not.toContain("advanced");
  });
});

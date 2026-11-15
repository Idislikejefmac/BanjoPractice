// F47 · The lessons: every entry is well formed and short, the queries behind the Lessons screen
// work, and the instructors named as a roll's source really have a lesson that states that roll.
import { describe, expect, it } from "vitest";
import { ROLLS } from "../../src/core/banjo/rolls.ts";
import {
  bothCover,
  INSTRUCTORS,
  LESSONS,
  lessonById,
  lessonProblems,
  lessonsFor,
  lessonsOnRoll,
  lessonsOnTopic,
  lessonUrl,
  needsMore,
  relatedLessons,
  TOPICS,
  topicsInUse,
} from "../../src/core/learning/lessons.ts";
import type { InstructorId, Lesson } from "../../src/core/learning/lessons.ts";

const ROLL_IDS = ROLLS.map((r) => r.id);

describe("lesson data (F47)", () => {
  it("has lessons from both instructors", () => {
    expect(lessonsFor("tony-trischka")).toHaveLength(15);
    expect(lessonsFor("jens-kruger").length).toBeGreaterThanOrEqual(25);
    expect(LESSONS.length).toBe(
      lessonsFor("tony-trischka").length + lessonsFor("jens-kruger").length,
    );
  });

  it("every lesson is well formed and within the length limits", () => {
    for (const l of LESSONS) expect(lessonProblems(l, ROLL_IDS), l.id).toEqual([]);
  });

  it("ids are unique, and a video appears twice only as separately timed sections", () => {
    const ids = LESSONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    const starts = LESSONS.map((l) => `${l.video.id}@${l.video.startSeconds ?? 0}`);
    expect(new Set(starts).size).toBe(starts.length);
    for (const l of LESSONS) {
      const same = LESSONS.filter((o) => o.video.id === l.video.id);
      if (same.length > 1) expect(l.video.startSeconds, l.id).toBeDefined();
    }
  });

  it("is written in our own words and public-safe: no links, paths or note markers", () => {
    const bad = /https?:|www\.|[A-Z]:\\|\\\\|\[(said|mine|caption\?)\]|transcript|caption/i;
    for (const l of LESSONS) {
      for (const t of [l.title, ...l.foundations, ...l.nuance]) expect(t, l.id).not.toMatch(bad);
    }
  });

  it("a lesson's own limits catch what they should", () => {
    const base = LESSONS[0]!;
    const p = (patch: Partial<Lesson>) => lessonProblems({ ...base, ...patch }, ROLL_IDS);
    expect(p({ foundations: [] })).toContain("needs 1 to 8 foundation points");
    expect(p({ foundations: ["x".repeat(300)] }).join()).toMatch(/over 260/);
    expect(p({ foundations: ["  untidy "] }).join()).toMatch(/untidy/);
    expect(p({ topics: [] })).toContain("needs 1 to 6 topics");
    expect(p({ topics: ["no-such-topic" as never] })).toContain('unknown topic "no-such-topic"');
    expect(p({ rolls: ["no-such-roll"] })).toContain('unknown roll "no-such-roll"');
    expect(p({ video: { id: "short", title: "t" } })).toContain("video id must be 11 characters");
    expect(p({ id: "Bad Id" })).toContain("id must be lower-case words joined by hyphens");
    expect(p({ completeness: "great" as never })).toContain("unknown completeness");
  });

  it("every topic used has a name, and every instructor a name and blurb", () => {
    for (const l of LESSONS) for (const t of l.topics) expect(TOPICS[t].name).toBeTruthy();
    for (const id of Object.keys(INSTRUCTORS) as InstructorId[]) {
      expect(INSTRUCTORS[id].name).toBeTruthy();
      expect(INSTRUCTORS[id].blurb).toBeTruthy();
    }
  });
});

describe("lesson queries (F47)", () => {
  it("lists an instructor's lessons in series order", () => {
    for (const who of ["jens-kruger", "tony-trischka"] as const) {
      const orders = lessonsFor(who).map((l) => l.order);
      expect(orders).toEqual([...orders].sort((a, b) => a - b));
    }
  });

  it("groups the topics in use, and says where both instructors cover one", () => {
    const groups = topicsInUse();
    expect(groups.length).toBeGreaterThan(3);
    for (const { topics } of groups)
      for (const t of topics) expect(lessonsOnTopic(t).length).toBeGreaterThan(0);
    expect(bothCover("roll-forward-backward")).toBe(true);
    expect(bothCover("travis-picking")).toBe(false);
  });

  it("puts the other instructor's lessons first among the related ones", () => {
    const jens2 = lessonById("jens-lesson-02-forward-backward-roll")!;
    const related = relatedLessons(jens2);
    expect(related.length).toBeGreaterThan(0);
    expect(related.length).toBeLessThanOrEqual(4);
    expect(related[0]!.instructor).toBe("tony-trischka");
    expect(related.map((l) => l.id)).not.toContain(jens2.id);
  });

  it("builds the video link, with a start time for a section of a long video", () => {
    const one = lessonById("jens-lesson-02-forward-backward-roll")!;
    expect(lessonUrl(one)).toBe("https://www.youtube.com/watch?v=Eb31RXfA9Mk");
    const timed = LESSONS.find((l) => l.video.startSeconds)!;
    expect(lessonUrl(timed)).toBe(
      `https://www.youtube.com/watch?v=${timed.video.id}&t=${timed.video.startSeconds}s`,
    );
  });

  it("counts the lessons that still need more information", () => {
    const more = LESSONS.filter(needsMore);
    expect(more.length).toBeGreaterThan(0);
    expect(more.every((l) => l.completeness !== "full")).toBe(true);
  });
});

describe("rolls and the lessons that back their sources (F47)", () => {
  it("a roll names Jens Kruger or Tony Trischka only if one of their lessons states that roll", () => {
    for (const roll of ROLLS) {
      for (const who of ["jens-kruger", "tony-trischka"] as const) {
        if (!(roll.sources as readonly string[]).includes(who)) continue;
        const backed = lessonsOnRoll(roll.id).filter((l) => l.instructor === who);
        expect(
          backed.length,
          `${roll.id} lists ${who} but none of their lessons states it`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("finds the lessons on the forward-backward roll from both instructors", () => {
    const who = lessonsOnRoll("forward-reverse").map((l) => l.instructor);
    expect(new Set(who)).toEqual(new Set(["jens-kruger", "tony-trischka"]));
  });

  it("every lesson roll id is a real roll", () => {
    for (const l of LESSONS) for (const r of l.rolls ?? []) expect(ROLL_IDS).toContain(r);
  });
});

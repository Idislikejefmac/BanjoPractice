import { describe, expect, it } from "vitest";
import type { OpenSession } from "../../src/app/practiceLog.ts";
import {
  applyLogEvent,
  close,
  localDate,
  practiceSessionProblems,
  SESSION_GAP_MS,
} from "../../src/app/practiceLog.ts";

let n = 0;
const id = () => `s${++n}`;
const wall = new Date(2026, 10, 8, 19, 30);

describe("F21 practice log", () => {
  it("records minutes played, start and highest tempo, and loops", () => {
    let open: OpenSession | null = null;
    ({ open } = applyLogEvent(
      open,
      { kind: "play", songId: "cc", tempo: 80, loop: null },
      0,
      wall,
      id,
    ));
    ({ open } = applyLogEvent(open, { kind: "tempo", tempo: 92 }, 60_000, wall, id));
    ({ open } = applyLogEvent(open, { kind: "stop" }, 120_000, wall, id));
    ({ open } = applyLogEvent(
      open,
      { kind: "play", songId: "cc", tempo: 88, loop: "5–8" },
      180_000,
      wall,
      id,
    ));
    const s = close(open!, 240_000);
    expect(s).toMatchObject({
      songId: "cc",
      startTempo: 80,
      highestTempo: 92,
      minutes: 3,
      loops: ["5–8"],
      date: "2026-11-08",
    });
    expect(practiceSessionProblems(s)).toEqual([]);
  });

  it("starts a new session after 10 minutes without playback, or on another song", () => {
    let open: OpenSession | null = null;
    ({ open } = applyLogEvent(
      open,
      { kind: "play", songId: "cc", tempo: 80, loop: null },
      0,
      wall,
      id,
    ));
    ({ open } = applyLogEvent(open, { kind: "stop" }, 60_000, wall, id));
    let r = applyLogEvent(
      open,
      { kind: "play", songId: "cc", tempo: 80, loop: null },
      60_000 + SESSION_GAP_MS + 1,
      wall,
      id,
    );
    expect(r.finished?.minutes).toBe(1);
    r = applyLogEvent(
      r.open,
      { kind: "play", songId: "ojc", tempo: 90, loop: null },
      60_000 + SESSION_GAP_MS + 2,
      wall,
      id,
    );
    expect(r.finished?.songId).toBe("cc");
    expect(r.open?.session.songId).toBe("ojc");
  });

  it("never records a negative duration, even if the wall clock jumps back", () => {
    let open: OpenSession | null = null;
    ({ open } = applyLogEvent(
      open,
      { kind: "play", songId: "cc", tempo: 80, loop: null },
      5_000,
      wall,
      id,
    ));
    ({ open } = applyLogEvent(open, { kind: "stop" }, 4_000, new Date(2020, 0, 1), id));
    expect(close(open!, 4_000).minutes).toBe(0);
  });

  it("uses the local calendar date", () => {
    expect(localDate(new Date(2026, 0, 2, 23, 59))).toBe("2026-01-02");
  });
});

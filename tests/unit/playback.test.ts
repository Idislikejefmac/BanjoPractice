import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { AudioOut, Program, ScheduledNote } from "../../src/audio/scheduler.ts";
import { Scheduler } from "../../src/audio/scheduler.ts";
import { capoPlan } from "../../src/core/banjo/tuning.ts";
import { countInEvents, generateEvents, slotSeconds } from "../../src/core/playback/generators.ts";
import { endingPasses, loopOrder, playbackOrder } from "../../src/core/playback/order.ts";
import { indexAbc } from "../../src/core/song/abcIndex.ts";
import { builtinSong, loadSong } from "../../src/core/song/song.ts";
import { createFakeClock } from "../../src/platform/fakes.ts";

const HEADER = "X:1\nM:4/4\nL:1/8\nQ:1/4=120\nK:G\n";

describe("C9 playback order", () => {
  it("plays repeats twice and skips first endings the second time", () => {
    const idx = indexAbc(`${HEADER}|:G8|A8|[1B8:|[2c8|d8|]`);
    // positions: 0 G, 1 A, 2 B (1st ending), 3 c (2nd ending), 4 d
    expect(playbackOrder(idx)).toEqual([0, 1, 2, 0, 1, 3, 4]);
  });

  it("plays a verse three times for endings [1,2 and [3 (one verse per pass)", () => {
    const idx = indexAbc(`${HEADER}|:G8|A8|[1,2B8:|[3c8|]`);
    // positions: 0 G, 1 A, 2 B (endings 1 and 2), 3 c (ending 3)
    expect(playbackOrder(idx)).toEqual([0, 1, 2, 0, 1, 2, 0, 1, 3]);
  });

  it("skips a several-measure ending on the passes it doesn't name ([1-3 … :|[4)", () => {
    const idx = indexAbc(`${HEADER}|:G8|[1-3A8|B8:|[4c8|d8|]`);
    // positions: 0 G, 1-2 the ending for passes 1-3, 3 c (ending 4), 4 d
    expect(playbackOrder(idx)).toEqual([0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 3, 4]);
  });

  it("reads ending labels as the passes they name", () => {
    expect(endingPasses("1")).toEqual([1]);
    expect(endingPasses("1,2")).toEqual([1, 2]);
    expect(endingPasses("1-3")).toEqual([1, 2, 3]);
    expect(endingPasses("1,2,3")).toEqual([1, 2, 3]);
    expect(endingPasses("?")).toEqual([1]);
  });

  it("repeats an AABB tune part by part", () => {
    const idx = indexAbc(`${HEADER}|:G8|A8:||:B8|c8:|`);
    expect(playbackOrder(idx)).toEqual([0, 1, 0, 1, 2, 3, 2, 3]);
  });

  it("section loops play written measures a..b in order, ignoring repeats", () => {
    const idx = indexAbc(`${HEADER}|:G8|A8:||:B8|c8:|`);
    expect(loopOrder(idx, { kind: "section", from: 2, to: 3 })).toEqual([1, 2]);
    expect(loopOrder(idx, { kind: "section", from: 3, to: 2 })).toEqual([1, 2]);
  });
});

describe("A3 part generators", () => {
  const idx = indexAbc(`${HEADER}"G"G2 A2 "D"B2 c2|"C"c8|]`);

  it("melody follows the notation, transposed", () => {
    const ev = generateEvents(idx, null, { transpose: 2 });
    const melody = ev[0]!.events.filter((e) => e.part === "melody");
    expect(melody.map((e) => [e.slot, e.midi])).toEqual([
      [0, 69],
      [2, 71],
      [4, 73],
      [6, 74],
    ]);
  });

  it("chords play boom-chuck: bass on 1 and 3 (root, then fifth), strums on 2 and 4", () => {
    const ev = generateEvents(idx, null, { transpose: 0 });
    const chords = ev[1]!.events.filter((e) => e.part === "chords");
    const bass = chords.filter((e) => e.strumStep === undefined);
    expect(bass.map((e) => [e.slot, e.midi % 12])).toEqual([
      [0, 0], // C
      [4, 7], // G, the fifth
    ]);
    const strums = chords.filter((e) => e.strumStep !== undefined);
    expect(new Set(strums.map((e) => e.slot))).toEqual(new Set([2, 6]));
    expect(new Set(strums.map((e) => e.midi % 12))).toEqual(new Set([0, 4, 7]));
  });

  it("half-measure chord changes move the bass", () => {
    const ev = generateEvents(idx, null, { transpose: 0 });
    const bass = ev[0]!.events.filter((e) => e.part === "chords" && e.strumStep === undefined);
    expect(bass.map((e) => e.midi % 12)).toEqual([7, 9]); // G root, then A: the fifth of D
  });

  it("banjo notes sound at the tab's pitch for the capo, melody loudest", () => {
    const song = builtinSong(
      "cc",
      readFileSync(new URL("../fixtures/songs/cripple-creek.abc", import.meta.url), "utf8"),
      readFileSync(new URL("../fixtures/songs/cripple-creek.tab", import.meta.url), "utf8"),
    );
    const loaded = loadSong(song);
    const plain = generateEvents(loaded.index, loaded.arrangement!.measures, { transpose: 0 });
    const capo2 = generateEvents(loaded.index, loaded.arrangement!.measures, {
      transpose: 2,
      plan: capoPlan(2),
    });
    const banjo = (ev: typeof plain) => ev[0]!.events.filter((e) => e.part === "banjo");
    expect(banjo(capo2).map((e) => e.midi)).toEqual(banjo(plain).map((e) => e.midi + 2));
    const first = banjo(plain)[0]!;
    const filler = banjo(plain)[1]!;
    expect(first.velocity).toBeGreaterThan(filler.velocity);
    // The banjo melody note sounds an octave under the written melody (C9).
    const melody = plain[0]!.events.find((e) => e.part === "melody")!;
    expect(melody.midi - first.midi).toBe(12);
  });

  it("metronome clicks every beat with an accented downbeat, or on 2 and 4", () => {
    const every = generateEvents(idx, null, { transpose: 0 })[0]!.events.filter(
      (e) => e.part === "metronome",
    );
    expect(every.map((e) => [e.slot, e.midi])).toEqual([
      [0, 1],
      [2, 0],
      [4, 0],
      [6, 0],
    ]);
    const backbeat = generateEvents(idx, null, { transpose: 0, metronome: "two-and-four" })[0]!
      .events.filter((e) => e.part === "metronome")
      .map((e) => e.slot);
    expect(backbeat).toEqual([2, 6]);
  });

  it("works out slot length from Q: (quarter = 120 → eighth slots of 0.25 s)", () => {
    expect(slotSeconds(idx, 120)).toBeCloseTo(0.25);
    expect(slotSeconds(indexAbc("X:1\nM:2/4\nL:1/16\nQ:1/4=120\nK:G\nG8|]"), 120)).toBeCloseTo(
      0.125,
    );
  });
});

// --- A1 scheduler, driven by a fake clock -------------------------------------------------

function rig() {
  const clock = createFakeClock(0);
  const played: ScheduledNote[] = [];
  let stops = 0;
  /** Extra audio time, to simulate a throttled page whose timers fire late. */
  const skew = { s: 0 };
  const out: AudioOut = {
    now: () => clock.now() / 1000 + skew.s,
    play: (n) => played.push(n),
    stopAll: () => void stops++,
  };
  const scheduler = new Scheduler(out, clock);
  return { clock, played, scheduler, stops: () => stops, skew };
}

const idx = indexAbc(`${HEADER}"G"G2 A2 B2 c2|"C"c8|]`);
function program(over: Partial<Program> = {}): Program {
  return {
    measures: generateEvents(idx, null, { transpose: 0 }),
    order: playbackOrder(idx),
    slotSeconds: (bpm) => slotSeconds(idx, bpm),
    countIn: null,
    repeat: false,
    gapSlots: 0,
    ...over,
  };
}
const run = (clock: ReturnType<typeof createFakeClock>, ms: number) => {
  for (let t = 0; t < ms; t += 5) clock.advance(5);
};

describe("A1 scheduler", () => {
  it("plays every note once, in time, then stops by itself", () => {
    const { clock, played, scheduler } = rig();
    scheduler.start(program(), { bpm: 120 });
    run(clock, 5000);
    const melody = played.filter((n) => n.part === "melody");
    expect(melody.map((n) => n.midi)).toEqual([67, 69, 71, 72, 72]);
    const t0 = melody[0]!.time;
    expect(melody.map((n) => +(n.time - t0).toFixed(3))).toEqual([0, 0.5, 1, 1.5, 2]);
    expect(scheduler.state).toBe("stopped");
    expect(scheduler.lateSlots).toBe(0);
  });

  it("applies a tempo change from the next slot without stopping", () => {
    const { clock, played, scheduler } = rig();
    scheduler.start(program(), { bpm: 120 });
    run(clock, 300);
    scheduler.setTempo(60);
    run(clock, 8000);
    const melody = played.filter((n) => n.part === "melody").map((n) => n.time);
    const gaps = melody.slice(1).map((t, i) => +(t - melody[i]!).toFixed(3));
    expect(gaps[0]).toBeLessThan(1);
    expect(gaps[gaps.length - 1]).toBeCloseTo(1); // quarter notes at 60 bpm
  });

  it("mutes a part live", () => {
    const { clock, played, scheduler } = rig();
    scheduler.start(program(), { bpm: 120 });
    run(clock, 200);
    scheduler.setPart("melody", false);
    run(clock, 5000);
    expect(played.filter((n) => n.part === "melody").length).toBeLessThan(3);
    expect(played.some((n) => n.part === "chords" && n.time > 1)).toBe(true);
  });

  it("stops everything at once and schedules nothing after Stop (I4)", () => {
    const { clock, played, scheduler, stops } = rig();
    scheduler.start(program(), { bpm: 120 });
    run(clock, 600);
    scheduler.stop();
    const count = played.length;
    run(clock, 3000);
    expect(played.length).toBe(count);
    expect(stops()).toBeGreaterThan(0);
    expect(scheduler.state).toBe("stopped");
    expect(scheduler.positionAt(clock.now() / 1000)).toBeNull();
  });

  it("counts in, then plays, and reports the playing measure (F7, F10)", () => {
    const { clock, played, scheduler } = rig();
    scheduler.start(program({ countIn: countInEvents(idx, 4) }), { bpm: 120 });
    expect(scheduler.state).toBe("count-in");
    run(clock, 1600);
    expect(played.filter((n) => n.part === "metronome").length).toBeGreaterThanOrEqual(4);
    run(clock, 900);
    expect(scheduler.state).toBe("playing");
    const mark = scheduler.positionAt(clock.now() / 1000);
    expect(mark?.position).toBe(0);
    run(clock, 2000);
    expect(scheduler.positionAt(clock.now() / 1000)?.position).toBe(1);
  });

  it("loops with a pause and a speed builder that stops at the target (F8, F9, F27)", () => {
    const { clock, played, scheduler } = rig();
    scheduler.start(program({ repeat: true, gapSlots: 4 }), {
      bpm: 120,
      speedBuilder: { startBpm: 100, stepBpm: 10, targetBpm: 120 },
    });
    run(clock, 30_000);
    expect(scheduler.state).toBe("playing");
    expect(scheduler.tempo).toBe(120);
    const firstNotes = played.filter((n) => n.part === "melody" && n.midi === 67);
    expect(firstNotes.length).toBeGreaterThan(3);
    scheduler.stop();
  });

  it("counts late slots when the page was throttled (background tab)", () => {
    const { clock, scheduler, skew, played } = rig();
    scheduler.start(program({ repeat: true }), { bpm: 120 });
    run(clock, 500);
    const before = played.length;
    skew.s += 2; // audio time ran on while the page's timers were frozen
    run(clock, 100);
    // No burst of overdue notes: everything played after the jump is in the future.
    const now = clock.now() / 1000 + skew.s;
    expect(played.slice(before).every((n) => n.time >= now - 0.2)).toBe(true);
    expect(scheduler.lateSlots).toBeGreaterThan(0);
    scheduler.stop();
  });
});

describe("C9 parts (F26)", () => {
  it("finds the A and B parts of an AABB tune from its repeats", async () => {
    const { songParts } = await import("../../src/core/playback/parts.ts");
    const abc = readFileSync(
      new URL("../fixtures/songs/cripple-creek.abc", import.meta.url),
      "utf8",
    );
    expect(songParts(abc, indexAbc(abc))).toEqual([
      { label: "A", from: 1, to: 4 },
      { label: "B", from: 5, to: 8 },
    ]);
  });

  it("keeps a first and second ending in their part", async () => {
    const { songParts } = await import("../../src/core/playback/parts.ts");
    const abc = `${HEADER}|:G8|[1A8:|[2B8||:c8|d8:|`;
    expect(songParts(abc, indexAbc(abc))).toEqual([
      { label: "A", from: 1, to: 3 },
      { label: "B", from: 4, to: 5 },
    ]);
  });

  it("uses P: labels when the song has them, and none for a through-composed song", async () => {
    const { songParts } = await import("../../src/core/playback/parts.ts");
    const labeled = `${HEADER}P:A\nG8|A8|\nP:B\nB8|c8|]`;
    expect(songParts(labeled, indexAbc(labeled))).toEqual([
      { label: "A", from: 1, to: 2 },
      { label: "B", from: 3, to: 4 },
    ]);
    const hymn = readFileSync(
      new URL("../fixtures/songs/will-the-circle-be-unbroken.abc", import.meta.url),
      "utf8",
    );
    expect(songParts(hymn, indexAbc(hymn))).toEqual([]);
  });
});

describe("A1 practice modes (F27, F29)", () => {
  it("echo mode: a phrase plays, then repeats silently except the click, marked 'your turn'", () => {
    const { clock, played, scheduler } = rig();
    const base = program();
    scheduler.start(
      {
        ...base,
        order: [0, 0, 1, 1],
        silent: [false, true, false, true],
      },
      { bpm: 120 },
    );
    scheduler.setPart("metronome", true);
    let yourTurnSeen = false;
    for (let t = 0; t < 9000; t += 5) {
      clock.advance(5);
      const mark = scheduler.positionAt(clock.now() / 1000);
      if (mark?.orderIndex === 1 && mark.yourTurn) yourTurnSeen = true;
    }
    expect(yourTurnSeen).toBe(true);
    // Each measure's melody sounds once (not in its silent repeat).
    expect(played.filter((n) => n.part === "melody").map((n) => n.midi)).toEqual([
      67, 69, 71, 72, 72,
    ]);
    // The click keeps going through the silent phrases.
    const t0 = played[0]!.time;
    const silentWindow = played.filter((n) => n.time - t0 > 2.05 && n.time - t0 < 3.95);
    expect(silentWindow.length).toBeGreaterThan(0);
    expect(silentWindow.every((n) => n.part === "metronome")).toBe(true);
  });

  it("loop pause: a gap with count-in clicks between repeats", () => {
    const { clock, played, scheduler } = rig();
    scheduler.start(
      { ...program({ repeat: true, gapSlots: 4, gap: countInEvents(idx, 2) }) },
      { bpm: 120 },
    );
    scheduler.setPart("metronome", false); // gap clicks play even with the click part off
    run(clock, 6000);
    scheduler.stop();
    const melody = played.filter((n) => n.part === "melody");
    const t0 = melody[0]!.time;
    const second = melody.find((n, i) => i > 0 && n.midi === 67)!;
    // 4 s of music + 1 s of pause at 120 bpm.
    expect(second.time - t0).toBeCloseTo(5, 1);
    const clicks = played.filter(
      (n) => n.part === "metronome" && n.time > t0 + 3.9 && n.time < t0 + 5,
    );
    expect(clicks).toHaveLength(2);
  });
});

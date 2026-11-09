// A1 · Look-ahead scheduler on one audio clock (DEVELOPMENT.md §6 A1).
//
// Every tick (25 ms) it schedules whatever falls in the next ~100 ms, one slot at a time, so
// tempo changes apply from the next slot, parts can be muted live, and loops are seamless.
// It knows nothing about Web Audio: `out` plays notes at audio times, `clock` runs the tick.
// That keeps it unit-testable with a fake clock (and with OfflineAudioContext in chaos tests).

import type { MeasureEvents, Part } from "../core/playback/generators.ts";
import type { Clock } from "../platform/types.ts";

export interface ScheduledNote {
  readonly time: number;
  readonly duration: number;
  readonly midi: number;
  readonly velocity: number;
  readonly part: Part;
}

export interface AudioOut {
  /** Audio clock, seconds. */
  now(): number;
  play(note: ScheduledNote): void;
  /** Silence everything scheduled or sounding, now. */
  stopAll(): void;
}

export interface SpeedBuilder {
  readonly startBpm: number;
  readonly stepBpm: number;
  readonly targetBpm: number;
}

export interface Program {
  /** Events per written measure, by position. */
  readonly measures: readonly MeasureEvents[];
  /** Positions for one pass (playback order, or a section loop). */
  readonly order: readonly number[];
  /** Seconds per slot at a tempo. */
  slotSeconds(bpm: number): number;
  /** Count-in, played once before the first pass (null for none). */
  readonly countIn: MeasureEvents | null;
  /** Repeat the order forever (auto-repeat / loop). */
  readonly repeat: boolean;
  /** Silent slots between repeats (F27 loop pause). */
  readonly gapSlots: number;
  /** What plays during the pause (count-in clicks), if anything. */
  readonly gap?: MeasureEvents | null;
  /**
   * F29 echo mode: order entries marked true are "your turn": only the metronome plays.
   * Same length as `order` when given.
   */
  readonly silent?: readonly boolean[];
}

export interface PositionMark {
  /** Audio time this slot starts. */
  readonly time: number;
  /** Index into program.order, or -1 during count-in and loop gaps. */
  readonly orderIndex: number;
  /** Position in the song's measures, or -1. */
  readonly position: number;
  readonly slot: number;
  readonly pass: number;
  readonly bpm: number;
  /** F29: this slot is in a silent "your turn" phrase. */
  readonly yourTurn?: boolean;
}

export type TransportState = "stopped" | "count-in" | "playing";

const LOOKAHEAD = 0.1;
const TICK_MS = 25;
const START_DELAY = 0.06;
const STRUM_STEP = 0.012;

interface Cursor {
  phase: "count-in" | "gap" | "song";
  orderIndex: number;
  slot: number;
  time: number;
  pass: number;
  gapLeft: number;
}

export class Scheduler {
  private readonly out: AudioOut;
  private readonly clock: Clock;
  private program: Program | null = null;
  private cursor: Cursor | null = null;
  private timer: number | null = null;
  private bpm = 100;
  private speed: SpeedBuilder | null = null;
  private enabled: Record<Part, boolean> = {
    melody: true,
    chords: true,
    banjo: true,
    metronome: true,
  };
  private volume: Record<Part, number> = { melody: 1, chords: 1, banjo: 1, metronome: 1 };
  private marks: PositionMark[] = [];
  private listeners = new Set<() => void>();
  private _state: TransportState = "stopped";
  private endTime = 0;
  /** Slots that were scheduled after their time had already passed (I4, phase-2 exit). */
  lateSlots = 0;

  constructor(out: AudioOut, clock: Clock) {
    this.out = out;
    this.clock = clock;
  }

  get state(): TransportState {
    return this._state;
  }

  get tempo(): number {
    return this.bpm;
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setState(s: TransportState): void {
    if (s === this._state) return;
    this._state = s;
    this.listeners.forEach((l) => l());
  }

  start(
    program: Program,
    opts: { bpm: number; fromOrderIndex?: number; speedBuilder?: SpeedBuilder | null },
  ): void {
    this.stop();
    this.program = program;
    this.speed = opts.speedBuilder ?? null;
    this.bpm = this.speed ? this.speed.startBpm : opts.bpm;
    this.lateSlots = 0;
    const startAt = this.out.now() + START_DELAY;
    this.cursor = {
      phase: program.countIn ? "count-in" : "song",
      orderIndex: Math.max(0, Math.min(opts.fromOrderIndex ?? 0, program.order.length - 1)),
      slot: 0,
      time: startAt,
      pass: 0,
      gapLeft: 0,
    };
    this.endTime = Infinity;
    this.setState(program.countIn ? "count-in" : "playing");
    this.tick();
  }

  stop(): void {
    if (this.timer !== null) this.clock.clearTimeout(this.timer);
    this.timer = null;
    this.cursor = null;
    this.marks = [];
    this.out.stopAll();
    this.setState("stopped");
  }

  /** Applies from the next slot. Ignored while the speed builder is running it. */
  setTempo(bpm: number): void {
    this.bpm = Math.max(20, Math.min(300, bpm));
  }

  setPart(part: Part, enabled: boolean, volume?: number): void {
    this.enabled[part] = enabled;
    if (volume !== undefined) this.volume[part] = Math.max(0, Math.min(1, volume));
  }

  /** Where playback is at audio time `t` (latency already subtracted by the caller). */
  positionAt(t: number): PositionMark | null {
    let found: PositionMark | null = null;
    for (const m of this.marks) {
      if (m.time <= t + 1e-6) found = m;
      else break;
    }
    return found;
  }

  private tick = (): void => {
    this.timer = null;
    const program = this.program;
    const c = this.cursor;
    if (!program || !c) return;
    const now = this.out.now();
    const horizon = now + LOOKAHEAD;

    while (c.time < horizon && Number.isFinite(this.endTime) === false) {
      if (c.time < now - 0.005) {
        // Overdue (the page was frozen or the clock jumped): skip it rather than play a
        // burst of old notes, and resync to now (CHAOS_TESTING.md §6.2).
        this.lateSlots++;
        this.marks.push({
          time: c.time,
          orderIndex: c.phase === "song" ? c.orderIndex : -1,
          position: c.phase === "song" ? (this.measureFor(program, c)?.position ?? -1) : -1,
          slot: c.slot,
          pass: c.pass,
          bpm: this.bpm,
        });
        if (!this.advance(program, c)) {
          this.endTime = c.time;
          break;
        }
        continue;
      }
      this.scheduleSlot(program, c);
      if (!this.advance(program, c)) {
        this.endTime = c.time;
        break;
      }
    }
    // Forget marks well in the past.
    const cutoff = now - 2;
    while (this.marks.length > 1 && this.marks[1]!.time < cutoff) this.marks.shift();

    const mark = this.positionAt(now);
    if (this._state === "count-in" && mark && mark.orderIndex >= 0) this.setState("playing");
    if (Number.isFinite(this.endTime) && now >= this.endTime) {
      this.program = null;
      this.cursor = null;
      this.marks = [];
      this.setState("stopped");
      return;
    }
    this.timer = this.clock.setTimeout(this.tick, TICK_MS);
  };

  private measureFor(program: Program, c: Cursor): MeasureEvents | null {
    if (c.phase === "count-in") return program.countIn;
    if (c.phase === "gap") return program.gap ?? null;
    return program.measures[program.order[c.orderIndex]!] ?? null;
  }

  private scheduleSlot(program: Program, c: Cursor): void {
    const slotSec = program.slotSeconds(this.bpm);
    const m = this.measureFor(program, c);
    const yourTurn = c.phase === "song" && program.silent?.[c.orderIndex] === true;
    this.marks.push({
      time: c.time,
      orderIndex: c.phase === "song" ? c.orderIndex : -1,
      position: c.phase === "song" ? (m?.position ?? -1) : -1,
      slot: c.slot,
      pass: c.pass,
      bpm: this.bpm,
      ...(yourTurn ? { yourTurn } : {}),
    });
    if (!m) return;
    for (const e of m.events) {
      if (e.slot < c.slot || e.slot >= c.slot + 1) continue;
      // Count-in and gap clicks always play; in a "your turn" phrase only the click does.
      const forced = c.phase !== "song" || (yourTurn && e.part === "metronome");
      if (yourTurn && e.part !== "metronome") continue;
      if (!forced && !this.enabled[e.part]) continue;
      const velocity = e.velocity * this.volume[e.part];
      if (velocity <= 0) continue;
      this.out.play({
        time: c.time + (e.slot - c.slot) * slotSec + (e.strumStep ?? 0) * STRUM_STEP,
        duration: e.duration * slotSec,
        midi: e.midi,
        velocity,
        part: e.part,
      });
    }
  }

  /** Moves the cursor to the next slot. Returns false at the end of a non-repeating program. */
  private advance(program: Program, c: Cursor): boolean {
    c.time += program.slotSeconds(this.bpm);
    c.slot++;
    if (c.phase === "gap") {
      if (--c.gapLeft > 0) return true;
      c.orderIndex = 0;
      c.phase = "song";
      c.slot = 0;
      return true;
    }
    const m = this.measureFor(program, c);
    if (m && c.slot < m.slots) return true;
    c.slot = 0;
    if (c.phase === "count-in") {
      c.phase = "song";
      return true;
    }
    if (c.orderIndex + 1 < program.order.length) {
      c.orderIndex++;
      return true;
    }
    if (!program.repeat) return false;
    // Next pass: speed builder steps up, then an optional pause.
    c.pass++;
    c.orderIndex = 0;
    if (this.speed) {
      this.bpm = Math.min(this.speed.targetBpm, this.bpm + this.speed.stepBpm);
    }
    if (program.gapSlots > 0) {
      c.phase = "gap";
      c.gapLeft = program.gapSlots;
    }
    return true;
  }
}

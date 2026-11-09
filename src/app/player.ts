// Transport (F6–F9, F11, F13): builds the playback program from the open song and its
// practice state, drives the scheduler, follows the audio position for the highlight (F10),
// and handles the pedal.

import { effect, signal } from "@preact/signals";
import { AudioEngine } from "../audio/engine.ts";
import type { Program } from "../audio/scheduler.ts";
import { Scheduler } from "../audio/scheduler.ts";
import type { PositionPlan } from "../core/banjo/position.ts";
import {
  countInEvents,
  generateEvents,
  slotSeconds,
  slotsPerBeat,
} from "../core/playback/generators.ts";
import { loopOrder, playbackOrder } from "../core/playback/order.ts";
import type { LoadedSong } from "../core/song/song.ts";
import { loadSong } from "../core/song/song.ts";
import type { PracticeArrangement } from "../core/song/practiceArrangement.ts";
import { practiceArrangement } from "../core/song/practiceArrangement.ts";
import type {
  AudioService,
  Clock,
  InputService,
  SampleLoader,
  ShareService,
} from "../platform/types.ts";
import { AudioUnavailableError } from "../platform/types.ts";
import type { Diagnostics } from "../platform/diagnostics.ts";
import { DEFAULT_TEMPO } from "./model.ts";
import type { AppStore } from "./store.ts";

export interface PlayerDeps {
  readonly audio: AudioService;
  readonly samples: SampleLoader;
  readonly clock: Clock;
  readonly input: InputService;
  readonly share: ShareService;
  readonly diagnostics: Diagnostics;
}

export type PlayerState = "stopped" | "loading" | "count-in" | "playing";

export interface Follow {
  /** Written measure number playing now, or null. */
  readonly measure: number | null;
  /** Count-in beat (1-based) while counting in. */
  readonly countIn: number | null;
  readonly pass: number;
  readonly bpm: number;
  /** Slot (0-based) within the playing measure, for the finger strip (F30). */
  readonly slot: number | null;
  /** Beat counter, increasing; the visual metronome flashes when it changes (F31). */
  readonly beat: number;
  /** F29: a silent "your turn" phrase is playing. */
  readonly yourTurn: boolean;
  /** Index into the playback order (for the finger strip), or -1. */
  readonly orderIndex: number;
}

/** F28 step mode: where the step cursor is. */
export interface StepPosition {
  /** Index into the step order (written measures in the loop, or the whole song). */
  readonly orderIndex: number;
  readonly slot: number;
}

export class Player {
  readonly state = signal<PlayerState>("stopped");
  readonly follow = signal<Follow>({
    measure: null,
    countIn: null,
    pass: 0,
    bpm: DEFAULT_TEMPO,
    slot: null,
    beat: 0,
    yourTurn: false,
    orderIndex: -1,
  });
  /** F28: step mode is on when this isn't null. */
  readonly step = signal<StepPosition | null>(null);
  private lastOrder: readonly number[] = [];
  readonly engine: AudioEngine;
  readonly scheduler: Scheduler;
  private readonly deps: PlayerDeps;
  private readonly store: AppStore;
  private frame = 0;
  private loadedId: string | null = null;
  private loaded: LoadedSong | null = null;
  private startToken = 0;
  /** After an interruption, Play carries on from this measure. */
  private resumeFrom: number | null = null;
  private warnedFallback = false;
  private lastBeatKey = "";
  private beatCount = 0;

  constructor(deps: PlayerDeps, store: AppStore) {
    this.deps = deps;
    this.store = store;
    this.engine = new AudioEngine(deps.audio, deps.samples);
    this.scheduler = new Scheduler(this.engine, {
      now: () => deps.clock.now(),
      setTimeout: (fn, ms) => deps.clock.setTimeout(fn, ms),
      clearTimeout: (id) => deps.clock.clearTimeout(id),
    });
    this.scheduler.onChange(() => {
      const s = this.scheduler.state;
      if (this.state.peek() !== "loading") this.state.value = s;
      if (s === "stopped") this.stopFollowing();
    });

    // Live changes while playing: tempo and parts (F6, F9).
    effect(() => {
      const p = store.practice.value;
      if (!p.speedBuilder.enabled) this.scheduler.setTempo(this.tempoFor(p.tempoBpm));
      for (const part of ["melody", "chords", "banjo"] as const) {
        this.scheduler.setPart(part, p.parts[part].on, p.parts[part].volume);
      }
      this.scheduler.setPart("metronome", p.metronome === "throughout", p.clickVolume);
    });
    effect(() => {
      this.engine.melodyInstrument = store.settings.value.melodyInstrument;
    });
    // A different song stops playback.
    effect(() => {
      const id = store.session.value.songId;
      if (id !== this.loadedId && this.state.peek() !== "stopped") this.stop();
    });

    // A phone call or another app took the audio (Safari's "interrupted"): stop cleanly
    // instead of showing a silent "playing" state. One tap on Play resumes (I10).
    deps.audio.onStateChange((audioState) => {
      if (
        (audioState === "interrupted" || audioState === "suspended") &&
        this.state.peek() !== "stopped" &&
        this.state.peek() !== "loading"
      ) {
        const measure = this.follow.peek().measure;
        this.stop();
        this.resumeFrom = measure;
        this.store.notify("info", "Paused by the iPad. Tap Play to carry on.");
      }
    });

    deps.input.onPedal((action) => {
      // In step mode the pedal steps: right = next note, left = previous (F13, F28).
      if (this.step.peek()) {
        void this.stepBy(action === "play-stop" || action === "next" ? 1 : -1);
        return;
      }
      if (action === "play-stop" || action === "next") void this.toggle();
      else this.restart();
    });
  }

  /** The open song, indexed (cached per song). */
  song(): LoadedSong | null {
    const s = this.store.currentSong.peek();
    if (!s) return null;
    if (this.loadedId !== s.id) {
      this.loaded = loadSong(s);
      this.loadedId = s.id;
    }
    return this.loaded;
  }

  private tempoFor(bpm: number | null): number {
    return bpm ?? this.loaded?.index.tempoBpm ?? DEFAULT_TEMPO;
  }

  /** The tab and capo plan for the open song at its practice key (F11, F14). */
  tab(): PracticeArrangement | null {
    const loaded = this.song();
    if (!loaded) return null;
    return practiceArrangement(
      loaded,
      this.store.practice.peek().keyShift,
      this.store.settings.peek().spikes,
    );
  }

  /** The capo plan for the open song at its practice key (F11). */
  plan(): PositionPlan | null {
    return this.tab()?.plan ?? null;
  }

  private program(loaded: LoadedSong): Program {
    const p = this.store.practice.peek();
    const tab = this.tab()!;
    const plan = tab.plan;
    const arranged = tab.measures;
    const measures = generateEvents(loaded.index, arranged, {
      transpose: p.keyShift,
      plan: plan.capo,
      metronome: p.clickPattern,
    });
    const base = p.loop
      ? loopOrder(loaded.index, { kind: "section", from: p.loop.from, to: p.loop.to })
      : playbackOrder(loaded.index);
    // F29 echo mode: each phrase is played, then repeated silently for Dad to play back.
    let order = base;
    let silent: boolean[] | undefined;
    if (p.echoMeasures > 0) {
      order = [];
      silent = [];
      for (let i = 0; i < base.length; i += p.echoMeasures) {
        const phrase = base.slice(i, i + p.echoMeasures);
        order.push(...phrase, ...phrase);
        silent.push(...phrase.map(() => false), ...phrase.map(() => true));
      }
    }
    const repeat = p.autoRepeat || p.loop !== null;
    const perBeat = slotsPerBeat(loaded.index);
    return {
      measures,
      order,
      ...(silent ? { silent } : {}),
      slotSeconds: (bpm) => slotSeconds(loaded.index, bpm),
      countIn: p.metronome === "off" ? null : countInEvents(loaded.index, p.countInBeats),
      repeat,
      // F27: a pause between repeats, with count-in clicks if the count-in is on.
      gapSlots: repeat ? p.loopGapBeats * perBeat : 0,
      gap:
        repeat && p.loopGapBeats > 0 && p.metronome !== "off"
          ? countInEvents(loaded.index, p.loopGapBeats)
          : null,
    };
  }

  /** Play (from a tap or the pedal). */
  async play(fromMeasure?: number): Promise<void> {
    const loaded = this.song();
    if (!loaded) return;
    const token = ++this.startToken;
    this.state.value = "loading";
    try {
      await this.deps.audio.unlock();
    } catch (e) {
      this.state.value = "stopped";
      this.store.notify(
        "info",
        e instanceof AudioUnavailableError
          ? "Sound isn't available in this browser."
          : "The iPad paused the sound. Tap Play again to start.",
      );
      this.deps.diagnostics.log(
        "warning",
        `Audio unlock: ${e instanceof Error ? e.message : String(e)}`,
      );
      return;
    }
    this.step.value = null;
    const program = this.program(loaded);
    this.lastOrder = program.order;
    const missing = await this.engine.prepare(program.measures.flatMap((m) => m.events));
    if (missing > 0) {
      this.deps.diagnostics.log(
        "warning",
        `${missing} instrument samples couldn't load; using generated sounds`,
      );
      if (!this.warnedFallback) {
        this.warnedFallback = true;
        this.store.notify(
          "info",
          "Some instrument sounds aren't downloaded yet, so a simpler sound is used for now.",
        );
      }
    }
    if (token !== this.startToken) return; // Stop or another Play happened meanwhile
    const p = this.store.practice.peek();
    let fromOrderIndex = 0;
    if (fromMeasure === undefined && this.resumeFrom !== null) fromMeasure = this.resumeFrom;
    this.resumeFrom = null;
    if (fromMeasure !== undefined) {
      const i = program.order.findIndex((pos) => loaded.index.measures[pos]?.index === fromMeasure);
      if (i >= 0) fromOrderIndex = i;
    }
    this.state.value = "count-in";
    const loopLabel = p.loop
      ? `${Math.min(p.loop.from, p.loop.to)}–${Math.max(p.loop.from, p.loop.to)}`
      : null;
    this.store.logPractice({
      kind: "play",
      songId: loaded.song.id,
      tempo: p.speedBuilder.enabled ? p.speedBuilder.startBpm : this.tempoFor(p.tempoBpm),
      loop: loopLabel,
    });
    this.scheduler.start(program, {
      bpm: this.tempoFor(p.tempoBpm),
      fromOrderIndex,
      speedBuilder: p.speedBuilder.enabled
        ? {
            startBpm: p.speedBuilder.startBpm,
            stepBpm: p.speedBuilder.stepBpm,
            targetBpm: p.speedBuilder.targetBpm,
          }
        : null,
    });
    this.state.value = this.scheduler.state;
    this.startFollowing(loaded);
  }

  stop(): void {
    if (this.state.peek() !== "stopped") this.store.logPractice({ kind: "stop" });
    this.startToken++;
    this.scheduler.stop();
    this.state.value = "stopped";
    this.stopFollowing();
  }

  async toggle(): Promise<void> {
    if (this.state.peek() === "stopped") await this.play();
    else this.stop();
  }

  restart(): void {
    this.resumeFrom = null;
    const wasPlaying = this.state.peek() !== "stopped";
    this.stop();
    if (wasPlaying) void this.play();
    else this.follow.value = { ...this.follow.peek(), measure: null };
  }

  /** Shares a file (F32 PDF) through the share sheet, with a notice if it fails. */
  async share(name: string, blob: Blob): Promise<void> {
    const r = await this.deps.share.shareFile(name, blob);
    if (r === "failed") this.store.notify("error", "Couldn't share the file. Try again.");
  }

  /** F16: sound a chord voicing on the banjo, strummed or picked low to high. */
  async playChord(midis: readonly number[], style: "strum" | "pick"): Promise<void> {
    try {
      await this.deps.audio.unlock();
    } catch (e) {
      this.store.notify(
        "info",
        e instanceof AudioUnavailableError
          ? "Sound isn't available in this browser."
          : "The iPad paused the sound. Tap again to hear it.",
      );
      return;
    }
    const notes = midis.map((midi) => ({ part: "banjo" as const, midi }));
    await this.engine.prepare(notes);
    const start = this.engine.now() + 0.03;
    const step = style === "strum" ? 0.03 : 0.3;
    midis.forEach((midi, i) =>
      this.engine.play({
        time: start + i * step,
        duration: 1.5,
        midi,
        velocity: 0.75,
        part: "banjo",
      }),
    );
  }

  /** Written order for step mode: the loop's measures, or every measure once. */
  private stepOrder(loaded: LoadedSong): number[] {
    const p = this.store.practice.peek();
    return p.loop
      ? loopOrder(loaded.index, { kind: "section", from: p.loop.from, to: p.loop.to })
      : loaded.index.measures.map((_, i) => i);
  }

  /** F28: turn step mode on (stops playback) or off. */
  setStepMode(on: boolean): void {
    const loaded = this.song();
    if (!on || !loaded) {
      this.step.value = null;
      this.follow.value = { ...this.follow.peek(), measure: null, slot: null, orderIndex: -1 };
      return;
    }
    this.stop();
    this.lastOrder = this.stepOrder(loaded);
    this.step.value = { orderIndex: 0, slot: -1 };
  }

  /** Moves the step cursor to the next (or previous) slot with a note and sounds it. */
  async stepBy(delta: 1 | -1): Promise<void> {
    const loaded = this.song();
    const at = this.step.peek();
    if (!loaded || !at) return;
    const order = this.stepOrder(loaded);
    const arranged = this.tab()?.measures ?? null;
    if (!arranged || order.length === 0) return;
    let { orderIndex, slot } = at;
    // Find the next slot where a note starts (holds and rests are skipped).
    for (let guard = 0; guard < 64 * 8; guard++) {
      slot += delta;
      const m = arranged[order[orderIndex]!];
      if (!m) return;
      if (slot >= m.slots) {
        if (orderIndex + 1 >= order.length) return; // past the last note: stay put
        orderIndex++;
        slot = 0;
      } else if (slot < 0) {
        if (orderIndex === 0) return;
        orderIndex--;
        slot = (arranged[order[orderIndex]!]?.slots ?? 1) - 1;
      }
      const here = arranged[order[orderIndex]!]!;
      if (here.notes.some((n) => n.slot === slot)) break;
    }
    this.step.value = { orderIndex, slot };
    const position = order[orderIndex]!;
    const measure = loaded.index.measures[position]?.index ?? null;
    this.follow.value = { ...this.follow.peek(), measure, slot, orderIndex };
    // Sound the banjo note(s) at this slot, at the practice key's capo.
    try {
      await this.deps.audio.unlock();
    } catch {
      return;
    }
    const plan = this.plan()!;
    const events = generateEvents(loaded.index, arranged, {
      transpose: this.store.practice.peek().keyShift,
      plan: plan.capo,
    })[position]!.events.filter((e) => e.part === "banjo" && e.slot === slot);
    await this.engine.prepare(events);
    const now = this.engine.now() + 0.02;
    for (const e of events) {
      this.engine.play({
        time: now,
        duration: 1.2,
        midi: e.midi,
        velocity: e.velocity,
        part: "banjo",
      });
    }
  }

  /**
   * F30: the next `count` picked fingers from the current position (playing or stepping),
   * following the playback order.
   */
  upcomingFingers(count = 8): { finger: string; key: string }[] {
    const loaded = this.song();
    const f = this.follow.peek();
    if (!loaded || f.slot === null || f.orderIndex < 0) return [];
    const arranged = this.tab()?.measures ?? null;
    if (!arranged) return [];
    const order = this.step.peek() ? this.stepOrder(loaded) : this.lastOrder;
    const out: { finger: string; key: string }[] = [];
    let oi = f.orderIndex;
    let slot = f.slot;
    for (let guard = 0; out.length < count && guard < 200; guard++) {
      const m = arranged[order[oi]!];
      if (!m) break;
      const picks = m.notes
        .filter((n) => n.slot === slot && n.finger !== null)
        .sort((a, b) => a.string - b.string);
      if (picks.length > 0) {
        out.push({ finger: picks.map((n) => n.finger).join("+"), key: `${oi}-${slot}` });
      }
      slot++;
      if (slot >= m.slots) {
        slot = 0;
        oi = oi + 1 < order.length ? oi + 1 : 0;
      }
    }
    return out;
  }

  /** rAF in the browser; the injected clock elsewhere (unit tests run in Node, deterministically). */
  private nextFrame(fn: () => void): number {
    return typeof requestAnimationFrame === "function"
      ? requestAnimationFrame(fn)
      : this.deps.clock.setTimeout(fn, 16);
  }

  private cancelFrame(id: number): void {
    if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(id);
    else this.deps.clock.clearTimeout(id);
  }

  private startFollowing(loaded: LoadedSong): void {
    this.cancelFrame(this.frame);
    const perBeat = slotsPerBeat(loaded.index);
    const tick = () => {
      const t = this.deps.audio.currentTime() - this.deps.audio.latency();
      const mark = this.scheduler.positionAt(t);
      const measure =
        mark && mark.position >= 0 ? (loaded.index.measures[mark.position]?.index ?? null) : null;
      const countIn =
        this.scheduler.state === "count-in" && mark && mark.orderIndex < 0
          ? Math.floor(mark.slot / perBeat) + 1
          : null;
      const prev = this.follow.peek();
      // A new beat (in the count-in, a gap or the song) bumps the counter (F31).
      const beatKey = mark
        ? `${mark.pass}:${mark.orderIndex}:${Math.floor(mark.slot / perBeat)}`
        : "";
      if (mark && mark.bpm > prev.bpm && mark.position >= 0) {
        this.store.logPractice({ kind: "tempo", tempo: mark.bpm });
      }
      if (beatKey !== this.lastBeatKey) {
        this.lastBeatKey = beatKey;
        if (mark) this.beatCount++;
      }
      const next: Follow = {
        measure,
        countIn,
        pass: mark?.pass ?? 0,
        bpm: mark?.bpm ?? prev.bpm,
        slot: mark && mark.position >= 0 ? mark.slot : null,
        beat: this.beatCount,
        yourTurn: mark?.yourTurn === true,
        orderIndex: mark?.orderIndex ?? -1,
      };
      if (
        prev.measure !== next.measure ||
        prev.countIn !== next.countIn ||
        prev.pass !== next.pass ||
        prev.bpm !== next.bpm ||
        prev.slot !== next.slot ||
        prev.beat !== next.beat ||
        prev.yourTurn !== next.yourTurn ||
        prev.orderIndex !== next.orderIndex
      ) {
        this.follow.value = next;
      }
      if (this.scheduler.state !== "stopped") this.frame = this.nextFrame(tick);
    };
    this.frame = this.nextFrame(tick);
  }

  private stopFollowing(): void {
    this.cancelFrame(this.frame);
    const prev = this.follow.peek();
    if (prev.measure !== null || prev.countIn !== null || prev.slot !== null || prev.yourTurn) {
      this.follow.value = { ...prev, measure: null, countIn: null, slot: null, yourTurn: false };
    }
  }
}

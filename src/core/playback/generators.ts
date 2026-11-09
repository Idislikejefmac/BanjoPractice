// A3 · Part generators (DEVELOPMENT.md §6 A3): pure functions from a song to note events per
// written measure. The scheduler (A1) turns slots into audio time, so tempo can change live.
//
// - Melody: the notation's notes (ties joined), transposed to the sounding key.
// - Chords: bluegrass boom-chuck: bass on beats 1 and 3 (root, then fifth), strum on 2 and 4.
// - Banjo: every tab note at its sounding pitch for the capo plan. Melody loudest, accents a
//   smaller boost, slurred notes softer.
// - Metronome: a click on every beat (accented downbeat), or on beats 2 and 4 only.

import type { CapoPlan, Tuning } from "../banjo/tuning.ts";
import { NO_CAPO, OPEN_G, pitchAt } from "../banjo/tuning.ts";
import type { ArrangedMeasure } from "../banjo/types.ts";
import type { Chord } from "../music/chords.ts";
import { parseChord } from "../music/chords.ts";
import { mod12, pitchClass } from "../music/notes.ts";
import type { IndexedMeasure, SongIndex } from "../song/abcIndex.ts";

export type Part = "melody" | "chords" | "banjo" | "metronome";
export const PARTS: readonly Part[] = ["melody", "chords", "banjo", "metronome"];

export interface NoteEvent {
  readonly part: Part;
  /** Start within the measure, in slots (may be fractional). */
  readonly slot: number;
  /** Length in slots. */
  readonly duration: number;
  /** MIDI pitch; metronome clicks use 1 (accent) and 0 (normal). */
  readonly midi: number;
  /** 0–1. */
  readonly velocity: number;
  /** Strum spread: play this many strum steps late (the scheduler sets the step, ~12 ms). */
  readonly strumStep?: number;
}

export interface MeasureEvents {
  /** Position in index.measures. */
  readonly position: number;
  readonly slots: number;
  readonly events: readonly NoteEvent[];
}

export interface GenerateOptions {
  /** Semitones from the written key to the sounding key (melody and chords). */
  readonly transpose: number;
  /** Capo plan for the banjo part (tab frets are capo-relative). */
  readonly plan?: CapoPlan;
  readonly tuning?: Tuning;
  readonly metronome?: "every-beat" | "two-and-four";
}

/** Slots per beat (the Q: beat). */
export function slotsPerBeat(index: SongIndex): number {
  return index.tempoBeat / index.rollUnit;
}

/** Seconds per slot at a tempo in beats per minute (beat = the Q: beat). */
export function slotSeconds(index: SongIndex, bpm: number): number {
  return 60 / bpm / slotsPerBeat(index);
}

function melodyEvents(m: IndexedMeasure, rollUnit: number, transpose: number): NoteEvent[] {
  const out: NoteEvent[] = [];
  for (let i = 0; i < m.melody.length; i++) {
    const n = m.melody[i]!;
    if (n.midi === null || n.tiedFromPrevious) continue;
    let duration = n.duration;
    // Join ties within the measure.
    for (let j = i + 1; j < m.melody.length && m.melody[j]!.tiedFromPrevious; j++) {
      duration += m.melody[j]!.duration;
    }
    out.push({
      part: "melody",
      slot: n.offset / rollUnit,
      duration: duration / rollUnit,
      midi: n.midi + transpose,
      velocity: 0.8,
    });
  }
  return out;
}

/** Bass note in E2–D♯3, and a strum voicing from E3 up. */
function bassFor(pc: number): number {
  return 40 + mod12(pc - 4);
}

function strumFor(chord: Chord, transpose: number): number[] {
  const root = pitchClass(chord.root) + transpose;
  const notes = chord.quality.intervals.map((iv) => 52 + mod12(root + iv - 52));
  return [...new Set(notes)].sort((a, b) => a - b);
}

function chordEvents(
  m: IndexedMeasure,
  current: Chord | null,
  index: SongIndex,
  transpose: number,
): { events: NoteEvent[]; last: Chord | null } {
  const perBeat = slotsPerBeat(index);
  const beats = Math.round(m.slots / perBeat);
  const out: NoteEvent[] = [];
  let chord = current;
  const changes = m.chords
    .map((c) => ({ atSlot: c.atSlot, chord: parseChord(c.chord) }))
    .filter((c): c is { atSlot: number; chord: Chord } => c.chord !== null);
  // Beat numbers count from the downbeat; a pickup's beats are the end of a bar.
  const fullBeats = Math.round(index.meter.num / index.meter.den / index.tempoBeat);
  const firstBeat = m.index === 0 ? fullBeats - beats : 0;
  const waltz = index.meter.num === 3;
  for (let b = 0; b < beats; b++) {
    const slot = b * perBeat;
    for (const c of changes) if (c.atSlot <= slot + 1e-9) chord = c.chord;
    if (!chord) continue;
    const beat = firstBeat + b; // 0-based beat in the bar
    const root = pitchClass(chord.root) + transpose;
    const isBass = waltz ? beat === 0 : beat % 2 === 0;
    if (isBass) {
      // Root on beat 1, the fifth on beat 3 (alternating bass).
      const pc = beat === 2 ? root + 7 : root;
      const bass = chord.bass ? pitchClass(chord.bass) + transpose : pc;
      out.push({ part: "chords", slot, duration: perBeat, midi: bassFor(bass), velocity: 0.75 });
    } else {
      strumFor(chord, transpose).forEach((midi, i) =>
        out.push({
          part: "chords",
          slot,
          duration: perBeat * 0.8,
          midi,
          velocity: 0.5,
          strumStep: i,
        }),
      );
    }
  }
  for (const c of changes) chord = c.chord;
  return { events: out, last: chord };
}

function banjoEvents(m: ArrangedMeasure, tuning: Tuning, plan: CapoPlan): NoteEvent[] {
  return m.notes.map((n) => {
    let velocity = n.technique === "pick" ? 0.55 : 0.4;
    if (n.isMelody) velocity = n.technique === "pick" ? 0.85 : 0.65;
    if (n.isAccent) velocity = Math.min(1, velocity + 0.08);
    return {
      part: "banjo" as const,
      slot: n.slot,
      duration: n.durationSlots,
      midi: pitchAt(tuning, n.string, n.fret, plan),
      velocity,
    };
  });
}

function metronomeEvents(
  m: IndexedMeasure,
  index: SongIndex,
  mode: "every-beat" | "two-and-four",
): NoteEvent[] {
  const perBeat = slotsPerBeat(index);
  const beats = Math.round(m.slots / perBeat);
  const fullBeats = Math.round(index.meter.num / index.meter.den / index.tempoBeat);
  const firstBeat = m.index === 0 ? fullBeats - beats : 0;
  const out: NoteEvent[] = [];
  for (let b = 0; b < beats; b++) {
    const beat = firstBeat + b;
    if (mode === "two-and-four" && beat % 2 === 0) continue;
    out.push({
      part: "metronome",
      slot: b * perBeat,
      duration: 0.5,
      midi: beat === 0 ? 1 : 0,
      velocity: beat === 0 ? 1 : 0.7,
    });
  }
  return out;
}

/** Note events for every written measure (by position), for all parts. */
export function generateEvents(
  index: SongIndex,
  arrangement: readonly ArrangedMeasure[] | null,
  opts: GenerateOptions,
): MeasureEvents[] {
  const tuning = opts.tuning ?? OPEN_G;
  const plan = opts.plan ?? NO_CAPO;
  let chord: Chord | null = null;
  return index.measures.map((m, position) => {
    const { events: chordEv, last } = chordEvents(m, chord, index, opts.transpose);
    chord = last;
    const tab = arrangement?.[position];
    const events = [
      ...melodyEvents(m, index.rollUnit, opts.transpose),
      ...chordEv,
      ...(tab && tab.index === m.index ? banjoEvents(tab, tuning, plan) : []),
      ...metronomeEvents(m, index, opts.metronome ?? "every-beat"),
    ].sort((a, b) => a.slot - b.slot);
    return { position, slots: m.slots, events };
  });
}

/** Count-in clicks: `beats` clicks, the first accented. */
export function countInEvents(index: SongIndex, beats: number): MeasureEvents {
  const perBeat = slotsPerBeat(index);
  const events: NoteEvent[] = Array.from({ length: beats }, (_, b) => ({
    part: "metronome" as const,
    slot: b * perBeat,
    duration: 0.5,
    midi: b % 4 === 0 ? 1 : 0,
    velocity: b % 4 === 0 ? 1 : 0.7,
  }));
  return { position: -1, slots: beats * perBeat, events };
}

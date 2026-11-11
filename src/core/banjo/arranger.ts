// C6 · Arranger (DEVELOPMENT.md §3 C6, style guide §7): melody + chords → a Scruggs-style
// arrangement that passes C4's hard rules, or an explicit "can't place" per measure.
//
//   1. Simplify the melody to slots: keep attacks on strong slots and long notes.
//   2. Candidates per measure: every roll template, every pair of half-rolls, and thumb–pinch
//      fills. For each, a small search over the 8 slots picks strings and frets: melody notes
//      where the template's finger can reach them (or by hammer-on, pull-off or slide),
//      chord tones and the open 5th string elsewhere.
//   3. Every candidate is checked with C4 and scored on the soft preferences (guide §4.2).
//   4. An exact search (Viterbi) across measures picks the best legal sequence, with the
//      joins between measures checked too.
//   5. A measure with no legal candidate gets a plain roll on its chord and a "can't place"
//      note, so the result is always legal and the gap is visible (never silent).

import type { Chord } from "../music/chords.ts";
import { chordPitchClasses, parseChord } from "../music/chords.ts";
import { scalePitchClasses } from "../music/keys.ts";
import { mod12 } from "../music/notes.ts";
import type { IndexedMeasure, SongIndex } from "../song/abcIndex.ts";
import { ROLLS } from "./rolls.ts";
import type { CapoPlan, Tuning } from "./tuning.ts";
import { NO_CAPO, OPEN_G, pitchAt } from "./tuning.ts";
import { validate } from "./validator.ts";
import type {
  ArrangedMeasure,
  Arrangement,
  Finger,
  MeasureChord,
  StringNo,
  TabNote,
  Technique,
} from "./types.ts";
import { ARRANGEMENT_SCHEMA_VERSION } from "./types.ts";

/** Written melody sounds 12 semitones lower on the banjo (C9). */
const NOTATION_OCTAVE = 12;
const MAX_FIRST_POSITION_FRET = 5;
/** Fretted notes under one chord fit in four adjacent frets (C4 H5). */
const MAX_REACH = 3;

/** Finger → strings it may pick (guide §3 usual + occasionally; C4 H4). */
export const STRINGS_FOR: Readonly<Record<Finger, readonly StringNo[]>> = {
  T: [5, 4, 3, 2],
  I: [2, 3, 4],
  M: [1, 2],
};
const RANK: Readonly<Record<Finger, number>> = { T: 3, I: 2, M: 1 };
/** Each finger's home string, used to break ties for filler notes. */
const HOME: Readonly<Record<Finger, readonly StringNo[]>> = {
  T: [5, 3, 4, 2],
  I: [2, 3, 4],
  M: [1, 2],
};

export interface ArrangeWeights {
  missingMelody: number;
  melodyOffAccent: number;
  melodyOnString4: number;
  highFret: number;
  nonChordFiller: number;
  /** The open 5th string where it clashes with the key or the chord (see droneClashes). */
  clashingDrone: number;
  namedRoll: number;
  halfRolls: number;
  sameRollAsBefore: number;
  handMove: number;
  /** Each hammer-on/pull-off/slide costs a little: rolls should carry the tune. */
  slurCost: number;
  /** Per slur beyond two in a measure. */
  extraSlurs: number;
  /** A missed melody note on a weak (odd) slot costs this fraction of missingMelody. */
  weakSlotMelody: number;
  pinchFill: number;
}

/** Soft-preference weights (guide §4.2). Tuned against the hand-written built-ins. */
export const DEFAULT_WEIGHTS: ArrangeWeights = {
  missingMelody: 10,
  melodyOffAccent: 0.5,
  melodyOnString4: 0.8,
  highFret: 0.6,
  nonChordFiller: 2.5,
  clashingDrone: 6,
  namedRoll: -2,
  halfRolls: -1,
  sameRollAsBefore: -0.4,
  handMove: 0.25,
  slurCost: 0.6,
  extraSlurs: 2,
  weakSlotMelody: 0.15,
  pinchFill: 1.5,
};

export interface ArrangeOptions {
  readonly tuning?: Tuning;
  readonly plan?: CapoPlan;
  readonly weights?: Partial<ArrangeWeights>;
  /** F14/F17 overrides: written measure number → roll id (or "a+b" halves) to use. */
  readonly overrides?: ReadonlyMap<number, string>;
  /**
   * Roll ids to use (the rest are left out). A half-and-half measure needs both halves
   * allowed; the short fill endings stay available. Empty or missing = every roll.
   */
  readonly rolls?: readonly string[];
  /** Candidates kept per measure for the cross-measure search. */
  readonly beam?: number;
}

export interface ArrangeProblem {
  readonly measure: number;
  readonly message: string;
}

export interface ArrangeResult {
  readonly arrangement: Arrangement;
  /** Measures that couldn't be placed (they hold a plain roll on the chord instead). */
  readonly problems: readonly ArrangeProblem[];
  /** Melody notes left out, per written measure: why the arrangement is simpler (F14). */
  readonly dropped: ReadonlyMap<number, number>;
}

// --- Templates ---------------------------------------------------------------------------

/** A finger template: one token per slot. "TM" is a pinch; "-" holds the previous note. */
interface Template {
  readonly name: string;
  readonly tokens: readonly string[];
  readonly kind: "roll" | "halves" | "fill";
}

function allTemplates(): Template[] {
  const out: Template[] = [];
  for (const r of ROLLS) out.push({ name: r.id, tokens: r.fingers, kind: "roll" });
  for (const a of ROLLS) {
    for (const b of ROLLS) {
      if (a.id === b.id) continue;
      out.push({
        name: `${a.id}+${b.id}`,
        tokens: [...a.fingers.slice(0, 4), ...b.fingers.slice(4)],
        kind: "halves",
      });
    }
  }
  // Thumb–pinch fills for held notes and phrase ends (guide §5).
  out.push({
    name: "lick:thumb-pinch",
    tokens: ["T", "I", "TM", "-", "T", "I", "TM", "-"],
    kind: "fill",
  });
  out.push({
    name: "lick:pinch-fill",
    tokens: ["T", "I", "T", "I", "TM", "-", "-", "T"],
    kind: "fill",
  });
  out.push({ name: "tag", tokens: ["T", "I", "TM", "-", "T", "-", "TM", "-"], kind: "fill" });
  return out;
}

const TEMPLATES = allTemplates();

/** The templates for an allowed-rolls list (see ArrangeOptions.rolls). */
function allowedTemplates(rolls: readonly string[] | undefined): readonly Template[] {
  if (!rolls || rolls.length === 0) return TEMPLATES;
  const ok = new Set(rolls);
  const chosen = TEMPLATES.filter((t) =>
    t.kind === "fill" ? true : t.name.split("+").every((id) => ok.has(id)),
  );
  // A list of ids we don't know would leave only fills: use every roll instead.
  return chosen.some((t) => t.kind !== "fill") ? chosen : TEMPLATES;
}

// --- Melody simplification -----------------------------------------------------------------

interface Target {
  readonly slot: number;
  /** Sounding MIDI pitch to place. */
  readonly midi: number;
  /** Strong slot or long note: missing it costs the full weight. */
  readonly strong: boolean;
}

/** Melody notes to place in a measure: attacks on even slots, and longer notes on odd ones. */
export function melodyTargets(
  m: IndexedMeasure,
  rollUnit: number,
): { targets: Target[]; dropped: number } {
  const targets: Target[] = [];
  let dropped = 0;
  const bySlot = new Map<number, Target>();
  for (const n of m.melody) {
    if (n.midi === null || n.tiedFromPrevious) continue;
    // Notes that start between slots (triplets, grace-like quick notes) are dropped.
    const onSlot = Math.abs(n.offset / rollUnit - Math.round(n.offset / rollUnit)) < 1e-6;
    const slot = Math.round(n.offset / rollUnit);
    if (!onSlot) {
      dropped++;
      continue;
    }
    if (bySlot.has(slot)) {
      dropped++;
      continue;
    }
    const t = {
      slot,
      midi: n.midi - NOTATION_OCTAVE,
      strong: slot % 2 === 0 || n.duration / rollUnit >= 2 - 1e-6,
    };
    bySlot.set(slot, t);
    targets.push(t);
  }
  return { targets, dropped };
}

// --- Per-measure search ---------------------------------------------------------------------

interface Option {
  readonly notes: readonly TabNote[];
  readonly cost: number;
  readonly usedSlur: boolean;
}

function chordAt(
  chords: readonly { atSlot: number; chord: Chord }[],
  slot: number,
  fallback: Chord | null,
): Chord | null {
  let c = fallback;
  for (const x of chords) if (x.atSlot <= slot) c = x.chord;
  return c;
}

/** Lowest first-position fret on a string giving one of the pitch classes (or null). */
function fretFor(
  tuning: Tuning,
  plan: CapoPlan,
  string: StringNo,
  pcs: ReadonlySet<number>,
): number | null {
  if (string === 5) return pcs.has(mod12(pitchAt(tuning, 5, 0, plan))) ? 0 : null;
  for (let fret = 0; fret <= 4; fret++) {
    if (pcs.has(mod12(pitchAt(tuning, string, fret, plan)))) return fret;
  }
  return null;
}

/**
 * Whether the open 5th string sounds wrong over a chord it isn't part of. The drone is welcome
 * over almost any chord of its key (guide §4.2: g over C and D in G is part of the sound), but
 * not when it is outside the key (open g in B major, against the key's G♯), nor when the chord
 * has an out-of-key note a semitone from it (g against the G♯ of an E7 in the key of G).
 */
export function droneClashes(
  drone: number,
  chord: ReadonlySet<number>,
  scale: ReadonlySet<number>,
): boolean {
  const pc = mod12(drone);
  if (chord.has(pc)) return false;
  if (!scale.has(pc)) return true;
  for (const c of chord) {
    if (!scale.has(c) && (mod12(c - pc) === 1 || mod12(pc - c) === 1)) return true;
  }
  return false;
}

/** Where a pitch sits in first position on a string, if anywhere. */
function fretForPitch(
  tuning: Tuning,
  plan: CapoPlan,
  string: StringNo,
  midi: number,
): number | null {
  if (string === 5) return pitchAt(tuning, 5, 0, plan) === midi ? 0 : null;
  const fret = midi - pitchAt(tuning, string, 0, plan);
  return fret >= 0 && fret <= MAX_FIRST_POSITION_FRET ? fret : null;
}

type Pick = { readonly finger: Finger; readonly string: StringNo };

/** Fingers don't cross between consecutive picks (H3), and no repeated finger/string (H1, H2). */
function pickOk(prev: Pick | null, f: Finger, s: StringNo): boolean {
  if (!prev) return true;
  if (prev.finger === f || prev.string === s) return false;
  // The higher-ranked finger (T > I > M) stays on the higher-numbered string.
  return RANK[prev.finger] > RANK[f] ? prev.string >= s : s >= prev.string;
}

/** The notes placed so far, newest first. Shared between states, so adding one copies nothing. */
interface NoteCell {
  readonly note: TabNote;
  readonly prev: NoteCell | null;
}

interface SlotState {
  cost: number;
  notes: NoteCell | null;
  /** Slurred notes so far. */
  slurs: number;
  /** The last single pick. */
  pick: Pick | null;
  /** Last sounding single note (for slurs). */
  last: { string: StringNo; fret: number } | null;
  /** The last pick was a pinch: the hand resets, so the next single note is unrestricted. */
  reset: boolean;
  /** Lowest and highest fretted note under the current chord (H5), or null if none yet. */
  span: Span | null;
}

type Span = readonly [lo: number, hi: number];

/**
 * The left hand's span after adding a note, or undefined if it would stretch past four frets
 * (H5). Checked inside the search so that a melody note out of reach is left out, rather than
 * every candidate for the measure failing C4 afterwards.
 */
function widen(span: Span | null, string: StringNo, fret: number): Span | null | undefined {
  if (fret === 0 || string === 5) return span;
  if (!span) return [fret, fret];
  if (fret >= span[0] && fret <= span[1]) return span;
  const lo = Math.min(span[0], fret);
  const hi = Math.max(span[1], fret);
  return hi - lo > MAX_REACH ? undefined : [lo, hi];
}

const STRINGS: readonly StringNo[] = [1, 2, 3, 4, 5];

/**
 * What a slot of a measure offers, whatever the roll: worked out once per measure and shared
 * by all its templates (about 70 of them), which only differ in the fingers.
 */
interface SlotInfo {
  readonly target: Target | undefined;
  /** Cost of not playing the target here (0 without one). */
  readonly miss: number;
  /** A chord starts here: a new left-hand shape, so the reach is counted afresh (C4 H5). */
  readonly newChord: boolean;
  /** The open 5th string clashes with the chord or the key here. */
  readonly droneClash: boolean;
  /** By string number: the first-position fret of a chord tone, or null. */
  readonly filler: readonly (number | null)[];
  /** By string number: the first-position fret of the target, or null. */
  readonly melody: readonly (number | null)[];
}

function slotInfos(
  m: IndexedMeasure,
  targets: readonly Target[],
  chords: readonly { atSlot: number; chord: Chord }[],
  startChord: Chord | null,
  tuning: Tuning,
  plan: CapoPlan,
  w: ArrangeWeights,
  scale: ReadonlySet<number>,
): SlotInfo[] {
  const targetAt = new Map(targets.map((t) => [t.slot, t]));
  const chordStarts = new Set(m.chords.map((c) => c.atSlot));
  const drone = pitchAt(tuning, 5, 0, plan);
  const none: (number | null)[] = [null, null, null, null, null, null];
  const out: SlotInfo[] = [];
  let lastChord: Chord | null | undefined;
  let lastFiller: (number | null)[] = none;
  let lastClash = false;
  for (let slot = 0; slot < m.slots; slot++) {
    const chord = chordAt(chords, slot, startChord);
    if (chord !== lastChord) {
      const pcs = chord ? chordPitchClasses(chord) : new Set<number>();
      lastFiller = [null, ...STRINGS.map((s) => fretFor(tuning, plan, s, pcs))];
      lastClash = droneClashes(drone, pcs, scale);
      lastChord = chord;
    }
    const target = targetAt.get(slot);
    out.push({
      target,
      miss: target ? w.missingMelody * (target.strong ? 1 : w.weakSlotMelody) : 0,
      newChord: chordStarts.has(slot),
      droneClash: lastClash,
      filler: lastFiller,
      melody: target
        ? [null, ...STRINGS.map((s) => fretForPitch(tuning, plan, s, target.midi))]
        : none,
    });
  }
  return out;
}

/** States kept per slot. */
const SLOT_BEAM = 24;

function measureOptions(
  tpl: Template,
  m: IndexedMeasure,
  info: readonly SlotInfo[],
  w: ArrangeWeights,
): Option[] {
  const slots = m.slots;
  const tokens =
    slots === tpl.tokens.length ? tpl.tokens : tpl.tokens.slice(tpl.tokens.length - slots);
  if (tokens.length !== slots) return [];
  const forward = tpl.name.startsWith("forward");
  const pinchCost = w.pinchFill * (tpl.kind === "fill" ? 0.3 : 1);

  // Beam over partial states, keyed by the last pick, the last note and the hand's span. Only
  // the cheapest state per key is ever built: most of the search's time went on building the
  // ones that were thrown away.
  let states: SlotState[] = [
    { cost: 0, notes: null, slurs: 0, pick: null, last: null, reset: false, span: null },
  ];
  for (let slot = 0; slot < slots; slot++) {
    const tok = tokens[slot]!;
    const { target, miss, droneClash, filler, melody } = info[slot]!;
    const onAccent = forward ? slot === 0 || slot === 3 || slot === 6 : slot % 2 === 0;
    const best = new Map<number, SlotState>();
    /** True if a state with this key and cost would be kept (so it is worth building). */
    const wanted = (key: number, cost: number): boolean => {
      const cur = best.get(key);
      return !cur || cost < cur.cost;
    };
    for (const st of states) {
      const span0 = info[slot]!.newChord ? null : st.span;
      const prevPick = st.reset ? null : st.pick;

      if (tok === "-") {
        // Hold: extend the previous note(s); a melody attack here can't be placed.
        if (!st.notes) continue;
        const cost = st.cost + miss;
        const key = stateKey(st.reset, st.pick, st.last, span0);
        if (!wanted(key, cost)) continue;
        const lastSlot = st.notes.note.slot;
        const held: TabNote[] = [];
        let rest: NoteCell | null = st.notes;
        while (rest && rest.note.slot === lastSlot) {
          held.push({ ...rest.note, durationSlots: rest.note.durationSlots + 1 });
          rest = rest.prev;
        }
        let notes = rest;
        for (let i = held.length - 1; i >= 0; i--) notes = { note: held[i]!, prev: notes };
        best.set(key, { ...st, notes, cost, span: span0 });
        continue;
      }

      if (tok.length > 1) {
        // Pinch (e.g. "TM"): thumb on 5/4/3, middle on 1; melody on the middle's string if it fits.
        const fingers = [...tok] as Finger[];
        // H9: no pinch containing the previous single note's finger, except T on a strong slot.
        if (
          st.pick &&
          !st.reset &&
          fingers.includes(st.pick.finger) &&
          !(st.pick.finger === "T" && slot % 2 === 0)
        )
          continue;
        const notes: TabNote[] = [];
        let melodyPlaced = false;
        for (const f of fingers) {
          // The thumb takes the 4th string where the open 5th would clash with the chord or key.
          let s: StringNo = f === "M" ? 1 : f === "I" ? 2 : droneClash ? 4 : 5;
          let fret: number | null = null;
          if (target && !melodyPlaced) {
            for (const cand of STRINGS_FOR[f]) {
              const fr = melody[cand] ?? null;
              if (fr !== null) {
                s = cand;
                fret = fr;
                melodyPlaced = true;
                break;
              }
            }
          }
          if (fret === null) fret = filler[s] ?? 0;
          notes.push({
            slot,
            durationSlots: 1,
            string: s,
            fret,
            finger: f,
            technique: "pick",
            isMelody: melodyPlaced && fret === melody[s],
            isAccent: false,
            pinchGroup: slot,
          });
        }
        // Pinch strings must be ordered T > I > M and distinct.
        const ordered = notes.slice().sort((a, b) => RANK[b.finger!] - RANK[a.finger!]);
        if (ordered.some((n, i) => i > 0 && n.string >= ordered[i - 1]!.string)) continue;
        let span: Span | null | undefined = span0;
        for (const n of notes) if (span !== undefined) span = widen(span, n.string, n.fret);
        if (span === undefined) continue;
        const cost = st.cost + pinchCost + (target && !melodyPlaced ? miss : 0);
        // A pinch resets the hand: the next single note isn't restricted by H1 (C4 H9).
        const key = stateKey(true, st.pick, null, span);
        if (!wanted(key, cost)) continue;
        let cells = st.notes;
        for (const note of notes) cells = { note, prev: cells };
        best.set(key, { ...st, cost, notes: cells, last: null, span, reset: true });
        continue;
      }

      const f = tok as Finger;
      // Melody by slur from the previous note (hammer up, pull down, slide up a fret or two).
      if (target && st.last && slot > 0 && st.last.string !== 5) {
        const fr = melody[st.last.string] ?? null;
        const span = fr === null ? undefined : widen(span0, st.last.string, fr);
        if (fr !== null && fr !== st.last.fret && span !== undefined) {
          const cost = st.cost + w.slurCost + (st.slurs >= 2 ? w.extraSlurs : 0);
          const last = { string: st.last.string, fret: fr };
          const key = stateKey(st.reset, st.pick, last, span);
          if (wanted(key, cost)) {
            const technique: Technique =
              fr > st.last.fret
                ? fr - st.last.fret <= 2 && st.last.fret > 0
                  ? "slide-up"
                  : "hammer"
                : "pull";
            const note: TabNote = {
              slot,
              durationSlots: 1,
              string: st.last.string,
              fret: fr,
              finger: null,
              technique,
              isMelody: true,
              isAccent: false,
            };
            best.set(key, {
              ...st,
              cost,
              notes: { note, prev: st.notes },
              slurs: st.slurs + 1,
              last,
              span,
            });
          }
        }
      }
      // Picked notes: melody if the finger can reach it, otherwise a filler chord tone.
      const pickNote = (s: StringNo, fret: number, isMelody: boolean, noteCost: number) => {
        const span = widen(span0, s, fret);
        if (span === undefined) return;
        const handMove =
          st.last && fret > 0 && st.last.fret > 0 ? Math.abs(fret - st.last.fret) * w.handMove : 0;
        const cost = st.cost + noteCost + handMove;
        const pick = { finger: f, string: s };
        const last = { string: s, fret };
        const key = stateKey(false, pick, last, span);
        if (!wanted(key, cost)) return;
        const note: TabNote = {
          slot,
          durationSlots: 1,
          string: s,
          fret,
          finger: f,
          technique: "pick",
          isMelody,
          isAccent: false,
        };
        best.set(key, {
          cost,
          notes: { note, prev: st.notes },
          slurs: st.slurs,
          pick,
          last,
          span,
          reset: false,
        });
      };
      const home = HOME[f];
      for (const s of STRINGS_FOR[f]) {
        if (!pickOk(prevPick, f, s)) continue;
        const fr = melody[s] ?? null;
        if (fr !== null) {
          let c = 0;
          if (s === 4) c += w.melodyOnString4;
          if (fr > 4) c += w.highFret * (fr - 4);
          if (!onAccent) c += w.melodyOffAccent;
          pickNote(s, fr, true, c);
        }
        const chordTone = filler[s] ?? null;
        if (chordTone !== null) {
          pickNote(s, chordTone, false, miss + home.indexOf(s) * 0.15);
        } else if (s === 5 || !target) {
          // An open string that isn't a chord tone: allowed, but costs.
          const open = s !== 5 ? w.nonChordFiller : droneClash ? w.clashingDrone : 0.2;
          pickNote(s, 0, false, miss + open);
        }
      }
    }
    // Keep the best few states.
    states = [...best.values()].sort((x, y) => x.cost - y.cost).slice(0, SLOT_BEAM);
    if (states.length === 0) return [];
  }
  return states.map((st) => {
    const notes: TabNote[] = [];
    for (let c = st.notes; c; c = c.prev) notes.push(c.note);
    notes.reverse();
    const usedSlur = st.slurs > 0;
    return {
      notes,
      cost:
        st.cost +
        (tpl.kind === "roll" && !usedSlur ? w.namedRoll : tpl.kind === "halves" ? w.halfRolls : 0),
      usedSlur,
    };
  });
}

const FINGER_CODE: Readonly<Record<Finger, number>> = { T: 1, I: 2, M: 3 };

/**
 * One number for what the rest of the measure can depend on: the last pick (or that the hand
 * was reset by a pinch), the last sounding note, and the left hand's span. Frets here are
 * first-position ones (0–5), so three bits each are enough.
 */
function stateKey(
  reset: boolean,
  pick: Pick | null,
  last: { string: StringNo; fret: number } | null,
  span: Span | null,
): number {
  const hand = reset ? 31 : pick ? FINGER_CODE[pick.finger] * 6 + pick.string : 0;
  const note = last ? last.string * 8 + last.fret + 1 : 0;
  const reach = span ? span[0] * 8 + span[1] + 1 : 0;
  return (hand * 64 + note) * 64 + reach;
}

function measureChords(m: IndexedMeasure): {
  parsed: { atSlot: number; chord: Chord }[];
  raw: MeasureChord[];
} {
  const parsed: { atSlot: number; chord: Chord }[] = [];
  for (const c of m.chords) {
    const chord = parseChord(c.chord);
    if (chord) parsed.push({ atSlot: c.atSlot, chord });
  }
  return { parsed, raw: m.chords.map((c) => ({ atSlot: c.atSlot, chord: c.chord })) };
}

function rollNameFor(tpl: Template, usedSlur: boolean): string {
  if (tpl.kind === "fill") return tpl.name;
  if (!usedSlur) return tpl.name;
  return tpl.kind === "roll" ? `${tpl.name}+slur` : `${tpl.name}`;
}

/** A plain forward roll on the chord, used when a measure can't be placed. */
function fallbackMeasure(
  m: IndexedMeasure,
  raw: MeasureChord[],
  parsed: { atSlot: number; chord: Chord }[],
  startChord: Chord | null,
  tuning: Tuning,
  plan: CapoPlan,
  scale: ReadonlySet<number>,
): ArrangedMeasure {
  const roll = ROLLS[0]!;
  const fingers = roll.fingers.slice(roll.fingers.length - m.slots);
  const strings = roll.exampleStrings.slice(roll.exampleStrings.length - m.slots);
  const notes: TabNote[] = fingers.map((f, i) => {
    const chord = chordAt(parsed, i, startChord);
    const pcs = chord ? chordPitchClasses(chord) : new Set<number>();
    // The thumb moves to the 4th string where the open 5th would clash.
    const drone = pitchAt(tuning, 5, 0, plan);
    const s = strings[i] === 5 && droneClashes(drone, pcs, scale) ? 4 : strings[i]!;
    return {
      slot: i,
      durationSlots: 1,
      string: s,
      fret: fretFor(tuning, plan, s, pcs) ?? 0,
      finger: f,
      technique: "pick",
      isMelody: false,
      isAccent: false,
    };
  });
  return {
    index: m.index,
    slots: m.slots,
    chords: raw,
    rollName: "forward",
    source: "generated",
    notes,
  };
}

// --- Whole song ------------------------------------------------------------------------------

interface Candidate {
  readonly measure: ArrangedMeasure;
  readonly cost: number;
}

export function arrange(index: SongIndex, opts: ArrangeOptions = {}): ArrangeResult {
  const tuning = opts.tuning ?? OPEN_G;
  const plan = opts.plan ?? NO_CAPO;
  const w = { ...DEFAULT_WEIGHTS, ...opts.weights };
  const beam = opts.beam ?? 16;
  const allowed = allowedTemplates(opts.rolls);
  const scale = scalePitchClasses(index.key);
  const problems: ArrangeProblem[] = [];
  const dropped = new Map<number, number>();

  // 1–3: candidates per measure.
  let carried: Chord | null = null;
  const perMeasure: Candidate[][] = index.measures.map((m, pos) => {
    const { parsed, raw } = measureChords(m);
    const startChord = carried;
    for (const c of parsed) carried = c.chord;
    const { targets, dropped: d } = melodyTargets(m, index.rollUnit);
    if (d > 0) dropped.set(m.index, d);
    const isLast = pos === index.measures.length - 1;
    const override = opts.overrides?.get(m.index);
    const templates = override
      ? TEMPLATES.filter((t) => t.name === override)
      : allowed.filter((t) => t.name !== "tag" || isLast);
    const info = slotInfos(m, targets, parsed, startChord, tuning, plan, w, scale);
    const found: { tpl: Template; o: Option; cost: number }[] = [];
    for (const tpl of templates) {
      for (const o of measureOptions(tpl, m, info, w)) {
        found.push({ tpl, o, cost: o.cost + (isLast && tpl.name === "tag" ? -1 : 0) });
      }
    }
    // Cheapest first, and only as many are built and checked with C4 as the search keeps: a
    // measure has over a thousand options, and checking them all took most of the time.
    found.sort((a, b) => a.cost - b.cost);
    const unique: Candidate[] = [];
    const seen = new Set<string>();
    for (const { tpl, o, cost } of found) {
      const notes = o.notes.slice().sort((a, b) => a.slot - b.slot || b.string - a.string);
      const key = notes.map((n) => `${n.slot}${n.string}${n.fret}${n.finger}${n.technique}`).join();
      if (seen.has(key)) continue;
      const measure: ArrangedMeasure = {
        index: m.index,
        slots: m.slots,
        chords: raw,
        rollName: rollNameFor(tpl, o.usedSlur),
        source: override ? "override" : "generated",
        ...(isLast && tpl.kind === "fill" ? { phraseEnd: true } : {}),
        notes,
      };
      if (validate([measure], { tuning, plan }).some((v) => v.severity === "error")) continue;
      seen.add(key);
      unique.push({ measure, cost });
      if (unique.length >= beam) break;
    }
    if (unique.length === 0) {
      problems.push({
        measure: m.index,
        message: override
          ? `The ${override} roll can't be played here with this melody`
          : "Couldn't fit the melody into a roll here, so this measure is a plain roll on the chord",
      });
      unique.push({
        measure: fallbackMeasure(m, raw, parsed, startChord, tuning, plan, scale),
        cost: 100,
      });
    }
    // Backups that ignore the melody, one per starting finger, so some candidate can always
    // join the measure before legally (otherwise the search could be left with only illegal
    // joins). They cost a lot, so they're only used when nothing else fits.
    const firstFingers = new Set<string>();
    const noMelody = slotInfos(m, [], parsed, startChord, tuning, plan, w, scale);
    // The allowed rolls come first; the others only fill in so a legal join always exists.
    for (const tpl of [...allowed, ...TEMPLATES.filter((t) => !allowed.includes(t))]) {
      if (tpl.kind === "fill" || firstFingers.size >= 3) continue;
      const first = tpl.tokens[tpl.tokens.length - m.slots] ?? "";
      if (firstFingers.has(first)) continue;
      const opt = measureOptions(tpl, m, noMelody, w)[0];
      if (!opt) continue;
      const measure: ArrangedMeasure = {
        index: m.index,
        slots: m.slots,
        chords: raw,
        rollName: rollNameFor(tpl, opt.usedSlur),
        source: "generated",
        notes: opt.notes.slice().sort((a, b) => a.slot - b.slot || b.string - a.string),
      };
      if (validate([measure], { tuning, plan }).some((v) => v.severity === "error")) continue;
      firstFingers.add(first);
      unique.push({ measure, cost: 60 + targets.length * w.missingMelody });
    }
    return unique;
  });

  // 4: Viterbi over measures, joins checked with C4.
  type Cell = { cost: number; back: number };
  const table: Cell[][] = [];
  perMeasure.forEach((cands, i) => {
    table.push(
      cands.map((c) => {
        if (i === 0) return { cost: c.cost, back: -1 };
        let best: Cell = { cost: Infinity, back: -1 };
        perMeasure[i - 1]!.forEach((p, j) => {
          const prevCost = table[i - 1]![j]!.cost;
          if (!Number.isFinite(prevCost)) return;
          const legal = !validate([p.measure, c.measure], { tuning, plan }).some(
            (v) => v.severity === "error",
          );
          if (!legal) return;
          const continuity = p.measure.rollName === c.measure.rollName ? w.sameRollAsBefore : 0;
          const total = prevCost + c.cost + continuity;
          if (total < best.cost) best = { cost: total, back: j };
        });
        return best;
      }),
    );
  });

  // Walk back from the best end. If every path is blocked by a join, fall back measure by
  // measure: keep the best candidate that joins legally with the previous choice.
  const chosen: ArrangedMeasure[] = [];
  const last = table[table.length - 1] ?? [];
  let at = last.reduce((b, c, j) => (c.cost < (last[b]?.cost ?? Infinity) ? j : b), 0);
  if (last.length > 0 && Number.isFinite(last[at]!.cost)) {
    for (let i = table.length - 1; i >= 0; i--) {
      chosen.unshift(perMeasure[i]![at]!.measure);
      at = table[i]![at]!.back;
    }
  } else {
    perMeasure.forEach((cands, i) => {
      const prev = chosen[i - 1];
      const pick =
        cands.find(
          (c) =>
            !prev ||
            !validate([prev, c.measure], { tuning, plan }).some((v) => v.severity === "error"),
        ) ?? null;
      if (pick) chosen.push(pick.measure);
      else {
        problems.push({
          measure: index.measures[i]!.index,
          message: "No roll here joins legally with the measure before",
        });
        chosen.push(cands[0]!.measure);
      }
    });
  }

  return {
    arrangement: {
      schemaVersion: ARRANGEMENT_SCHEMA_VERSION,
      shapeKey: index.key,
      measures: chosen,
    },
    problems,
    dropped,
  };
}

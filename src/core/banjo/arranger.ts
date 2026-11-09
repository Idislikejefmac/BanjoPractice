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

/** Finger → strings it may pick (guide §3 usual + occasionally; C4 H4). */
const STRINGS_FOR: Readonly<Record<Finger, readonly StringNo[]>> = {
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
  /** The picked fingers/strings in order (for rule checks inside the search). */
  readonly picks: readonly { finger: Finger; string: StringNo }[];
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

/** Fingers don't cross between consecutive picks (H3), and no repeated finger/string (H1, H2). */
function pickOk(
  prev: { finger: Finger; string: StringNo } | null,
  f: Finger,
  s: StringNo,
): boolean {
  if (!prev) return true;
  if (prev.finger === f || prev.string === s) return false;
  const hi = RANK[prev.finger] > RANK[f] ? prev : { finger: f, string: s };
  const lo = hi === prev ? { finger: f, string: s } : prev;
  return hi.string >= lo.string;
}

interface SlotState {
  cost: number;
  notes: TabNote[];
  picks: { finger: Finger; string: StringNo }[];
  /** Last sounding single note (for slurs). */
  last: { string: StringNo; fret: number } | null;
  usedSlur: boolean;
  /** The last pick was a pinch: the hand resets, so the next single note is unrestricted. */
  reset: boolean;
}

function measureOptions(
  tpl: Template,
  m: IndexedMeasure,
  targets: readonly Target[],
  chords: readonly { atSlot: number; chord: Chord }[],
  startChord: Chord | null,
  tuning: Tuning,
  plan: CapoPlan,
  w: ArrangeWeights,
): Option[] {
  const slots = m.slots;
  const tokens =
    slots === tpl.tokens.length ? tpl.tokens : tpl.tokens.slice(tpl.tokens.length - slots);
  if (tokens.length !== slots) return [];
  const targetAt = new Map(targets.map((t) => [t.slot, t]));
  const miss = (t: Target) => w.missingMelody * (t.strong ? 1 : w.weakSlotMelody);
  const accentSlots = tpl.name.startsWith("forward") ? new Set([0, 3, 6]) : new Set([0, 2, 4, 6]);

  // Beam over partial states, keyed by the last pick and last note.
  let states: SlotState[] = [
    { cost: 0, notes: [], picks: [], last: null, usedSlur: false, reset: false },
  ];
  for (let slot = 0; slot < slots; slot++) {
    const tok = tokens[slot]!;
    const chord = chordAt(chords, slot, startChord);
    const pcs = chord ? chordPitchClasses(chord) : new Set<number>();
    const target = targetAt.get(slot);
    const next: SlotState[] = [];
    for (const st of states) {
      const prevPick = st.reset ? null : (st.picks[st.picks.length - 1] ?? null);
      const prevSingle = st.picks[st.picks.length - 1] ?? null;

      if (tok === "-") {
        // Hold: extend the previous note(s); a melody attack here can't be placed.
        const lastNotes = st.notes.filter(
          (n) => n.slot === Math.max(...st.notes.map((x) => x.slot)),
        );
        if (lastNotes.length === 0) continue;
        const notes = st.notes.map((n) =>
          lastNotes.includes(n) ? { ...n, durationSlots: n.durationSlots + 1 } : n,
        );
        next.push({ ...st, notes, cost: st.cost + (target ? miss(target) : 0) });
        continue;
      }

      if (tok.length > 1) {
        // Pinch (e.g. "TM"): thumb on 5/4/3, middle on 1; melody on the middle's string if it fits.
        const fingers = [...tok] as Finger[];
        const strings: StringNo[] = fingers.map(
          (f) => (f === "M" ? 1 : f === "I" ? 2 : 5) as StringNo,
        );
        // H9: no pinch containing the previous single note's finger, except T on a strong slot.
        if (
          prevSingle &&
          !st.reset &&
          fingers.includes(prevSingle.finger) &&
          !(prevSingle.finger === "T" && slot % 2 === 0)
        )
          continue;
        let cost = st.cost + w.pinchFill * (tpl.kind === "fill" ? 0.3 : 1);
        const notes: TabNote[] = [];
        let melodyPlaced = false;
        fingers.forEach((f, i) => {
          let s = strings[i]!;
          let fret: number | null = null;
          if (target && !melodyPlaced) {
            for (const cand of STRINGS_FOR[f]) {
              const fr = fretForPitch(tuning, plan, cand, target.midi);
              if (fr !== null) {
                s = cand;
                fret = fr;
                melodyPlaced = true;
                break;
              }
            }
          }
          if (fret === null) fret = fretFor(tuning, plan, s, pcs) ?? 0;
          notes.push({
            slot,
            durationSlots: 1,
            string: s,
            fret,
            finger: f,
            technique: "pick",
            isMelody: melodyPlaced && fret === fretForPitch(tuning, plan, s, target?.midi ?? -1),
            isAccent: false,
            pinchGroup: slot,
          });
        });
        // Pinch strings must be ordered T > I > M and distinct.
        const ordered = notes.slice().sort((a, b) => RANK[b.finger!] - RANK[a.finger!]);
        if (ordered.some((n, i) => i > 0 && n.string >= ordered[i - 1]!.string)) continue;
        if (target && !melodyPlaced) cost += miss(target);
        next.push({
          cost,
          notes: [...st.notes, ...notes],
          picks: st.picks,
          last: null,
          usedSlur: st.usedSlur,
          // A pinch resets the hand: the next single note isn't restricted by H1 (C4 H9).
          reset: true,
        });
        continue;
      }

      const f = tok as Finger;
      // Melody by slur from the previous note (hammer up, pull down, slide up a fret or two).
      if (target && st.last && slot > 0) {
        const fr = fretForPitch(tuning, plan, st.last.string, target.midi);
        if (fr !== null && fr !== st.last.fret && st.last.string !== 5) {
          const technique: Technique =
            fr > st.last.fret
              ? fr - st.last.fret <= 2 && st.last.fret > 0
                ? "slide-up"
                : "hammer"
              : "pull";
          const slurs = st.notes.filter((n) => n.technique !== "pick").length;
          next.push({
            cost: st.cost + w.slurCost + (slurs >= 2 ? w.extraSlurs : 0),
            notes: [
              ...st.notes,
              {
                slot,
                durationSlots: 1,
                string: st.last.string,
                fret: fr,
                finger: null,
                technique,
                isMelody: true,
                isAccent: false,
              },
            ],
            picks: st.picks,
            last: { string: st.last.string, fret: fr },
            usedSlur: true,
            reset: st.reset,
          });
        }
      }
      // Picked notes: melody if the finger can reach it, otherwise a filler chord tone.
      const choices: { s: StringNo; fret: number; melody: boolean; cost: number }[] = [];
      for (const s of STRINGS_FOR[f]) {
        if (!pickOk(prevPick, f, s)) continue;
        if (target) {
          const fr = fretForPitch(tuning, plan, s, target.midi);
          if (fr !== null) {
            let c = 0;
            if (s === 4) c += w.melodyOnString4;
            if (fr > 4) c += w.highFret * (fr - 4);
            if (!accentSlots.has(slot)) c += w.melodyOffAccent;
            choices.push({ s, fret: fr, melody: true, cost: c });
          }
        }
        const filler = fretFor(tuning, plan, s, pcs);
        const homeRank = HOME[f].indexOf(s);
        if (filler !== null) {
          choices.push({
            s,
            fret: filler,
            melody: false,
            cost: (target ? miss(target) : 0) + homeRank * 0.15,
          });
        } else if (s === 5 || s === 1 || s === 2 || s === 3 || s === 4) {
          // An open string that isn't a chord tone: allowed, but costs.
          if (s === 5 || !target) {
            choices.push({
              s,
              fret: 0,
              melody: false,
              cost: (target ? miss(target) : 0) + (s === 5 ? 0.2 : w.nonChordFiller),
            });
          }
        }
      }
      for (const c of choices) {
        const handMove =
          st.last && c.fret > 0 && st.last.fret > 0
            ? Math.abs(c.fret - st.last.fret) * w.handMove
            : 0;
        next.push({
          cost: st.cost + c.cost + handMove,
          notes: [
            ...st.notes,
            {
              slot,
              durationSlots: 1,
              string: c.s,
              fret: c.fret,
              finger: f,
              technique: "pick",
              isMelody: c.melody,
              isAccent: false,
            },
          ],
          picks: [...st.picks, { finger: f, string: c.s }],
          last: { string: c.s, fret: c.fret },
          usedSlur: st.usedSlur,
          reset: false,
        });
      }
    }
    // Keep the best few states per (last pick, last note).
    const best = new Map<string, SlotState>();
    for (const st of next) {
      const p = st.picks[st.picks.length - 1];
      const key = `${st.reset ? "R" : `${p?.finger}${p?.string}`}:${st.last?.string}/${st.last?.fret}`;
      const cur = best.get(key);
      if (!cur || st.cost < cur.cost) best.set(key, st);
    }
    states = [...best.values()].sort((a, b) => a.cost - b.cost).slice(0, 24);
    if (states.length === 0) return [];
  }
  return states.map((st) => ({
    notes: st.notes,
    picks: st.picks,
    cost:
      st.cost +
      (tpl.kind === "roll" && !st.usedSlur ? w.namedRoll : tpl.kind === "halves" ? w.halfRolls : 0),
    usedSlur: st.usedSlur,
  }));
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
): ArrangedMeasure {
  const roll = ROLLS[0]!;
  const fingers = roll.fingers.slice(roll.fingers.length - m.slots);
  const strings = roll.exampleStrings.slice(roll.exampleStrings.length - m.slots);
  const notes: TabNote[] = fingers.map((f, i) => {
    const chord = chordAt(parsed, i, startChord);
    const pcs = chord ? chordPitchClasses(chord) : new Set<number>();
    const s = strings[i]!;
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
    const cands: Candidate[] = [];
    for (const tpl of templates) {
      for (const o of measureOptions(tpl, m, targets, parsed, startChord, tuning, plan, w)) {
        const measure: ArrangedMeasure = {
          index: m.index,
          slots: m.slots,
          chords: raw,
          rollName: rollNameFor(tpl, o.usedSlur),
          source: override ? "override" : "generated",
          ...(isLast && tpl.kind === "fill" ? { phraseEnd: true } : {}),
          notes: o.notes.slice().sort((a, b) => a.slot - b.slot || b.string - a.string),
        };
        if (validate([measure], { tuning, plan }).some((v) => v.severity === "error")) continue;
        cands.push({ measure, cost: o.cost + (isLast && tpl.name === "tag" ? -1 : 0) });
      }
    }
    cands.sort((a, b) => a.cost - b.cost);
    const unique: Candidate[] = [];
    const seen = new Set<string>();
    for (const c of cands) {
      const key = c.measure.notes
        .map((n) => `${n.slot}${n.string}${n.fret}${n.finger}${n.technique}`)
        .join();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(c);
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
        measure: fallbackMeasure(m, raw, parsed, startChord, tuning, plan),
        cost: 100,
      });
    }
    // Backups that ignore the melody, one per starting finger, so some candidate can always
    // join the measure before legally (otherwise the search could be left with only illegal
    // joins). They cost a lot, so they're only used when nothing else fits.
    const firstFingers = new Set<string>();
    // The allowed rolls come first; the others only fill in so a legal join always exists.
    for (const tpl of [...allowed, ...TEMPLATES.filter((t) => !allowed.includes(t))]) {
      if (tpl.kind === "fill" || firstFingers.size >= 3) continue;
      const first = tpl.tokens[tpl.tokens.length - m.slots] ?? "";
      if (firstFingers.has(first)) continue;
      const opt = measureOptions(tpl, m, [], parsed, startChord, tuning, plan, w)[0];
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

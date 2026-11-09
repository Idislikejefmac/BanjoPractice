// C4 · Rule validator (style guide §4.1; DEVELOPMENT.md C4, rules H1–H9).
// A pure function: legal or illegal, with reasons. Scoring lives in the arranger (C6).

import type { CapoPlan, Tuning } from "./tuning.ts";
import { isPlayableFret, NO_CAPO } from "./tuning.ts";
import type { ArrangedMeasure, Finger, StringNo, TabNote } from "./types.ts";
import { FINGER_NAME } from "./types.ts";

export type RuleId = "H1" | "H2" | "H3" | "H4" | "H5" | "H6" | "H7" | "H8" | "H9" | "STRUCT";

export interface Violation {
  readonly rule: RuleId;
  readonly severity: "error" | "warning";
  /** The measure's written index (ArrangedMeasure.index). */
  readonly measure: number;
  /** 0-based slot. Messages show slot + 1. */
  readonly slot: number;
  readonly message: string;
}

export interface ValidateOptions {
  tuning?: Tuning;
  plan?: CapoPlan;
  /**
   * Extra joins to check as warnings, as positions in the measures array: repeat back-edges
   * and first/second-ending jumps. Section-loop restarts are never passed here (exempt).
   */
  extraEdges?: readonly { readonly from: number; readonly to: number }[];
}

/** Finger–string pairs from the guide's "usual" and "occasionally" columns (H4). */
const ALLOWED_STRINGS: Readonly<Record<Finger, readonly StringNo[]>> = {
  T: [5, 4, 3, 2],
  I: [2, 3, 4],
  M: [1, 2],
};

/** T > I > M: the thumb sits on the highest-numbered strings. */
const RANK: Readonly<Record<Finger, number>> = { T: 3, I: 2, M: 1 };

/** Max fret distance within one chord shape: four adjacent frets (H5). */
const MAX_REACH = 3;

type Event =
  | { kind: "single"; pos: number; slot: number; note: TabNote }
  | { kind: "pinch"; pos: number; slot: number; notes: TabNote[] }
  | { kind: "slur"; pos: number; slot: number; note: TabNote };

const isStrongSlot = (slot: number): boolean => slot % 2 === 0; // slots 1, 3, 5, 7 (1-based)

export function validate(
  measures: readonly ArrangedMeasure[],
  opts: ValidateOptions = {},
): Violation[] {
  const out: Violation[] = [];
  try {
    validateInto(measures, opts, out);
  } catch (err) {
    out.push({
      rule: "STRUCT",
      severity: "error",
      measure: -1,
      slot: 0,
      message: `Malformed arrangement data: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
  return out;
}

export function isLegal(measures: readonly ArrangedMeasure[], opts: ValidateOptions = {}): boolean {
  return !validate(measures, opts).some((v) => v.severity === "error");
}

function validateInto(
  measures: readonly ArrangedMeasure[],
  opts: ValidateOptions,
  out: Violation[],
): void {
  // Playability (H8) only needs the capo plan; pitch-level checks arrive with C6.
  const plan = opts.plan ?? NO_CAPO;

  const eventsByMeasure: Event[][] = [];
  measures.forEach((m, pos) => {
    const push = (
      rule: RuleId,
      slot: number,
      message: string,
      severity: "error" | "warning" = "error",
    ) =>
      out.push({
        rule,
        severity,
        measure: m.index,
        slot,
        message: `${message} (${where(m.index, slot)})`,
      });
    eventsByMeasure.push(checkMeasure(m, pos, pos === measures.length - 1, plan, push));
  });

  // Sequence rules in written order, across bar lines.
  let lastNonSlur: Event | null = null;
  let lastAny: Event | null = null;
  measures.forEach((m, pos) => {
    for (const ev of eventsByMeasure[pos] ?? []) {
      const push = (rule: RuleId, message: string) =>
        out.push({
          rule,
          severity: "error",
          measure: m.index,
          slot: ev.slot,
          message: `${message} (${where(m.index, ev.slot)})`,
        });
      if (ev.kind === "slur") {
        checkSlur(ev, lastAny, push);
      } else {
        checkTransition(lastNonSlur, ev, push);
        lastNonSlur = ev;
      }
      lastAny = ev;
    }
  });

  // Repeat and ending joins: same checks, reported as warnings.
  for (const edge of opts.extraEdges ?? []) {
    const from = measures[edge.from];
    const to = measures[edge.to];
    if (!from || !to) continue;
    const prev =
      [...(eventsByMeasure[edge.from] ?? [])].reverse().find((e) => e.kind !== "slur") ?? null;
    const next = (eventsByMeasure[edge.to] ?? []).find((e) => e.kind !== "slur");
    if (!next) continue;
    checkTransition(prev, next, (rule, message) =>
      out.push({
        rule,
        severity: "warning",
        measure: to.index,
        slot: next.slot,
        message: `${message} (repeat join from measure ${from.index} to ${where(to.index, next.slot)})`,
      }),
    );
  }
}

function where(measure: number, slot: number): string {
  return `measure ${measure}, note ${slot + 1}`;
}

/** Per-measure structure and per-note rules: H4, H5, H6, H7 (finger part), H8, pinch H3. */
function checkMeasure(
  m: ArrangedMeasure,
  pos: number,
  isLast: boolean,
  plan: CapoPlan,
  push: (rule: RuleId, slot: number, message: string) => void,
): Event[] {
  if (!Number.isInteger(m.slots) || m.slots < 1) {
    push("STRUCT", 0, `Measure has an invalid slot count ${m.slots}`);
    return [];
  }

  const covered = new Array<boolean>(m.slots).fill(false);
  const bySlot = new Map<number, TabNote[]>();

  for (const n of m.notes) {
    if (!Number.isInteger(n.slot) || n.slot < 0 || n.slot >= m.slots) {
      push("STRUCT", 0, `Note is outside the measure (slot ${n.slot + 1} of ${m.slots})`);
      continue;
    }
    if (
      !Number.isInteger(n.durationSlots) ||
      n.durationSlots < 1 ||
      n.slot + n.durationSlots > m.slots
    ) {
      push("STRUCT", n.slot, "Note duration runs past the end of the measure");
    }
    for (let s = n.slot; s < Math.min(m.slots, n.slot + Math.max(1, n.durationSlots)); s++)
      covered[s] = true;

    if (!isPlayableFret(n.string, n.fret, plan)) {
      push("H8", n.slot, `String ${n.string} has no fret ${n.fret}`);
    }
    if (n.technique === "pick") {
      if (n.finger === null) {
        push("H4", n.slot, "A picked note needs a finger (T, I or M)");
      } else if (!ALLOWED_STRINGS[n.finger].includes(n.string)) {
        push(
          "H4",
          n.slot,
          `${FINGER_NAME[n.finger]} doesn't play string ${n.string} in Scruggs style`,
        );
      }
    } else if (n.finger !== null) {
      push(
        "H7",
        n.slot,
        "A slurred note (hammer-on, pull-off, slide, choke) isn't picked, so it has no finger",
      );
    }
    const list = bySlot.get(n.slot) ?? [];
    list.push(n);
    bySlot.set(n.slot, list);
  }

  // H6: every slot covered, except in tags, at phrase ends and at the end of the piece.
  const restsAllowed = m.rollName.startsWith("tag") || m.phraseEnd === true || isLast;
  if (!restsAllowed) {
    covered.forEach((c, slot) => {
      if (!c)
        push(
          "H6",
          slot,
          "Every note of the roll must be filled (rests only at phrase ends and in tags)",
        );
    });
  }

  checkReach(m, push);

  const events: Event[] = [];
  for (const slot of [...bySlot.keys()].sort((a, b) => a - b)) {
    const notes = bySlot.get(slot) ?? [];
    const slurs = notes.filter((n) => n.technique !== "pick");
    if (slurs.length > 0) {
      if (notes.length > 1)
        push("STRUCT", slot, "A slurred note can't share its slot with other notes");
      const first = slurs[0];
      if (first) events.push({ kind: "slur", pos, slot, note: first });
      continue;
    }
    if (notes.length === 1) {
      const only = notes[0];
      if (only) events.push({ kind: "single", pos, slot, note: only });
      continue;
    }
    const group = notes[0]?.pinchGroup;
    if (group === undefined || notes.some((n) => n.pinchGroup !== group)) {
      push("STRUCT", slot, "Notes struck together must be marked as one pinch");
    }
    checkPinchShape(notes, slot, push);
    events.push({ kind: "pinch", pos, slot, notes });
  }
  return events;
}

/** H3 inside a pinch: one finger per string, string(T) > string(I) > string(M). */
function checkPinchShape(
  notes: TabNote[],
  slot: number,
  push: (rule: RuleId, slot: number, message: string) => void,
): void {
  const fingers = notes.map((n) => n.finger);
  if (new Set(fingers).size !== fingers.length)
    push("H3", slot, "A pinch uses the same finger twice");
  if (new Set(notes.map((n) => n.string)).size !== notes.length) {
    push("H3", slot, "A pinch strikes the same string twice");
  }
  const ranked = [...notes].sort((a, b) => RANK[b.finger ?? "M"] - RANK[a.finger ?? "M"]);
  for (let i = 1; i < ranked.length; i++) {
    const hi = ranked[i - 1];
    const lo = ranked[i];
    if (hi && lo && hi.string <= lo.string) {
      push(
        "H3",
        slot,
        "Fingers cross in this pinch (thumb must be on a higher-numbered string than index, index than middle)",
      );
    }
  }
}

/** H5: fretted notes in one chord segment fit in four adjacent frets; 5th string only in licks. */
function checkReach(
  m: ArrangedMeasure,
  push: (rule: RuleId, slot: number, message: string) => void,
): void {
  const starts = [...m.chords].map((c) => c.atSlot).sort((a, b) => a - b);
  if (starts[0] !== 0) starts.unshift(0);
  for (let i = 0; i < starts.length; i++) {
    const from = starts[i] ?? 0;
    const to = starts[i + 1] ?? m.slots;
    const fretted = m.notes.filter(
      (n) => n.slot >= from && n.slot < to && n.fret > 0 && n.string !== 5,
    );
    if (fretted.length === 0) continue;
    const frets = fretted.map((n) => n.fret);
    if (Math.max(...frets) - Math.min(...frets) > MAX_REACH) {
      const worst = fretted.reduce((a, b) => (b.fret > a.fret ? b : a));
      push("H5", worst.slot, "This stretch is wider than four frets for the left hand");
    }
  }
  if (!m.rollName.startsWith("lick:")) {
    for (const n of m.notes) {
      if (n.string === 5 && n.fret > 0)
        push("H5", n.slot, "Fretting the 5th string is only used inside specific licks");
    }
  }
}

/** H1, H2, H3 (sequence) and H9 between the previous non-slur event and this one. */
function checkTransition(
  prev: Event | null,
  cur: Event,
  push: (rule: RuleId, message: string) => void,
): void {
  if (!prev || prev.kind === "slur" || cur.kind === "slur") return;
  // After a pinch the hand resets: the next note is unrestricted (H9).
  if (prev.kind === "pinch") return;
  const p = prev.note;
  if (!p.finger) return;

  if (cur.kind === "pinch") {
    const reused = cur.notes.some((n) => n.finger === p.finger);
    if (reused && !(p.finger === "T" && isStrongSlot(cur.slot))) {
      push("H9", `${FINGER_NAME[p.finger]} picks a note and then the pinch right after it`);
    }
    return;
  }

  const c = cur.note;
  if (!c.finger) return;
  if (p.finger === c.finger) push("H1", `${FINGER_NAME[c.finger]} picks twice in a row`);
  if (p.string === c.string) push("H2", `String ${c.string} is picked twice in a row`);
  if (p.finger !== c.finger) {
    const [hi, lo] = RANK[p.finger] > RANK[c.finger] ? [p, c] : [c, p];
    if (hi.string < lo.string) {
      push(
        "H3",
        `Fingers cross: ${FINGER_NAME[hi.finger ?? "T"].toLowerCase()} on string ${hi.string} next to ${FINGER_NAME[lo.finger ?? "M"].toLowerCase()} on string ${lo.string}`,
      );
    }
  }
}

/** H7: a slur follows a note on the same string and moves the right way. */
function checkSlur(
  ev: Extract<Event, { kind: "slur" }>,
  prev: Event | null,
  push: (rule: RuleId, message: string) => void,
): void {
  const n = ev.note;
  const prevNotes = !prev ? [] : prev.kind === "pinch" ? prev.notes : [prev.note];
  const from = prevNotes.find((p) => p.string === n.string);
  if (!from) {
    push("H7", `A ${describe(n)} must follow a note on the same string`);
    return;
  }
  const ok =
    n.technique === "hammer" || n.technique === "slide-up"
      ? n.fret > from.fret
      : n.technique === "pull" || n.technique === "slide-down"
        ? n.fret < from.fret
        : n.fret === from.fret; // choke: bend the fretted note
  if (!ok) push("H7", `This ${describe(n)} goes the wrong way (fret ${from.fret} → ${n.fret})`);
}

function describe(n: TabNote): string {
  switch (n.technique) {
    case "hammer":
      return "hammer-on";
    case "pull":
      return "pull-off";
    case "slide-up":
      return "slide up";
    case "slide-down":
      return "slide down";
    case "choke":
      return "choke";
    default:
      return "note";
  }
}

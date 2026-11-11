// C10 · "Why this note?" (LEARNING_SPEC.md F39). A classifier that runs after the fact, so it
// works for hand-written tabs too (they never pass through the arranger).

import { pitchAt } from "../banjo/tuning.ts";
import type { CapoPlan, Tuning } from "../banjo/tuning.ts";
import type { ArrangedMeasure, TabNote } from "../banjo/types.ts";
import { chordPitchClasses, parseChord } from "../music/chords.ts";
import { mod12 } from "../music/notes.ts";

export type NoteRole =
  | "melody" // the tune
  | "slur" // hammer-on, pull-off or slide: no new pick
  | "drone" // open 5th string
  | "chord-tone" // fills in with a note of the chord
  | "passing"; // in no chord we can read (or none is written)

export const ROLE_LABEL: Readonly<Record<NoteRole, string>> = {
  melody: "Melody note",
  slur: "Hammer, pull or slide",
  drone: "5th-string drone",
  "chord-tone": "Chord tone",
  passing: "Not in the chord",
};

export interface ClassifyContext {
  readonly tuning: Tuning;
  readonly plan: CapoPlan;
}

/** The chord sounding at `slot`: the last one that starts at or before it. */
function chordAt(m: ArrangedMeasure, slot: number): string | undefined {
  let found: string | undefined;
  let at = -1;
  for (const c of m.chords) {
    if (c.atSlot <= slot && c.atSlot >= at) {
      found = c.chord;
      at = c.atSlot;
    }
  }
  return found;
}

export function classifyNote(m: ArrangedMeasure, note: TabNote, ctx: ClassifyContext): NoteRole {
  if (note.isMelody) return "melody";
  if (note.technique !== "pick") return "slur";
  if (note.string === 5 && note.fret === 0) return "drone";
  const symbol = chordAt(m, note.slot);
  const chord = symbol === undefined ? null : parseChord(symbol);
  if (!chord) return "passing";
  const pc = mod12(pitchAt(ctx.tuning, note.string, note.fret, ctx.plan));
  return chordPitchClasses(chord).has(pc) ? "chord-tone" : "passing";
}

export function classifyMeasure(
  m: ArrangedMeasure,
  ctx: ClassifyContext,
): { note: TabNote; role: NoteRole }[] {
  return m.notes.map((note) => ({ note, role: classifyNote(m, note, ctx) }));
}

export interface StepNoteInfo {
  readonly role: NoteRole;
  readonly label: string;
  readonly string: number;
  /** Capo-relative fret, as stored. */
  readonly fret: number;
  readonly finger: "T" | "I" | "M" | null;
}

/** Every note struck at `slot` (a pinch strikes several), each with why it is there. */
export function explainSlot(
  m: ArrangedMeasure,
  slot: number,
  ctx: ClassifyContext,
): StepNoteInfo[] {
  return m.notes
    .filter((n) => n.slot === slot)
    .map((n) => {
      const role = classifyNote(m, n, ctx);
      return { role, label: ROLE_LABEL[role], string: n.string, fret: n.fret, finger: n.finger };
    });
}

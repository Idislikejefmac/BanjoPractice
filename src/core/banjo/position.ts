// C8 · Key, capo and position planner (DEVELOPMENT.md §3 C8, style guide §9).
//
// Given the key Dad wants to hear and the key the tab's shapes are in, work out the capo,
// what to do with the 5th string, and whether the tab can stay as written.
//
// - Plans are keyed on the key signature through a per-mode table of "home" shape keys.
// - Practical capo limit is fret 5; capo 6–7 is only offered as an alternative; never > 7.
// - The 5th string goes up by the capo (plus the shape's own 5th-string tuning, e.g. a for
//   D position), via a spike at fret 5 + raise if Dad has one, otherwise by retuning.

import type { Key, Mode } from "../music/keys.ts";
import { formatKey, sameKey } from "../music/keys.ts";
import type { NoteName } from "../music/notes.ts";
import { formatNoteName, mod12, pitchClass } from "../music/notes.ts";
import { spellInKey, transposeKey } from "../music/spelling.ts";
import type { CapoPlan, FifthRaise } from "./tuning.ts";
import { FIFTH_STRING_NUT } from "./tuning.ts";

export const PRACTICAL_CAPO = 5;
export const MAX_CAPO = 7;

export interface PositionPlan {
  readonly soundingKey: Key;
  /** The key the tab shapes are in. */
  readonly shapeKey: Key;
  readonly capo: CapoPlan;
  /** The tab as written can be played with this plan (same shapes, just a capo). */
  readonly keepsTab: boolean;
  /** One line for the banner, e.g. "Capo 2 · 5th string to A (spike at 7)". */
  readonly instruction: string;
}

/** Shape keys played without a capo, in order of preference, per mode. */
const HOME_SHAPES: Readonly<Record<Mode, readonly string[]>> = {
  major: ["G", "C", "D"],
  mixolydian: ["G", "C", "D"],
  dorian: ["A", "E", "D"],
  minor: ["E", "A", "D"],
};

/**
 * Explicit choices where the nearest home shape isn't the idiomatic one (style guide §9):
 * F major is played in C position capo 5, not D position capo 3.
 */
const PREFERRED: Readonly<Record<string, { shape: string; capo: number }>> = {
  "major:5": { shape: "C", capo: 5 },
  "mixolydian:5": { shape: "C", capo: 5 },
};

/** Semitones the 5th string is raised for each shape family before any capo. */
function shapeFifthRaise(shape: Key): number {
  // D position (D, and the D-major pitch set) wants the 5th string at a.
  return shape.tonic.letter === "D" && shape.tonic.accidental === 0 ? 2 : 0;
}

const letterKey = (tonic: string, mode: Mode): Key => ({
  tonic: { letter: tonic as NoteName["letter"], accidental: 0 },
  mode,
});

function fifthPlan(raise: number, spikes: readonly number[]): FifthRaise {
  if (raise === 0) return { semitones: 0, by: "none" };
  const spikeFret = FIFTH_STRING_NUT + raise;
  if (spikes.includes(spikeFret)) return { semitones: raise, by: "spike", spikeFret };
  return { semitones: raise, by: "retune" };
}

function instructionFor(capo: number, fifth: FifthRaise, sounding: Key): string {
  const parts: string[] = [capo === 0 ? "No capo" : `Capo ${capo}`];
  if (fifth.semitones > 0) {
    // The open 5th string is g (G4); name the new pitch as it's spelled in the key.
    const note = formatNoteName(spellInKey(7 + fifth.semitones, sounding));
    parts.push(
      fifth.by === "spike"
        ? `5th string to ${note} (spike at ${fifth.spikeFret})`
        : `tune 5th string up to ${note}`,
    );
  }
  return parts.join(" · ");
}

function makePlan(
  sounding: Key,
  shape: Key,
  capo: number,
  spikes: readonly number[],
  keepsTab: boolean,
): PositionPlan {
  const fifth = fifthPlan(capo + shapeFifthRaise(shape), spikes);
  return {
    soundingKey: sounding,
    shapeKey: shape,
    capo: { capo, fifth },
    keepsTab,
    instruction: instructionFor(capo, fifth, sounding),
  };
}

const capoFrom = (shape: Key, sounding: Key) =>
  mod12(pitchClass(sounding.tonic) - pitchClass(shape.tonic));

export interface PlanOptions {
  /** The arrangement's shape key. Plans that keep it are preferred (the tab stays). */
  readonly arrangementShape?: Key;
  readonly spikes?: readonly number[];
}

/**
 * The plan for a sounding key. With an arrangement, a capo of 0–5 on its own shapes wins
 * (the tab doesn't change); otherwise the per-mode table picks the shapes and the tab needs
 * re-arranging (keepsTab false).
 */
export function planFor(sounding: Key, opts: PlanOptions = {}): PositionPlan {
  const spikes = opts.spikes ?? [];
  const shape = opts.arrangementShape;
  if (shape && shape.mode === sounding.mode) {
    const capo = capoFrom(shape, sounding);
    if (capo <= PRACTICAL_CAPO) return makePlan(sounding, shape, capo, spikes, true);
  }
  const chosen = tablePlan(sounding);
  const keeps = shape !== undefined && sameKey(chosen.shape, shape);
  return makePlan(sounding, chosen.shape, chosen.capo, spikes, keeps);
}

function tablePlan(sounding: Key): { shape: Key; capo: number } {
  const pc = mod12(pitchClass(sounding.tonic));
  const preferred = PREFERRED[`${sounding.mode}:${pc}`];
  if (preferred) return { shape: letterKey(preferred.shape, sounding.mode), capo: preferred.capo };
  let best: { shape: Key; capo: number } | null = null;
  for (const tonic of HOME_SHAPES[sounding.mode]) {
    const shape = letterKey(tonic, sounding.mode);
    const capo = capoFrom(shape, sounding);
    if (!best || capo < best.capo) best = { shape, capo };
  }
  return best!;
}

/**
 * Every plan worth offering for a sounding key: the main one, then the arrangement's own
 * shapes with capo 6–7 (if that keeps the tab), then other home shapes within the limit.
 */
export function plansFor(sounding: Key, opts: PlanOptions = {}): PositionPlan[] {
  const spikes = opts.spikes ?? [];
  const main = planFor(sounding, opts);
  const out = [main];
  const seen = new Set([`${formatKey(main.shapeKey)}:${main.capo.capo}`]);
  const add = (shape: Key, capo: number, keeps: boolean) => {
    const id = `${formatKey(shape)}:${capo}`;
    if (seen.has(id) || capo > MAX_CAPO) return;
    seen.add(id);
    out.push(makePlan(sounding, shape, capo, spikes, keeps));
  };
  const shape = opts.arrangementShape;
  if (shape && shape.mode === sounding.mode) add(shape, capoFrom(shape, sounding), true);
  for (const tonic of HOME_SHAPES[sounding.mode]) {
    const s = letterKey(tonic, sounding.mode);
    const capo = capoFrom(s, sounding);
    if (capo <= PRACTICAL_CAPO) add(s, capo, shape !== undefined && sameKey(s, shape));
  }
  return out;
}

/** Keys that keep the tab as written (same shapes, capo 0–7), for the phase-2 key picker. */
export function keysKeepingTab(shape: Key): { key: Key; capo: number }[] {
  const out: { key: Key; capo: number }[] = [];
  for (let capo = 0; capo <= MAX_CAPO; capo++) out.push({ key: transposeKey(shape, capo), capo });
  return out;
}

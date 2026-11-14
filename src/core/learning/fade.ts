// C10 · Learning helpers (LEARNING_SPEC.md F37). Pure: no clock, no storage, no UI.
//
// A roll lesson fades its help in four steps. The app can't hear him play, so it never decides
// he is ready: the step is only where he chose to be, and he moves it himself.

import { isChordChoice } from "../banjo/exercises.ts";

export type FadeLevel = 1 | 2 | 3 | 4;

/** Which of a roll's two views he is in: the two-measure lesson, or the full exercise. */
export type RollView = "learn" | "full";

export interface FadeState {
  readonly level: FadeLevel;
  /** The chord the lesson's two measures use (one of the exercise's chord choices). */
  readonly chord: string;
  readonly view: RollView;
}

export const INITIAL_FADE: FadeState = { level: 1, chord: "G", view: "learn" };

/** One step toward more (-1) or less (+1) help, kept inside 1 to 4. */
export function stepLevel(level: FadeLevel, by: -1 | 1): FadeLevel {
  return Math.min(4, Math.max(1, level + by)) as FadeLevel;
}

export type HintKind = "finger" | "string";

/**
 * Slots (0-based) whose hint is hidden at a level. Level 1 shows everything; level 2 hides
 * both hints in the second half; level 3 hides the strings but keeps the finger names; level 4
 * hides everything so he supplies each note himself.
 */
export function hiddenSlots(level: FadeLevel, kind: HintKind, slots = 8): number[] {
  const all = Array.from({ length: slots }, (_, i) => i);
  switch (level) {
    case 1:
      return [];
    case 2:
      return all.filter((s) => s >= slots / 2);
    case 3:
      return kind === "string" ? all : [];
    case 4:
      return all;
  }
}

/**
 * Reads back a stored state defensively: anything malformed becomes the starting state. Older
 * saves held only the step (once also "Got it" / "Again" counters); the lesson chord and the
 * view then start at their defaults.
 */
export function parseFadeState(value: unknown): FadeState {
  if (typeof value !== "object" || value === null) return INITIAL_FADE;
  const v = value as Record<string, unknown>;
  const level = v.level;
  if (level !== 1 && level !== 2 && level !== 3 && level !== 4) return INITIAL_FADE;
  return {
    level,
    chord: isChordChoice(v.chord) ? v.chord : INITIAL_FADE.chord,
    view: v.view === "full" ? "full" : "learn",
  };
}

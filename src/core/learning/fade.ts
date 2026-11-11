// C10 · Learning helpers (LEARNING_SPEC.md F37). Pure: no clock, no storage, no UI.
//
// A roll lesson fades its help in four steps as the learner rates his own passes. The app can't
// hear whether he played it right, so progress comes only from "Got it" / "Again".

export type FadeLevel = 1 | 2 | 3 | 4;
export type Rating = "got-it" | "again";

/** Consecutive "Got it" ratings that move a roll one step toward less help. */
export const GOT_IT_TO_ADVANCE = 3;
/** Consecutive "Again" ratings that move a roll one step back toward more help. */
export const AGAIN_TO_RETREAT = 2;

export interface FadeState {
  readonly level: FadeLevel;
  readonly gotItRun: number;
  readonly againRun: number;
}

export const INITIAL_FADE: FadeState = { level: 1, gotItRun: 0, againRun: 0 };

export function rate(state: FadeState, rating: Rating): FadeState {
  if (rating === "got-it") {
    const run = state.gotItRun + 1;
    if (run >= GOT_IT_TO_ADVANCE && state.level < 4) {
      return { level: (state.level + 1) as FadeLevel, gotItRun: 0, againRun: 0 };
    }
    return { level: state.level, gotItRun: Math.min(run, GOT_IT_TO_ADVANCE), againRun: 0 };
  }
  const run = state.againRun + 1;
  if (run >= AGAIN_TO_RETREAT && state.level > 1) {
    return { level: (state.level - 1) as FadeLevel, gotItRun: 0, againRun: 0 };
  }
  return { level: state.level, gotItRun: 0, againRun: Math.min(run, AGAIN_TO_RETREAT) };
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

/** Reads back a stored state defensively: anything malformed becomes the starting state. */
export function parseFadeState(value: unknown): FadeState {
  if (typeof value !== "object" || value === null) return INITIAL_FADE;
  const v = value as Record<string, unknown>;
  const level = v.level;
  const run = (x: unknown, max: number): number =>
    typeof x === "number" && Number.isInteger(x) && x >= 0 && x <= max ? x : 0;
  if (level !== 1 && level !== 2 && level !== 3 && level !== 4) return INITIAL_FADE;
  return {
    level,
    gotItRun: run(v.gotItRun, GOT_IT_TO_ADVANCE),
    againRun: run(v.againRun, AGAIN_TO_RETREAT),
  };
}

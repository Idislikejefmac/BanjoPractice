// C10 · Saved learning progress (LEARNING_SPEC.md F37). Pure: reading and updating the record
// that the app keeps as one document (meta store, key "learning").

import { ROLLS } from "../banjo/rolls.ts";
import { INITIAL_FADE, parseFadeState, rate } from "./fade.ts";
import type { FadeState, Rating } from "./fade.ts";

export const LEARNING_VERSION = 1;

export interface LearningProgress {
  readonly version: typeof LEARNING_VERSION;
  /** Fade state per roll id. A roll with no entry is at the starting state. */
  readonly rolls: Readonly<Record<string, FadeState>>;
}

export const EMPTY_PROGRESS: LearningProgress = { version: LEARNING_VERSION, rolls: {} };

const KNOWN = new Set(ROLLS.map((r) => r.id));

/**
 * Reads a stored or imported record without trusting it: anything malformed is dropped, rolls
 * this version doesn't know are ignored, and a document from a newer version is not used.
 */
export function readProgress(value: unknown): LearningProgress {
  if (typeof value !== "object" || value === null) return EMPTY_PROGRESS;
  const v = value as Record<string, unknown>;
  if (typeof v.version === "number" && v.version > LEARNING_VERSION) return EMPTY_PROGRESS;
  const raw = v.rolls;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return EMPTY_PROGRESS;
  const rolls: Record<string, FadeState> = {};
  for (const id of Object.keys(raw)) {
    if (!KNOWN.has(id)) continue;
    const state = parseFadeState((raw as Record<string, unknown>)[id]);
    if (state.level !== INITIAL_FADE.level || state.gotItRun > 0 || state.againRun > 0) {
      rolls[id] = state;
    }
  }
  return { version: LEARNING_VERSION, rolls };
}

export function fadeFor(progress: LearningProgress, rollId: string): FadeState {
  return Object.hasOwn(progress.rolls, rollId)
    ? (progress.rolls[rollId] ?? INITIAL_FADE)
    : INITIAL_FADE;
}

/** The progress after he rates one pass of a roll. An unknown roll changes nothing. */
export function rateRoll(
  progress: LearningProgress,
  rollId: string,
  rating: Rating,
): LearningProgress {
  if (!KNOWN.has(rollId)) return progress;
  return {
    version: LEARNING_VERSION,
    rolls: { ...progress.rolls, [rollId]: rate(fadeFor(progress, rollId), rating) },
  };
}

/**
 * Combines two records (a restore onto an iPad that already has some): for each roll the one
 * further along wins, so restoring an old backup never takes progress away.
 */
export function mergeProgress(a: LearningProgress, b: LearningProgress): LearningProgress {
  const rolls: Record<string, FadeState> = {};
  for (const id of new Set([...Object.keys(a.rolls), ...Object.keys(b.rolls)])) {
    const x = fadeFor(a, id);
    const y = fadeFor(b, id);
    rolls[id] = y.level > x.level || (y.level === x.level && y.gotItRun > x.gotItRun) ? y : x;
  }
  return { version: LEARNING_VERSION, rolls };
}

/** Start this roll's lesson over from full help. */
export function resetRoll(progress: LearningProgress, rollId: string): LearningProgress {
  const rolls = Object.fromEntries(Object.entries(progress.rolls).filter(([id]) => id !== rollId));
  return { version: LEARNING_VERSION, rolls };
}

// C10 · Saved learning progress (LEARNING_SPEC.md F37). Pure: reading and updating the record
// that the app keeps as one document (meta store, key "learning").

import { ROLLS } from "../banjo/rolls.ts";
import { INITIAL_FADE, parseFadeState } from "./fade.ts";
import type { FadeLevel, FadeState } from "./fade.ts";

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
    if (state.level !== INITIAL_FADE.level) {
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

/** The progress after he moves a roll to a step. Step 1 is the start, so it keeps no entry. */
export function setRollLevel(
  progress: LearningProgress,
  rollId: string,
  level: FadeLevel,
): LearningProgress {
  if (!KNOWN.has(rollId)) return progress;
  const rolls = Object.fromEntries(Object.entries(progress.rolls).filter(([id]) => id !== rollId));
  if (level !== INITIAL_FADE.level) rolls[rollId] = { level };
  return { version: LEARNING_VERSION, rolls };
}

/**
 * Combines two records (a restore onto an iPad that already has some). The step is only a place
 * marker, so a roll the iPad has already moved keeps its own step; otherwise the backup's is used.
 */
export function mergeProgress(a: LearningProgress, b: LearningProgress): LearningProgress {
  const rolls: Record<string, FadeState> = {};
  for (const id of new Set([...Object.keys(a.rolls), ...Object.keys(b.rolls)])) {
    rolls[id] = fadeFor(a, id).level !== INITIAL_FADE.level ? fadeFor(a, id) : fadeFor(b, id);
  }
  return { version: LEARNING_VERSION, rolls };
}

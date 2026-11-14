// C10 · Saved learning progress (LEARNING_SPEC.md F37). Pure: reading and updating the record
// that the app keeps as one document (meta store, key "learning").

import { ROLLS } from "../banjo/rolls.ts";
import { INITIAL_FADE, parseFadeState } from "./fade.ts";
import type { FadeState } from "./fade.ts";

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
    if (!isInitial(state)) rolls[id] = state;
  }
  return { version: LEARNING_VERSION, rolls };
}

const isInitial = (s: FadeState): boolean =>
  s.level === INITIAL_FADE.level && s.chord === INITIAL_FADE.chord && s.view === INITIAL_FADE.view;

export function fadeFor(progress: LearningProgress, rollId: string): FadeState {
  return Object.hasOwn(progress.rolls, rollId)
    ? (progress.rolls[rollId] ?? INITIAL_FADE)
    : INITIAL_FADE;
}

/**
 * The progress after he changes something about a roll: its step, its lesson chord or its view.
 * A roll back at its starting state keeps no entry; an unknown roll changes nothing.
 */
export function updateRoll(
  progress: LearningProgress,
  rollId: string,
  patch: Partial<FadeState>,
): LearningProgress {
  if (!KNOWN.has(rollId)) return progress;
  const next: FadeState = { ...fadeFor(progress, rollId), ...patch };
  const rolls = Object.fromEntries(Object.entries(progress.rolls).filter(([id]) => id !== rollId));
  if (!isInitial(next)) rolls[rollId] = next;
  return { version: LEARNING_VERSION, rolls };
}

/**
 * Combines two records (a restore onto an iPad that already has some). These are only place
 * markers, so a roll the iPad has already changed keeps its own; otherwise the backup's is used.
 */
export function mergeProgress(a: LearningProgress, b: LearningProgress): LearningProgress {
  const rolls: Record<string, FadeState> = {};
  for (const id of new Set([...Object.keys(a.rolls), ...Object.keys(b.rolls)])) {
    rolls[id] = !isInitial(fadeFor(a, id)) ? fadeFor(a, id) : fadeFor(b, id);
  }
  return { version: LEARNING_VERSION, rolls };
}

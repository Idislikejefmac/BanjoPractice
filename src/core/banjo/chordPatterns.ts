// F46 · Saved chord patterns for the roll exercises: a name for the chords he has chosen for the
// exercise's measures ("the D7 version"), kept so he can come back to it. Pure: no storage or UI.
// A pattern holds only the chords (measure position → chord); it works with every roll.

import { EXERCISE_PROGRESSIONS, OPEN_STRING_MEASURES, validChordOverrides } from "./exercises.ts";
import type { ChordOverrides } from "./exercises.ts";

export interface ChordPattern {
  readonly id: string;
  readonly name: string;
  readonly chords: ChordOverrides;
}

export const MAX_CHORD_PATTERNS = 30;
export const PATTERN_NAME_MAX = 40;

/** True for a usable list: unique ids, names that fit, chords that are on offer. */
export function validChordPatterns(v: unknown): v is readonly ChordPattern[] {
  if (!Array.isArray(v) || v.length > MAX_CHORD_PATTERNS) return false;
  const ids = new Set<string>();
  for (const p of v as unknown[]) {
    if (typeof p !== "object" || p === null) return false;
    const { id, name, chords } = p as Record<string, unknown>;
    if (typeof id !== "string" || id === "" || ids.has(id)) return false;
    ids.add(id);
    if (typeof name !== "string" || cleanName(name) !== name) return false;
    if (!validChordOverrides(chords)) return false;
  }
  return true;
}

/** A name as kept: spaces tidied, 1 to 40 characters; null if there is nothing usable. */
export function cleanName(name: string): string | null {
  const tidy = name.replace(/\s+/g, " ").trim();
  return tidy.length >= 1 && tidy.length <= PATTERN_NAME_MAX ? tidy : null;
}

/** The same chords, whatever order the measures were written in. */
export function sameChords(a: ChordOverrides, b: ChordOverrides): boolean {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
}

export type PatternResult =
  | { readonly ok: true; readonly patterns: readonly ChordPattern[] }
  | { readonly ok: false; readonly reason: string };

const NAME_PROBLEM = `Give it a name of 1 to ${PATTERN_NAME_MAX} letters.`;
const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Saves the chords under a new name. A name already in use, or a full list, is refused. */
export function addPattern(
  list: readonly ChordPattern[],
  name: string,
  chords: ChordOverrides,
  id: string,
): PatternResult {
  const n = cleanName(name);
  if (n === null) return { ok: false, reason: NAME_PROBLEM };
  if (list.some((p) => sameName(p.name, n))) {
    return { ok: false, reason: `There is already a pattern called "${n}".` };
  }
  if (list.length >= MAX_CHORD_PATTERNS) {
    return { ok: false, reason: `You can keep ${MAX_CHORD_PATTERNS} patterns; delete one first.` };
  }
  return { ok: true, patterns: [...list, { id, name: n, chords: { ...chords } }] };
}

export function renamePattern(
  list: readonly ChordPattern[],
  id: string,
  name: string,
): PatternResult {
  const n = cleanName(name);
  if (n === null) return { ok: false, reason: NAME_PROBLEM };
  if (list.some((p) => p.id !== id && sameName(p.name, n))) {
    return { ok: false, reason: `There is already a pattern called "${n}".` };
  }
  return { ok: true, patterns: list.map((p) => (p.id === id ? { ...p, name: n } : p)) };
}

/** Replaces a pattern's chords (the "Update" button). */
export function replacePatternChords(
  list: readonly ChordPattern[],
  id: string,
  chords: ChordOverrides,
): readonly ChordPattern[] {
  return list.map((p) => (p.id === id ? { ...p, chords: { ...chords } } : p));
}

export function removePattern(list: readonly ChordPattern[], id: string): readonly ChordPattern[] {
  return list.filter((p) => p.id !== id);
}

/** The chords of the changeable measures in order, e.g. "G C D G  G C G D  G Em C D". */
export function patternSummary(chords: ChordOverrides): string {
  let pos = OPEN_STRING_MEASURES;
  return EXERCISE_PROGRESSIONS.slice(1)
    .map((p) => p.chords.map((c) => chords[String(pos++)] ?? c).join(" "))
    .join("  ");
}

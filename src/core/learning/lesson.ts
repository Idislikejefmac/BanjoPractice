// C10 · The roll lesson diagram (LEARNING_SPEC.md F36, F37): what each of the eight slots shows
// at a fade level. Pure; the UI only draws these cells.

import type { RollTemplate } from "../banjo/rolls.ts";
import type { Finger, StringNo } from "../banjo/types.ts";
import { hiddenSlots } from "./fade.ts";
import type { FadeLevel } from "./fade.ts";

export interface LessonCell {
  /** 0-based slot; the screen shows slot + 1. */
  readonly slot: number;
  /** Which half of the measure (0 or 1): rolls are taught four notes at a time. */
  readonly half: 0 | 1;
  /** null when the finger is hidden at this level. */
  readonly finger: Finger | null;
  /** null when the string is hidden at this level. */
  readonly string: StringNo | null;
  readonly accent: boolean;
}

/** The cells for a roll at a fade level. `reveal` shows the whole answer (learner's choice). */
export function lessonCells(roll: RollTemplate, level: FadeLevel, reveal = false): LessonCell[] {
  const noFinger = new Set(reveal ? [] : hiddenSlots(level, "finger", roll.fingers.length));
  const noString = new Set(reveal ? [] : hiddenSlots(level, "string", roll.fingers.length));
  return roll.fingers.map((finger, slot) => ({
    slot,
    half: slot < 4 ? 0 : 1,
    finger: noFinger.has(slot) ? null : finger,
    string: noString.has(slot) ? null : (roll.exampleStrings[slot] as StringNo),
    accent: roll.accents.includes(slot),
  }));
}

export const FADE_LEVEL_NAME: Readonly<Record<FadeLevel, string>> = {
  1: "Everything shown",
  2: "Second half hidden",
  3: "Strings hidden",
  4: "All hidden",
};

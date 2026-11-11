// C10 · Short cues and roll queries (LEARNING_SPEC.md F41, F44), derived from the roll library.

import { STRINGS_FOR } from "../banjo/arranger.ts";
import { ROLLS } from "../banjo/rolls.ts";
import type { RollTemplate } from "../banjo/rolls.ts";
import type { Finger, StringNo } from "../banjo/types.ts";

const WORD: Readonly<Record<Finger, string>> = {
  T: "thumb",
  I: "index finger",
  M: "middle finger",
};

/** The fingers that land on a roll's accented slots, in order. */
export function accentFingers(roll: RollTemplate): Finger[] {
  return roll.accents.map((s) => roll.fingers[s] as Finger);
}

/** One line for the learner to listen for. Built from the roll, never typed per roll. */
export function listenCue(roll: RollTemplate): string {
  const fingers = accentFingers(roll);
  const first = fingers[0];
  if (first !== undefined && fingers.every((f) => f === first)) {
    return `Listen for the ${WORD[first]} on every strong beat.`;
  }
  return `Listen for the strong beats: ${fingers.map((f) => WORD[f]).join(", ")}.`;
}

/** A roll's two four-slot halves, as finger sequences (the unit taught first). */
export function rollHalves(roll: RollTemplate): [Finger[], Finger[]] {
  return [roll.fingers.slice(0, 4) as Finger[], roll.fingers.slice(4, 8) as Finger[]];
}

/** Rolls that put a legal finger on `string` at 0-based `slot` (C4 H4). */
export function rollsPlayingString(string: StringNo, slot: number): RollTemplate[] {
  return ROLLS.filter((roll) => {
    const finger = roll.fingers[slot];
    return finger !== undefined && STRINGS_FOR[finger].includes(string);
  });
}

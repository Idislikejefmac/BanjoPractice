// C6 · The picking hand the arranger writes for (style guide §3.1). Generated tabs are for a
// beginner by default: each finger keeps to its own lane of strings, so it never has to leave
// its place over the head to reach a far string at speed (a thumb going from the 5th string to
// the 2nd is the move teachers single out). "Experienced" allows the guide's "occasionally"
// strings too, but long jumps by one finger still cost.

import { ROLLS } from "./rolls.ts";
import type { RollTemplate } from "./rolls.ts";
import { FINGER_NAME } from "./types.ts";
import type { Finger, StringNo } from "./types.ts";

export type PlayerLevel = "beginner" | "experienced";

export const DEFAULT_PLAYER_LEVEL: PlayerLevel = "beginner";

export interface HandProfile {
  readonly level: PlayerLevel;
  /** The strings each finger may pick, home string first (the order breaks ties for fillers). */
  readonly strings: Readonly<Record<Finger, readonly StringNo[]>>;
  /**
   * How many strings a finger moves between two of its own picks without effort. Further than
   * this costs ArrangeWeights.fingerTravel per extra string. 2 for the thumb is the 3rd-to-5th
   * move every beginner roll already has (forward-reverse 3 2 1 5, alternating thumb 3 2 5 1).
   */
  readonly easyTravel: Readonly<Record<Finger, number>>;
  /**
   * Rolls the arranger leaves out unless the song's roll list names them. For a beginner: the
   * Foggy Mountain roll, which exists to put the thumb on the 2nd string (the hard move), and
   * the index-leading roll, our own pattern that no teacher of his teaches.
   */
  readonly excludedRolls: readonly string[];
  /**
   * Changes to the arranger's weights. A beginner gains more from staying on one roll than
   * from splicing half of one roll onto half of another.
   */
  readonly weights: Readonly<{ sameRollAsBefore?: number; halfRolls?: number }>;
}

export const HAND_PROFILES: Readonly<Record<PlayerLevel, HandProfile>> = {
  beginner: {
    level: "beginner",
    // Guide §3.1: thumb 5, 4, 3; index 2 and 3; middle on the 1st string only.
    strings: { T: [5, 3, 4], I: [2, 3], M: [1] },
    easyTravel: { T: 2, I: 1, M: 0 },
    excludedRolls: ["foggy-mountain", "index-leading"],
    weights: { sameRollAsBefore: -1, halfRolls: 0 },
  },
  experienced: {
    level: "experienced",
    // Guide §3: the "usual" and "occasionally" columns (the same as C4 H4).
    strings: { T: [5, 3, 4, 2], I: [2, 3, 4], M: [1, 2] },
    easyTravel: { T: 2, I: 1, M: 1 },
    excludedRolls: [],
    weights: {},
  },
};

export function handProfile(level: PlayerLevel | undefined): HandProfile {
  return HAND_PROFILES[level ?? DEFAULT_PLAYER_LEVEL];
}

/** The rolls a song's tab uses when its roll list hasn't been narrowed (null in the prefs). */
export function defaultRollIds(level?: PlayerLevel): string[] {
  const out = handProfile(level).excludedRolls;
  return ROLLS.map((r) => r.id).filter((id) => !out.includes(id));
}

/** Strings beyond the easy distance that a finger moves from `from` to `to` (0 if easy). */
export function extraTravel(
  profile: HandProfile,
  finger: Finger,
  from: StringNo | null | undefined,
  to: StringNo,
): number {
  if (from === null || from === undefined) return 0;
  return Math.max(0, Math.abs(from - to) - profile.easyTravel[finger]);
}

const ORDINAL: Readonly<Record<StringNo, string>> = {
  1: "1st",
  2: "2nd",
  3: "3rd",
  4: "4th",
  5: "5th",
};

/**
 * A roll whose own pattern takes a finger outside a beginner's lanes is still taught as its
 * sources play it (the Foggy Mountain roll's thumb on the 2nd string is Earl's), but it is called
 * out as advanced wherever it is shown. Null when every note of the roll is in a beginner's lanes.
 */
export function advancedNote(roll: RollTemplate): string | null {
  const lanes = HAND_PROFILES.beginner.strings;
  const seen = new Set<string>();
  const reaches: string[] = [];
  roll.fingers.forEach((f, i) => {
    const s = roll.exampleStrings[i];
    if (s === undefined || lanes[f].includes(s) || seen.has(`${f}${s}`)) return;
    seen.add(`${f}${s}`);
    reaches.push(`the ${FINGER_NAME[f].toLowerCase()} plays the ${ORDINAL[s]} string`);
  });
  if (reaches.length === 0) return null;
  const what = reaches.join(" and ");
  return `Advanced: ${what}. Tabs written for a beginner leave it out unless you choose it.`;
}

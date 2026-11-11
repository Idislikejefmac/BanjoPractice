// C10 · Spaced review of rules (LEARNING_SPEC.md F40). Pure: the caller passes the time in.
//
// Older adults gain from spaced retrieval but not from asking again straight away (spec E7), so
// a missed item comes back soon, never inside MIN_GAP_MS.

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** Gap before an item at each box is asked again. Box 0 is "just missed". */
export const BOX_INTERVALS_MS: readonly number[] = [
  10 * MINUTE,
  1 * DAY,
  2 * DAY,
  4 * DAY,
  8 * DAY,
  16 * DAY,
];
export const MAX_BOX = BOX_INTERVALS_MS.length - 1;
/** No item is asked twice inside this gap, however it was answered. */
export const MIN_GAP_MS = 10 * MINUTE;
/** An item due further ahead than this means the clock went backwards: treat it as due. */
const MAX_AHEAD_MS = (BOX_INTERVALS_MS[MAX_BOX] as number) + DAY;
export const MAX_QUESTIONS = 5;

export interface ReviewItem {
  readonly id: string;
  readonly box: number;
  /** Epoch ms when it is next due. */
  readonly dueAt: number;
  /** Epoch ms of the last answer; 0 if never answered. */
  readonly answeredAt: number;
}

export function newItem(id: string): ReviewItem {
  return { id, box: 0, dueAt: 0, answeredAt: 0 };
}

export function answer(item: ReviewItem, correct: boolean, now: number): ReviewItem {
  const box = correct ? Math.min(item.box + 1, MAX_BOX) : 0;
  return { id: item.id, box, dueAt: now + (BOX_INTERVALS_MS[box] as number), answeredAt: now };
}

function isDue(item: ReviewItem, now: number): boolean {
  // A clock that jumped backwards or forwards must not hide or flood the quiz.
  if (item.answeredAt > now) return true;
  if (item.dueAt - now > MAX_AHEAD_MS) return true;
  if (item.answeredAt !== 0 && now - item.answeredAt < MIN_GAP_MS) return false;
  return item.dueAt <= now;
}

/** Up to `limit` items to ask now, most overdue first. Never-seen items come last. */
export function dueItems(
  items: readonly ReviewItem[],
  now: number,
  limit = MAX_QUESTIONS,
): ReviewItem[] {
  return items
    .filter((i) => isDue(i, now))
    .sort((a, b) => {
      const an = a.answeredAt === 0 ? 1 : 0;
      const bn = b.answeredAt === 0 ? 1 : 0;
      return an - bn || a.dueAt - b.dueAt || a.id.localeCompare(b.id);
    })
    .slice(0, Math.max(0, limit));
}

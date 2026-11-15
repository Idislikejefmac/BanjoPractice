// F47 · Lessons: what two first-tier instructors (Jens Kruger, Tony Trischka) teach, restated in
// short plain words with a link to each video. Foundations come first; nuance, variation and style
// are a second layer. Pure data and queries: no DOM, storage or UI. The text is our own wording
// (DEVELOPMENT.md §10: never copy from recordings); the longer private notes and the caption
// transcripts they came from stay in `sheet-music/` and are never committed.

import { LESSONS } from "./lessonData.ts";

export type InstructorId = "jens-kruger" | "tony-trischka";

export const INSTRUCTORS: Readonly<
  Record<InstructorId, { readonly name: string; readonly blurb: string }>
> = {
  "jens-kruger": {
    name: "Jens Kruger",
    blurb: "Beginner lessons, a method clip and Deering masterclasses.",
  },
  "tony-trischka": {
    name: "Tony Trischka",
    blurb: "ArtistWorks lessons and short tips.",
  },
};

export type TopicGroup =
  "Rolls" | "Technique" | "Chords" | "Melody" | "Theory" | "Practice" | "Players and gear";

export const TOPICS = {
  "roll-forward": { name: "Forward roll", group: "Rolls" },
  "roll-backward": { name: "Backward roll", group: "Rolls" },
  "roll-forward-backward": { name: "Forward-backward roll", group: "Rolls" },
  "roll-alternating-thumb": { name: "Alternating thumb roll", group: "Rolls" },
  "roll-foggy-mountain": { name: "Foggy Mountain roll", group: "Rolls" },
  "roll-osborne": { name: "Osborne roll", group: "Rolls" },
  "roll-other": { name: "Other rolls and patterns", group: "Rolls" },
  "roll-variation": { name: "Roll variations", group: "Rolls" },
  slide: { name: "Slides", group: "Technique" },
  "hammer-pull": { name: "Hammer-ons and pull-offs", group: "Technique" },
  "pick-hand": { name: "Picking hand", group: "Technique" },
  "fretting-hand": { name: "Fretting hand", group: "Technique" },
  "speed-clean": { name: "Speed and clean playing", group: "Technique" },
  triplets: { name: "Triplets", group: "Technique" },
  "travis-picking": { name: "Travis picking", group: "Technique" },
  sixths: { name: "Sixths", group: "Technique" },
  "chords-basic": { name: "Basic chords", group: "Chords" },
  "chords-diatonic": { name: "Chords of a key", group: "Chords" },
  "chords-barre": { name: "Barre chords and up the neck", group: "Chords" },
  "chords-changes": { name: "Changing chords", group: "Chords" },
  "melody-on-roll": { name: "Melody on a roll", group: "Melody" },
  "melody-melodic-style": { name: "Melodic style", group: "Melody" },
  "melody-single-string": { name: "Single-string style", group: "Melody" },
  "endings-licks": { name: "Licks and endings", group: "Melody" },
  scales: { name: "Scales and arpeggios", group: "Theory" },
  "keys-positions": { name: "Keys and positions", group: "Theory" },
  "rhythm-timing": { name: "Rhythm and timing", group: "Theory" },
  improvising: { name: "Improvising", group: "Theory" },
  tablature: { name: "Reading tablature", group: "Theory" },
  "practice-approach": { name: "How to practise", group: "Practice" },
  "singing-along": { name: "Singing along", group: "Practice" },
  "history-players": { name: "Players and recordings", group: "Players and gear" },
  "gear-picks": { name: "Picks and setup", group: "Players and gear" },
  "posture-position": { name: "Posture and hand position", group: "Players and gear" },
} as const satisfies Record<string, { name: string; group: TopicGroup }>;

export type TopicId = keyof typeof TOPICS;
export const TOPIC_IDS = Object.keys(TOPICS) as TopicId[];

/**
 * How much of the lesson the captions carried, which says how much a reader still has to get from
 * the video. "full": the teaching is mostly spoken. "partial": the main idea is spoken but key
 * notes, fingerings or shapes are only played. "thin": little is spoken; this lesson needs more
 * information (watching the video, or a written source) before it teaches much.
 */
export type Completeness = "full" | "partial" | "thin";

export interface Lesson {
  /** Stable, unique: "tony-essential-banjo-rolls". */
  readonly id: string;
  readonly instructor: InstructorId;
  /** Our own short title. */
  readonly title: string;
  /** Position in the instructor's series (a beginner lesson number, or the order listed). */
  readonly order: number;
  readonly video: {
    /** The 11-character YouTube id. */
    readonly id: string;
    /** The video's published title, for the link text. */
    readonly title: string;
    /** Start the video here (long videos are split into lessons). */
    readonly startSeconds?: number;
  };
  readonly topics: readonly TopicId[];
  /** Roll ids (src/core/banjo/rolls.ts) this lesson states, so the roll lesson can link to it. */
  readonly rolls?: readonly string[];
  /** The basics, in a sensible order to learn them. Short sentences in our own words. */
  readonly foundations: readonly string[];
  /** Variations, style, advice and context: the second layer. */
  readonly nuance: readonly string[];
  /** What only the video shows (notes played, shapes, hand position). One or two sentences. */
  readonly watch: string;
  readonly completeness: Completeness;
}

export const MAX_POINT_CHARS = 260;
export const MAX_FOUNDATIONS = 8;
export const MAX_NUANCE = 8;

/** The link to a lesson's video. */
export function lessonUrl(lesson: Pick<Lesson, "video">): string {
  const t = lesson.video.startSeconds;
  return `https://www.youtube.com/watch?v=${lesson.video.id}${t ? `&t=${t}s` : ""}`;
}

/** What is wrong with a lesson, as plain sentences; an empty list means it is usable. */
export function lessonProblems(l: Lesson, knownRollIds: readonly string[] = []): string[] {
  const p: string[] = [];
  const text = (s: unknown, what: string, max = MAX_POINT_CHARS) => {
    if (typeof s !== "string" || s.trim() === "") p.push(`${what} is empty`);
    else if (s.length > max) p.push(`${what} is over ${max} characters`);
    else if (s !== s.trim() || /\s{2,}/.test(s)) p.push(`${what} has untidy spaces`);
  };
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(l.id))
    p.push("id must be lower-case words joined by hyphens");
  if (l.instructor !== "jens-kruger" && l.instructor !== "tony-trischka")
    p.push("unknown instructor");
  text(l.title, "title", 80);
  if (!Number.isInteger(l.order) || l.order < 1) p.push("order must be a whole number from 1");
  if (!/^[A-Za-z0-9_-]{11}$/.test(l.video.id)) p.push("video id must be 11 characters");
  text(l.video.title, "video title", 200);
  if (
    l.video.startSeconds !== undefined &&
    (!Number.isInteger(l.video.startSeconds) || l.video.startSeconds < 0)
  ) {
    p.push("startSeconds must be a whole number of seconds");
  }
  if (l.topics.length < 1 || l.topics.length > 6) p.push("needs 1 to 6 topics");
  for (const t of l.topics) if (!(t in TOPICS)) p.push(`unknown topic "${t}"`);
  if (new Set(l.topics).size !== l.topics.length) p.push("a topic is listed twice");
  if (l.foundations.length < 1 || l.foundations.length > MAX_FOUNDATIONS) {
    p.push(`needs 1 to ${MAX_FOUNDATIONS} foundation points`);
  }
  if (l.nuance.length > MAX_NUANCE) p.push(`at most ${MAX_NUANCE} nuance points`);
  l.foundations.forEach((x, i) => text(x, `foundation ${i + 1}`));
  l.nuance.forEach((x, i) => text(x, `nuance ${i + 1}`));
  text(l.watch, "watch note", 320);
  if (!["full", "partial", "thin"].includes(l.completeness)) p.push("unknown completeness");
  for (const r of l.rolls ?? []) if (!knownRollIds.includes(r)) p.push(`unknown roll "${r}"`);
  return p;
}

export { LESSONS };

export const lessonById = (id: string): Lesson | undefined => LESSONS.find((l) => l.id === id);

/** An instructor's lessons in series order. */
export function lessonsFor(instructor: InstructorId): Lesson[] {
  return LESSONS.filter((l) => l.instructor === instructor).sort((a, b) => a.order - b.order);
}

/** The topics that have at least one lesson, grouped, in a stable order. */
export function topicsInUse(): { group: TopicGroup; topics: TopicId[] }[] {
  const used = new Set(LESSONS.flatMap((l) => l.topics));
  const groups = new Map<TopicGroup, TopicId[]>();
  for (const id of TOPIC_IDS) {
    if (!used.has(id)) continue;
    const g = TOPICS[id].group;
    groups.set(g, [...(groups.get(g) ?? []), id]);
  }
  return [...groups].map(([group, topics]) => ({ group, topics }));
}

/** Lessons on a topic, one instructor's after the other. */
export function lessonsOnTopic(topic: TopicId): Lesson[] {
  return LESSONS.filter((l) => l.topics.includes(topic)).sort(
    (a, b) => a.instructor.localeCompare(b.instructor) || a.order - b.order,
  );
}

/** True when both instructors have a lesson on the topic. */
export function bothCover(topic: TopicId): boolean {
  return new Set(lessonsOnTopic(topic).map((l) => l.instructor)).size > 1;
}

/**
 * Other lessons that share a topic, the other instructor's first, then the most topics in common.
 * (Not the same lesson, and never more than `limit`.)
 */
export function relatedLessons(lesson: Lesson, limit = 4): Lesson[] {
  const mine = new Set(lesson.topics);
  return LESSONS.filter((o) => o.id !== lesson.id && o.topics.some((t) => mine.has(t)))
    .map((o) => ({ o, shared: o.topics.filter((t) => mine.has(t)).length }))
    .sort(
      (a, b) =>
        Number(b.o.instructor !== lesson.instructor) -
          Number(a.o.instructor !== lesson.instructor) ||
        b.shared - a.shared ||
        a.o.order - b.o.order,
    )
    .slice(0, limit)
    .map((x) => x.o);
}

/** Lessons that state a given roll. */
export function lessonsOnRoll(rollId: string): Lesson[] {
  return LESSONS.filter((l) => l.rolls?.includes(rollId)).sort(
    (a, b) => a.instructor.localeCompare(b.instructor) || a.order - b.order,
  );
}

export const NEEDS_MORE: readonly Completeness[] = ["partial", "thin"];
export const needsMore = (l: Lesson): boolean => l.completeness !== "full";

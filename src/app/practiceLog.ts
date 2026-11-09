// F21 practice log (DEVELOPMENT.md F21). Pure: playback events in, session records out.
//
// A session = a song open with playback, ending after 10 minutes without playback (or on a
// different song). Each records the local date (so a timezone change can't split or merge
// sessions wrongly), minutes practiced, sections looped, and the start and highest tempo.
// Durations are measured on the monotonic clock, never wall-clock differences, so a clock
// jump can't make them negative (CHAOS_TESTING.md §6.4).

export const SESSION_GAP_MS = 10 * 60_000;

export interface PracticeSession {
  readonly schemaVersion: number;
  readonly id: string;
  readonly songId: string;
  /** Local calendar date, YYYY-MM-DD. */
  readonly date: string;
  readonly startedAt: string;
  /** Minutes of playback (sum of play spans, not wall time). */
  readonly minutes: number;
  readonly startTempo: number;
  readonly highestTempo: number;
  /** Sections looped, e.g. "5–8" or "A part". */
  readonly loops: readonly string[];
}

export function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Live session state kept by the app while Dad practices. */
export interface OpenSession {
  readonly session: PracticeSession;
  /** Monotonic ms of the last playback activity. */
  readonly lastActive: number;
  /** Monotonic ms the current play span started, or null when stopped. */
  readonly playingSince: number | null;
  readonly playedMs: number;
}

export type LogEvent =
  | {
      readonly kind: "play";
      readonly songId: string;
      readonly tempo: number;
      readonly loop: string | null;
    }
  | { readonly kind: "tempo"; readonly tempo: number }
  | { readonly kind: "stop" };

/**
 * Applies one event. Returns the (possibly new) open session, and a finished session to save
 * when a new one starts.
 */
export function applyLogEvent(
  open: OpenSession | null,
  event: LogEvent,
  monotonicMs: number,
  wall: Date,
  newId: () => string,
): { open: OpenSession | null; finished: PracticeSession | null } {
  let finished: PracticeSession | null = null;
  let cur = open;
  if (event.kind === "play") {
    const stale =
      cur && (cur.session.songId !== event.songId || monotonicMs - cur.lastActive > SESSION_GAP_MS);
    if (cur && stale) {
      finished = close(cur, monotonicMs);
      cur = null;
    }
    if (!cur) {
      cur = {
        session: {
          schemaVersion: 1,
          id: newId(),
          songId: event.songId,
          date: localDate(wall),
          startedAt: wall.toISOString(),
          minutes: 0,
          startTempo: event.tempo,
          highestTempo: event.tempo,
          loops: [],
        },
        lastActive: monotonicMs,
        playingSince: null,
        playedMs: 0,
      };
    }
    const loops =
      event.loop && !cur.session.loops.includes(event.loop)
        ? [...cur.session.loops, event.loop]
        : cur.session.loops;
    cur = {
      ...cur,
      session: {
        ...cur.session,
        highestTempo: Math.max(cur.session.highestTempo, event.tempo),
        loops,
      },
      playingSince: cur.playingSince ?? monotonicMs,
      lastActive: monotonicMs,
    };
  } else if (cur && event.kind === "tempo") {
    cur = {
      ...cur,
      session: { ...cur.session, highestTempo: Math.max(cur.session.highestTempo, event.tempo) },
      lastActive: monotonicMs,
    };
  } else if (cur && event.kind === "stop" && cur.playingSince !== null) {
    const span = Math.max(0, monotonicMs - cur.playingSince);
    cur = { ...cur, playedMs: cur.playedMs + span, playingSince: null, lastActive: monotonicMs };
    cur = {
      ...cur,
      session: { ...cur.session, minutes: Math.round((cur.playedMs / 60_000) * 10) / 10 },
    };
  }
  return { open: cur, finished };
}

/** The session as it stands (used to save it on stop and on pagehide). */
export function close(open: OpenSession, monotonicMs: number): PracticeSession {
  const span = open.playingSince !== null ? Math.max(0, monotonicMs - open.playingSince) : 0;
  const ms = open.playedMs + span;
  return { ...open.session, minutes: Math.round((ms / 60_000) * 10) / 10 };
}

export function practiceSessionProblems(v: unknown): string[] {
  if (typeof v !== "object" || v === null) return ["not an object"];
  const s = v as Record<string, unknown>;
  const p: string[] = [];
  if (typeof s.id !== "string") p.push("id");
  if (typeof s.songId !== "string") p.push("songId");
  if (typeof s.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s.date)) p.push("date");
  if (typeof s.minutes !== "number" || s.minutes < 0) p.push("minutes");
  if (typeof s.startTempo !== "number" || typeof s.highestTempo !== "number") p.push("tempo");
  if (!Array.isArray(s.loops)) p.push("loops");
  return p;
}

// F18 · Export / import (DEVELOPMENT.md F18, §8.1). Pure: no DOM or storage.
//
// Export: one versioned JSON file with Dad's songs, settings, song preferences (favorites,
// practice state) and practice log. Recordings are not included (too big; said on screen).
// Import: parse, validate and migrate everything *before* any storage transaction, preview
// what will happen, then write all-or-nothing, with replaced records copied to trash first.

import type { Song } from "../core/song/song.ts";
import { songProblems } from "../core/song/song.ts";
import type { Settings, SongPrefs } from "./model.ts";
import { readSettings, settingsProblems, songPrefsProblems } from "./model.ts";

export const BACKUP_FORMAT = "banjo-practice-backup";
export const BACKUP_VERSION = 1;

export interface Backup {
  readonly format: typeof BACKUP_FORMAT;
  readonly version: number;
  readonly exportedAt: string;
  readonly appVersion: string;
  readonly songs: readonly Song[];
  readonly songPrefs: readonly SongPrefs[];
  readonly settings: Settings | null;
  readonly practiceLog: readonly unknown[];
}

export function makeBackup(input: {
  appVersion: string;
  songs: readonly Song[];
  songPrefs: readonly SongPrefs[];
  settings: Settings;
  practiceLog: readonly unknown[];
  now?: Date;
}): Backup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: (input.now ?? new Date()).toISOString(),
    appVersion: input.appVersion,
    songs: input.songs.filter((s) => s.source === "user"),
    songPrefs: input.songPrefs,
    settings: input.settings,
    practiceLog: input.practiceLog,
  };
}

export function backupFileName(now = new Date()): string {
  const d = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return `banjo-backup-${d}.json`;
}

export type ParseResult =
  | { readonly ok: true; readonly backup: Backup; readonly skipped: readonly string[] }
  | { readonly ok: false; readonly error: string };

/**
 * Reads a backup file. Never throws. Individual bad records are skipped (and listed), so one
 * damaged song can't block restoring the rest; a file that isn't a backup at all is refused.
 */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "This file isn't a Banjo Practice backup (it couldn't be read)." };
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: "This file isn't a Banjo Practice backup." };
  }
  const r = raw as Record<string, unknown>;
  if (r.format !== BACKUP_FORMAT) {
    return { ok: false, error: "This file isn't a Banjo Practice backup." };
  }
  if (typeof r.version !== "number" || r.version > BACKUP_VERSION) {
    return {
      ok: false,
      error: "This backup was made by a newer version of the app. Please update the app first.",
    };
  }
  // Migrations from older versions go here (none yet: version 1 is the first).
  const skipped: string[] = [];
  const songs: Song[] = [];
  const seen = new Set<string>();
  for (const s of Array.isArray(r.songs) ? r.songs : []) {
    const problems = songProblems(s);
    const title =
      typeof (s as { title?: unknown })?.title === "string" ? (s as Song).title : "a song";
    if (problems.length > 0) {
      skipped.push(`${title} (damaged)`);
      continue;
    }
    const song = { ...(s as Song), source: "user" as const };
    if (seen.has(song.id)) continue;
    seen.add(song.id);
    songs.push(song);
  }
  const songPrefs: SongPrefs[] = [];
  for (const p of Array.isArray(r.songPrefs) ? r.songPrefs : []) {
    if (songPrefsProblems(p).length === 0) songPrefs.push(p as SongPrefs);
  }
  const settings =
    settingsProblems(r.settings).length === 0
      ? (r.settings as Settings)
      : r.settings
        ? readSettings(r.settings)
        : null;
  return {
    ok: true,
    skipped,
    backup: {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: typeof r.exportedAt === "string" ? r.exportedAt : "",
      appVersion: typeof r.appVersion === "string" ? r.appVersion : "",
      songs,
      songPrefs,
      settings,
      practiceLog: Array.isArray(r.practiceLog) ? r.practiceLog : [],
    },
  };
}

export interface ImportPreview {
  readonly newSongs: readonly Song[];
  /** Same id, different content: Dad chooses keep both / replace / skip. */
  readonly conflicts: readonly { readonly incoming: Song; readonly existing: Song }[];
  /** Already here, unchanged. */
  readonly identical: number;
}

const same = (a: Song, b: Song) =>
  a.abc === b.abc &&
  a.title === b.title &&
  JSON.stringify(a.overrides ?? {}) === JSON.stringify(b.overrides ?? {});

export function previewImport(backup: Backup, existing: ReadonlyMap<string, Song>): ImportPreview {
  const newSongs: Song[] = [];
  const conflicts: { incoming: Song; existing: Song }[] = [];
  let identical = 0;
  for (const s of backup.songs) {
    const e = existing.get(s.id);
    if (!e) newSongs.push(s);
    else if (same(e, s)) identical++;
    else conflicts.push({ incoming: s, existing: e });
  }
  return { newSongs, conflicts, identical };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ConflictChoice = "keep-both" | "replace" | "skip";

export type WriteOp =
  | {
      readonly op: "put";
      readonly store: "songs" | "songPrefs" | "settings" | "trash" | "meta";
      readonly key: string;
      readonly value: unknown;
    }
  | { readonly op: "delete"; readonly store: "songs"; readonly key: string };

/**
 * The storage writes for an import, prepared in full before the transaction (P1 rule: never
 * await non-IDB work inside one). Replaced songs go to trash first.
 */
export function importOps(
  backup: Backup,
  preview: ImportPreview,
  choice: ConflictChoice,
  opts: { now?: Date; newId: () => string; importSettings: boolean },
): WriteOp[] {
  const now = (opts.now ?? new Date()).toISOString();
  const ops: WriteOp[] = [];
  for (const s of preview.newSongs)
    ops.push({ op: "put", store: "songs", key: s.id, value: { ...s, updatedAt: now } });
  for (const { incoming, existing } of preview.conflicts) {
    if (choice === "skip") continue;
    if (choice === "replace") {
      ops.push({
        op: "put",
        store: "trash",
        key: `${now}:${existing.id}`,
        value: { deletedAt: now, reason: "replaced by import", store: "songs", record: existing },
      });
      ops.push({
        op: "put",
        store: "songs",
        key: incoming.id,
        value: { ...incoming, updatedAt: now },
      });
    } else {
      const id = opts.newId();
      ops.push({
        op: "put",
        store: "songs",
        key: id,
        value: { ...incoming, id, title: `${incoming.title} (imported)`, updatedAt: now },
      });
    }
  }
  const imported = new Set(ops.filter((o) => o.store === "songs").map((o) => o.key));
  for (const p of backup.songPrefs) {
    // Prefs for songs this import brings in, and for built-ins (favorites, practice state).
    if (imported.has(p.songId) || !UUID.test(p.songId)) {
      ops.push({ op: "put", store: "songPrefs", key: p.songId, value: p });
    }
  }
  if (opts.importSettings && backup.settings) {
    ops.push({ op: "put", store: "settings", key: "settings", value: backup.settings });
  }
  return ops;
}

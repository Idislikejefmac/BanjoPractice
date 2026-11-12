// App state (DEVELOPMENT.md §2.2, §5.2, §8.1) as Preact signals, persisted through P1.
//
// - Settings, per-song prefs (favorite, last opened, view) and the session are stored in
//   IndexedDB. The session is also mirrored to localStorage on every change, synchronously,
//   so an iPadOS reload right after a change still restores it (F35).
// - Session writes to IndexedDB are debounced (500 ms) and flushed on pagehide.
// - A failed save is never silent: it shows a notice and is retried (CHAOS_TESTING.md I6).

import { batch, computed, signal } from "@preact/signals";
import type { Song } from "../core/song/song.ts";
import { songProblems } from "../core/song/song.ts";
import type { Rating } from "../core/learning/fade.ts";
import type { LearningProgress } from "../core/learning/progress.ts";
import { EMPTY_PROGRESS, rateRoll, readProgress, resetRoll } from "../core/learning/progress.ts";
import type { LogEvent, OpenSession, PracticeSession } from "./practiceLog.ts";
import { applyLogEvent, close as closeSession, practiceSessionProblems } from "./practiceLog.ts";
import type { KeyValueStore, StoreName } from "../platform/types.ts";
import { rollExercise } from "../core/banjo/exercises.ts";
import type { Services } from "./services.ts";
import type { PracticePrefs, Session, Settings, SongPrefs, ViewMode } from "./model.ts";
import {
  DEFAULT_PRACTICE,
  DEFAULT_SESSION,
  DEFAULT_SETTINGS,
  MODEL_SCHEMA_VERSION,
  readSession,
  readSettings,
  readSongPrefs,
  readPractice,
  recentSongIds,
  SOUND_KEYS,
  STORE_VALIDATORS,
} from "./model.ts";

const SESSION_MIRROR_KEY = "banjo.session";
/** Write-ahead copy of saves not yet confirmed by IndexedDB (survives a kill mid-save). */
const PENDING_KEY = "banjo.pendingWrites";
/** Key of the learning-progress document in the meta store (apart from the "meta" document). */
export const LEARNING_KEY = "learning";
export type PracticePanel = "none" | "tempo" | "parts" | "loop" | "rolls";
const SESSION_DEBOUNCE_MS = 500;
const RETRY_MS = 3000;

export interface Notice {
  readonly id: number;
  readonly kind: "error" | "info";
  readonly text: string;
}

type PendingWrite = { store: StoreName; key: string; value: unknown };

export class AppStore {
  /** Built-in songs and exercises, then Dad's own songs (F2, F17). */
  readonly songList = signal<readonly Song[]>([]);
  private readonly builtins: readonly Song[];
  /** F18: when Dad last exported a backup (ISO), for "Last backup: N days ago". */
  readonly lastBackupAt = signal<string | null>(null);
  /** F37: how far Dad has taken each roll lesson (one document in the meta store). */
  readonly learning = signal<LearningProgress>(EMPTY_PROGRESS);
  /** F21: saved practice sessions, newest first. */
  readonly practiceLog = signal<readonly PracticeSession[]>([]);
  /** Which practice tool is open (F19, F21, F23), or null. */
  readonly practiceTools = signal<"tuner" | "log" | "recordings" | null>(null);
  private openSession: OpenSession | null = null;
  /** F17: the song editor is open on this song id ("new" for a new song), or null. */
  readonly editing = signal<string | null>(null);

  get songs(): readonly Song[] {
    return this.songList.value;
  }
  readonly settings = signal<Settings>(DEFAULT_SETTINGS);
  readonly prefs = signal<ReadonlyMap<string, SongPrefs>>(new Map());
  readonly session = signal<Session>(DEFAULT_SESSION);
  readonly settingsOpen = signal(false);
  /** Which playback panel is open under the toolbar (tempo, rolls, loop, more playback). */
  readonly practicePanel = signal<PracticePanel>("none");
  /** F16 chord finder: open with this chord symbol, or null when closed. */
  readonly chordFinder = signal<string | null>(null);
  readonly notices = signal<readonly Notice[]>([]);
  /** Bumped when the user picks a song, so the view scrolls to its top. */
  readonly openNonce = signal(0);

  readonly currentSong = computed(() => {
    const song = this.songs.find((s) => s.id === this.session.value.songId) ?? null;
    // A roll exercise is rebuilt with the chords he chose for its "Your chords" part.
    if (song?.id.startsWith("exercise:")) {
      const chords = this.settings.value.exerciseChords;
      const key = `${song.id}|${JSON.stringify(chords)}`;
      if (this.exerciseCache?.key !== key) {
        const built = rollExercise(song.id.slice("exercise:".length), chords);
        this.exerciseCache = { key, song: built ?? song };
      }
      return this.exerciseCache.song;
    }
    return song;
  });
  private exerciseCache: { key: string; song: Song } | null = null;
  readonly view = computed<ViewMode>(() => {
    const id = this.session.value.songId;
    return (id ? this.prefs.value.get(id)?.view : undefined) ?? this.settings.value.defaultView;
  });
  /** Practice state for the open song (tempo, key, parts, loop…). */
  readonly practice = computed<PracticePrefs>(() => {
    const id = this.session.value.songId;
    const p = id ? this.prefs.value.get(id)?.practice : undefined;
    const s = this.settings.value;
    // The mix (parts on/off and volumes, count-in mode, click volume) is a preference that
    // follows him from song to song, so it always comes from settings, never from the song.
    return {
      ...(p ? readPractice(p) : DEFAULT_PRACTICE),
      parts: s.parts,
      metronome: s.metronome,
      clickVolume: s.clickVolume,
    };
  });
  readonly favorites = computed(() =>
    this.songs.filter((s) => this.prefs.value.get(s.id)?.favorite),
  );
  readonly recent = computed(() =>
    recentSongIds([...this.prefs.value.values()])
      .map((id) => this.songs.find((s) => s.id === id))
      .filter((s): s is Song => s !== undefined),
  );

  private nextNoticeId = 1;
  private sessionTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * Saves not yet confirmed, newest value per record. One write per record is in flight at a
   * time, and only the newest value is written, so a slow or retried save can never land
   * after a newer one (last write wins).
   */
  private pending = new Map<string, PendingWrite>();
  private writing = new Set<string>();
  private failing = new Set<string>();

  private readonly services: Services;
  private readonly local: Pick<Storage, "getItem" | "setItem"> | null;

  constructor(
    services: Services,
    songs: readonly Song[],
    local: Pick<Storage, "getItem" | "setItem"> | null,
  ) {
    this.services = services;
    this.builtins = songs;
    this.songList.value = songs;
    this.local = local;
  }

  private get storage(): KeyValueStore {
    return this.services.storage;
  }

  /** Reads everything saved. Corrupt or missing records fall back to defaults. */
  async load(): Promise<void> {
    let settings = DEFAULT_SETTINGS;
    const prefs = new Map<string, SongPrefs>();
    let session: Session | null = null;
    let learning = EMPTY_PROGRESS;
    const userSongs = new Map<string, Song>();
    try {
      for (const key of await this.storage.keys("songs")) {
        const s = await this.storage.get<Song>("songs", key);
        if (songProblems(s).length === 0) userSongs.set(s!.id, { ...s!, source: "user" });
        else
          this.services.diagnostics.log(
            "error",
            `A saved song couldn't be read and was set aside (${key})`,
          );
      }
      const log: PracticeSession[] = [];
      for (const key of await this.storage.keys("practiceLog")) {
        const s = await this.storage.get<PracticeSession>("practiceLog", key);
        if (practiceSessionProblems(s).length === 0) log.push(s!);
      }
      this.practiceLog.value = log.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
      const meta = await this.storage.get<{ lastBackupAt?: string }>("meta", "meta");
      if (meta?.lastBackupAt) this.lastBackupAt.value = meta.lastBackupAt;
      learning = readProgress(await this.storage.get("meta", LEARNING_KEY));
      settings = readSettings(await this.storage.get("settings", "settings"));
      for (const key of await this.storage.keys("songPrefs")) {
        const p = readSongPrefs(await this.storage.get("songPrefs", key));
        if (p) prefs.set(p.songId, p);
        else this.services.diagnostics.log("warning", `Ignored a damaged song preference (${key})`);
      }
      session = readSession(await this.storage.get("session", "session"));
    } catch (e) {
      this.reportError("Couldn't read your saved settings", e);
    }
    // Saves that hadn't reached IndexedDB when the app was last closed or killed.
    const unsaved = this.readPending();
    for (const w of unsaved) {
      if (w.store === "settings") settings = readSettings(w.value);
      if (w.store === "songPrefs") {
        const p = readSongPrefs(w.value);
        if (p) prefs.set(p.songId, p);
      }
      if (w.store === "songs") userSongs.set((w.value as Song).id, w.value as Song);
      if (w.store === "meta" && w.key === LEARNING_KEY) learning = readProgress(w.value);
    }
    this.songList.value = [
      ...this.builtins,
      ...[...userSongs.values()].sort((a, b) => a.title.localeCompare(b.title)),
    ];
    // The localStorage mirror is newer if a reload happened before the debounced write.
    const mirrored = this.readMirror();
    // On a tie (the same millisecond) the mirror wins: it is written on every change, while the
    // stored copy lags behind it.
    const mirrorIsNewer = mirrored !== null && (!session || mirrored.savedAt >= session.savedAt);
    if (mirrored && mirrorIsNewer) session = mirrored;
    if (session?.songId && !this.songs.some((s) => s.id === session!.songId)) {
      session = { ...session, songId: null, topMeasure: 0 };
    }
    batch(() => {
      this.settings.value = settings;
      this.prefs.value = prefs;
      this.session.value = session ?? DEFAULT_SESSION;
      this.learning.value = learning;
    });
    for (const w of unsaved) this.write(w.store, w.key, w.value);
    // The recovered session is saved properly now, so storage matches what is shown (I6).
    if (mirrorIsNewer) this.write("session", "session", this.session.value);
  }

  private readPending(): PendingWrite[] {
    try {
      const raw = this.local?.getItem(PENDING_KEY);
      const list = raw ? (JSON.parse(raw) as PendingWrite[]) : [];
      return Array.isArray(list)
        ? list.filter(
            (w) =>
              (w.store === "settings" ||
                w.store === "songPrefs" ||
                w.store === "songs" ||
                w.store === "drafts" ||
                w.store === "meta") &&
              typeof w.key === "string" &&
              (STORE_VALIDATORS[w.store]?.(w.value).length ?? 0) === 0,
          )
        : [];
    } catch {
      return [];
    }
  }

  private persistPending(): void {
    try {
      const list = [...this.pending.values()].filter((w) => w.store !== "session");
      this.local?.setItem(PENDING_KEY, JSON.stringify(list));
    } catch {
      // localStorage full or blocked: the IndexedDB write still happens.
    }
  }

  private readMirror(): Session | null {
    try {
      const raw = this.local?.getItem(SESSION_MIRROR_KEY);
      return raw ? readSession(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }

  // --- Writes ---------------------------------------------------------------------------

  private write(store: StoreName, key: string, value: unknown): void {
    const id = `${store}/${key}`;
    this.pending.set(id, { store, key, value });
    this.persistPending();
    if (!this.writing.has(id) && !this.failing.has(id)) this.pump(id);
  }

  private pump(id: string): void {
    const w = this.pending.get(id);
    if (!w) return;
    this.writing.add(id);
    this.storage.put(w.store, w.key, w.value).then(
      () => {
        this.writing.delete(id);
        this.failing.delete(id);
        // Only clear it if nothing newer was queued while this write was in flight.
        if (this.pending.get(id) === w) {
          this.pending.delete(id);
          this.persistPending();
        } else {
          this.pump(id);
        }
        if (this.failing.size === 0) this.dismissSaveErrors();
      },
      (e: unknown) => {
        this.writing.delete(id);
        this.failing.add(id);
        this.reportError(saveFailureText(e), e);
        this.scheduleRetry();
      },
    );
  }

  private scheduleRetry(): void {
    if (this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      const ids = [...this.failing];
      this.failing.clear();
      for (const id of ids) if (!this.writing.has(id)) this.pump(id);
    }, RETRY_MS);
  }

  /** True while any save is in flight or waiting for a retry (test hook, I6). */
  get savesPending(): boolean {
    return this.pending.size > 0 || this.sessionTimer !== null;
  }

  private saveSession(next: Session): void {
    this.session.value = next;
    try {
      this.local?.setItem(SESSION_MIRROR_KEY, JSON.stringify(next));
    } catch {
      // localStorage full or blocked: the IndexedDB write below still happens.
    }
    if (this.sessionTimer) clearTimeout(this.sessionTimer);
    this.sessionTimer = setTimeout(() => this.flushSession(), SESSION_DEBOUNCE_MS);
  }

  /** Writes the session now (pagehide, or the debounce firing). */
  flushSession(): void {
    if (this.sessionTimer) clearTimeout(this.sessionTimer);
    this.sessionTimer = null;
    this.write("session", "session", this.session.value);
  }

  private updateSession(patch: Partial<Omit<Session, "schemaVersion" | "savedAt">>): void {
    this.saveSession({ ...this.session.value, ...patch, savedAt: new Date().toISOString() });
  }

  private updatePrefs(songId: string, patch: Partial<Omit<SongPrefs, "songId">>): void {
    const prev = this.prefs.value.get(songId) ?? {
      schemaVersion: MODEL_SCHEMA_VERSION,
      songId,
      favorite: false,
    };
    const next: SongPrefs = { ...prev, ...patch, schemaVersion: MODEL_SCHEMA_VERSION, songId };
    const map = new Map(this.prefs.value);
    map.set(songId, next);
    this.prefs.value = map;
    this.write("songPrefs", songId, next);
  }

  // --- Actions --------------------------------------------------------------------------

  openSong(id: string): void {
    if (!this.songs.some((s) => s.id === id)) return;
    batch(() => {
      this.updateSession({ songId: id, topMeasure: 0 });
      this.updatePrefs(id, { lastOpenedAt: new Date().toISOString() });
      this.practicePanel.value = "none";
      this.openNonce.value++;
    });
  }

  closeSong(): void {
    this.updateSession({ songId: null, topMeasure: 0 });
  }

  toggleFavorite(id: string): void {
    this.updatePrefs(id, { favorite: !(this.prefs.value.get(id)?.favorite ?? false) });
  }

  setView(view: ViewMode): void {
    const id = this.session.value.songId;
    if (id) this.updatePrefs(id, { view });
    else this.updateSettings({ defaultView: view });
  }

  /** Changes the open song's practice state (debounced writes would batch slider drags). */
  updatePractice(patch: Partial<PracticePrefs>): void {
    const id = this.session.value.songId;
    if (!id) return;
    const sound: Record<string, unknown> = {};
    const song: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      (SOUND_KEYS.includes(k as (typeof SOUND_KEYS)[number]) ? sound : song)[k] = v;
    }
    if (Object.keys(sound).length > 0) this.updateSettings(sound as Partial<Settings>);
    if (Object.keys(song).length > 0) {
      const next = readPractice({ ...this.practice.value, ...song });
      this.updatePrefs(id, { practice: next });
    }
  }

  setTopMeasure(measure: number): void {
    if (measure !== this.session.value.topMeasure) this.updateSession({ topMeasure: measure });
  }

  toggleSongPanel(open?: boolean): void {
    this.updateSession({ songPanelOpen: open ?? !this.session.value.songPanelOpen });
  }

  updateSettings(patch: Partial<Omit<Settings, "schemaVersion">>): void {
    const next = readSettings({ ...this.settings.value, ...patch });
    this.settings.value = next;
    this.write("settings", "settings", next);
  }

  // --- Dad's songs (F17), backups (F18) ----------------------------------------------------

  /** Saves a user song (new or edited). Shows the backup prompt (F18). */
  saveSong(song: Song): void {
    const saved: Song = { ...song, source: "user", updatedAt: new Date().toISOString() };
    const others = this.songList.value.filter((s) => s.id !== saved.id);
    const user = [...others.filter((s) => s.source === "user"), saved].sort((a, b) =>
      a.title.localeCompare(b.title),
    );
    this.songList.value = [...this.builtins, ...user];
    this.write("songs", saved.id, saved);
    this.notify(
      "info",
      "Song saved. Remember to back up your songs (Settings → Back up my songs).",
    );
  }

  /** Deletes a user song; the old record goes to trash first (§8.1), in one transaction. */
  async deleteSong(id: string): Promise<boolean> {
    const song = this.songList.value.find((s) => s.id === id && s.source === "user");
    if (!song) return false;
    const now = new Date().toISOString();
    try {
      await this.storage.writeAll([
        {
          op: "put",
          store: "trash",
          key: `${now}:${id}`,
          value: { deletedAt: now, reason: "deleted", store: "songs", record: song },
        },
        { op: "delete", store: "songs", key: id },
      ]);
    } catch (e) {
      this.reportError("Couldn't delete the song", e);
      return false;
    }
    this.songList.value = this.songList.value.filter((s) => s.id !== id);
    if (this.session.value.songId === id) this.closeSong();
    return true;
  }

  /** F17: editor drafts autosave on every change (debounced by the write queue). */
  saveDraft(key: string, draft: unknown): void {
    this.write("drafts", key, { savedAt: new Date().toISOString(), draft });
  }

  async loadDraft(key: string): Promise<unknown> {
    try {
      const d = await this.storage.get<{ draft: unknown }>("drafts", key);
      return d?.draft ?? null;
    } catch {
      return null;
    }
  }

  discardDraft(key: string): void {
    this.storage.delete("drafts", key).catch(() => {});
  }

  /** F21: a playback event for the practice log (play, tempo change, stop). */
  logPractice(event: LogEvent): void {
    const { open, finished } = applyLogEvent(
      this.openSession,
      event,
      this.services.clock.now(),
      new Date(),
      () => crypto.randomUUID(),
    );
    this.openSession = open;
    if (finished) this.savePracticeSession(finished);
    if (open && (event.kind === "stop" || event.kind === "play")) {
      this.savePracticeSession(closeSession(open, this.services.clock.now()));
    }
  }

  private savePracticeSession(s: PracticeSession): void {
    this.practiceLog.value = [s, ...this.practiceLog.value.filter((x) => x.id !== s.id)];
    this.write("practiceLog", s.id, s);
  }

  /** F37: Dad rated one pass of a roll lesson. */
  rateRollPass(rollId: string, rating: Rating): void {
    this.learning.value = rateRoll(this.learning.value, rollId, rating);
    this.write("meta", LEARNING_KEY, this.learning.value);
  }

  /** F37: start a roll's lesson over from full help. */
  resetRollLesson(rollId: string): void {
    this.learning.value = resetRoll(this.learning.value, rollId);
    this.write("meta", LEARNING_KEY, this.learning.value);
  }

  /** Records that a backup was made (F18 "Last backup: N days ago"). */
  markBackedUp(): void {
    const at = new Date().toISOString();
    this.lastBackupAt.value = at;
    this.write("meta", "meta", { lastBackupAt: at });
  }

  /** After an import: reread everything from storage. */
  async reload(): Promise<void> {
    await this.load();
  }

  // --- Notices --------------------------------------------------------------------------

  notify(kind: Notice["kind"], text: string): void {
    if (this.notices.value.some((n) => n.text === text)) return;
    this.notices.value = [...this.notices.value, { id: this.nextNoticeId++, kind, text }];
  }

  dismiss(id: number): void {
    this.notices.value = this.notices.value.filter((n) => n.id !== id);
  }

  private dismissSaveErrors(): void {
    this.notices.value = this.notices.value.filter((n) => !n.text.startsWith("Couldn't save"));
  }

  private reportError(text: string, e: unknown): void {
    this.services.diagnostics.log(
      "error",
      `${text}: ${e instanceof Error ? e.message : String(e)}`,
    );
    this.notify("error", text);
  }
}

function saveFailureText(e: unknown): string {
  const name = e instanceof Error || e instanceof DOMException ? e.name : "";
  return name === "QuotaExceededError"
    ? "Couldn't save: the iPad's storage is full. Your change is kept for now and will be retried."
    : "Couldn't save your change. It's kept for now and will be retried.";
}

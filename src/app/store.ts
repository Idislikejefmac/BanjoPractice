// App state (DEVELOPMENT.md §2.2, §5.2, §8.1) as Preact signals, persisted through P1.
//
// - Settings, per-song prefs (favorite, last opened, view) and the session are stored in
//   IndexedDB. The session is also mirrored to localStorage on every change, synchronously,
//   so an iPadOS reload right after a change still restores it (F35).
// - Session writes to IndexedDB are debounced (500 ms) and flushed on pagehide.
// - A failed save is never silent: it shows a notice and is retried (CHAOS_TESTING.md I6).

import { batch, computed, signal } from "@preact/signals";
import type { Song } from "../core/song/song.ts";
import type { KeyValueStore, StoreName } from "../platform/types.ts";
import type { Services } from "./services.ts";
import type { Session, Settings, SongPrefs, ViewMode } from "./model.ts";
import {
  DEFAULT_SESSION,
  DEFAULT_SETTINGS,
  MODEL_SCHEMA_VERSION,
  readSession,
  readSettings,
  readSongPrefs,
  recentSongIds,
} from "./model.ts";

const SESSION_MIRROR_KEY = "banjo.session";
const SESSION_DEBOUNCE_MS = 500;
const RETRY_MS = 3000;

export interface Notice {
  readonly id: number;
  readonly kind: "error" | "info";
  readonly text: string;
}

type PendingWrite = { store: StoreName; key: string; value: unknown };

export class AppStore {
  readonly songs: readonly Song[];
  readonly settings = signal<Settings>(DEFAULT_SETTINGS);
  readonly prefs = signal<ReadonlyMap<string, SongPrefs>>(new Map());
  readonly session = signal<Session>(DEFAULT_SESSION);
  readonly settingsOpen = signal(false);
  readonly notices = signal<readonly Notice[]>([]);
  /** Bumped when the user picks a song, so the view scrolls to its top. */
  readonly openNonce = signal(0);

  readonly currentSong = computed(
    () => this.songs.find((s) => s.id === this.session.value.songId) ?? null,
  );
  readonly view = computed<ViewMode>(() => {
    const id = this.session.value.songId;
    return (id ? this.prefs.value.get(id)?.view : undefined) ?? this.settings.value.defaultView;
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
  /** Writes that failed, newest value per record, retried until they succeed. */
  private failed = new Map<string, PendingWrite>();
  private inFlight = 0;

  private readonly services: Services;
  private readonly local: Pick<Storage, "getItem" | "setItem"> | null;

  constructor(
    services: Services,
    songs: readonly Song[],
    local: Pick<Storage, "getItem" | "setItem"> | null,
  ) {
    this.services = services;
    this.songs = songs;
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
    try {
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
    // The localStorage mirror is newer if a reload happened before the debounced write.
    const mirrored = this.readMirror();
    if (mirrored && (!session || mirrored.savedAt > session.savedAt)) session = mirrored;
    if (session?.songId && !this.songs.some((s) => s.id === session!.songId)) {
      session = { ...session, songId: null, topMeasure: 0 };
    }
    batch(() => {
      this.settings.value = settings;
      this.prefs.value = prefs;
      this.session.value = session ?? DEFAULT_SESSION;
    });
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
    this.inFlight++;
    this.storage.put(store, key, value).then(
      () => {
        this.inFlight--;
        this.failed.delete(`${store}/${key}`);
        if (this.failed.size === 0) this.dismissSaveErrors();
      },
      (e: unknown) => {
        this.inFlight--;
        this.failed.set(`${store}/${key}`, { store, key, value });
        this.reportError(saveFailureText(e), e);
        this.scheduleRetry();
      },
    );
  }

  private scheduleRetry(): void {
    if (this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      const pending = [...this.failed.values()];
      this.failed.clear();
      for (const w of pending) this.write(w.store, w.key, w.value);
    }, RETRY_MS);
  }

  /** True while any save is in flight or waiting for a retry (test hook, I6). */
  get savesPending(): boolean {
    return this.inFlight > 0 || this.failed.size > 0 || this.sessionTimer !== null;
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

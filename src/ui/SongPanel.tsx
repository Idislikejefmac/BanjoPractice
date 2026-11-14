// F2 song library + F24 favorites and recently played. Collapsible left panel; on narrow
// screens it overlays the song and closes when a song is picked.

import { useState } from "preact/hooks";
import { daysAgo } from "./BackupSection.tsx";
import type { AppStore } from "../app/store.ts";
import { indexAbc } from "../core/song/abcIndex.ts";
import { formatKey } from "../core/music/keys.ts";
import type { Song } from "../core/song/song.ts";
import { rollIdOfSong } from "../core/banjo/exercises.ts";

const SEARCH_THRESHOLD = 15;

const metaCache = new Map<string, string>();
function songMeta(song: Song): string {
  let m = metaCache.get(song.id);
  if (m === undefined) {
    const idx = indexAbc(song.abc);
    m = [`${formatKey(idx.key)}`, `${idx.meter.num}/${idx.meter.den}`, ...song.tags].join(" · ");
    metaCache.set(song.id, m);
  }
  return m;
}

function SongRow({ store, song, section }: { store: AppStore; song: Song; section: string }) {
  // A roll is current whether it is open as its lesson or as its full exercise.
  const open = store.session.value.songId;
  const current =
    open === song.id ||
    (song.id.startsWith("exercise:") && rollIdOfSong(open) === rollIdOfSong(song.id));
  const favorite = store.prefs.value.get(song.id)?.favorite ?? false;
  return (
    <li class={current ? "song-row current" : "song-row"}>
      <button
        class="song-open"
        data-song={song.id}
        data-section={section}
        aria-current={current ? "page" : undefined}
        onClick={() => {
          store.openSong(song.id);
          if (window.matchMedia("(max-width: 899px)").matches) store.toggleSongPanel(false);
        }}
      >
        <span class="song-title">{song.title}</span>
        <span class="song-row-meta">{songMeta(song)}</span>
      </button>
      <button
        class={favorite ? "star on" : "star"}
        aria-pressed={favorite}
        aria-label={
          favorite ? `Remove ${song.title} from favorites` : `Add ${song.title} to favorites`
        }
        data-favorite={song.id}
        onClick={() => store.toggleFavorite(song.id)}
      >
        {favorite ? "★" : "☆"}
      </button>
      {song.source === "user" && (
        <>
          <button
            class="row-action"
            aria-label={`Edit ${song.title}`}
            data-edit={song.id}
            onClick={() => (store.editing.value = song.id)}
          >
            ✎
          </button>
          <button
            class="row-action"
            aria-label={`Delete ${song.title}`}
            data-delete={song.id}
            onClick={() => {
              if (window.confirm(`Delete "${song.title}"? It's kept in the trash for 30 days.`)) {
                void store.deleteSong(song.id);
              }
            }}
          >
            🗑
          </button>
        </>
      )}
    </li>
  );
}

function Section({
  store,
  title,
  id,
  songs,
  folded,
  onToggle,
  searching,
}: {
  store: AppStore;
  title: string;
  id: string;
  songs: readonly Song[];
  folded: boolean;
  onToggle: () => void;
  /** While he is searching, every section with a match stays open so a match is never hidden. */
  searching: boolean;
}) {
  if (songs.length === 0) return null;
  const shut = folded && !searching;
  return (
    <section class="song-section" aria-label={title}>
      <h3>
        <button
          type="button"
          class="section-toggle"
          data-action={`toggle-section-${id}`}
          aria-expanded={!shut}
          disabled={searching}
          onClick={onToggle}
        >
          <span class="section-arrow" aria-hidden="true">
            {shut ? "▸" : "▾"}
          </span>
          {title}
          {shut && <span class="section-count"> ({songs.length})</span>}
        </button>
      </h3>
      {!shut && (
        <ul>
          {songs.map((s) => (
            <SongRow key={`${id}-${s.id}`} store={store} song={s} section={id} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function SongPanel({ store }: { store: AppStore }) {
  const [query, setQuery] = useState("");
  // Which sections he has folded away (this visit only).
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) =>
    setFolded((f) => {
      const next = new Set(f);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const open = store.session.value.songPanelOpen;
  const all = store.songs;
  const q = query.trim().toLowerCase();
  const match = (s: Song) => q === "" || s.title.toLowerCase().includes(q);
  const isExercise = (s: Song) => s.tags.includes("exercise");
  const builtins = all.filter(
    (s) => s.source === "builtin" && !isExercise(s) && !s.tags.includes("lesson") && match(s),
  );
  const exercises = all.filter((s) => isExercise(s) && match(s));
  const mine = all.filter((s) => s.source === "user" && match(s));

  return (
    <>
      {open && (
        <div
          class="panel-backdrop"
          onClick={() => store.toggleSongPanel(false)}
          aria-hidden="true"
        />
      )}
      <aside class={open ? "song-panel open" : "song-panel"} aria-label="Songs" hidden={!open}>
        <div class="panel-head">
          {all.length > SEARCH_THRESHOLD && (
            <input
              class="song-search"
              type="search"
              placeholder="Find a song"
              value={query}
              onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
            />
          )}
          <button
            class="panel-collapse"
            data-action="hide-songs"
            aria-label="Hide the song list"
            title="Hide the song list"
            onClick={() => store.toggleSongPanel(false)}
          >
            ‹
          </button>
        </div>
        <Section
          store={store}
          title="Favorites"
          id="favorites"
          songs={store.favorites.value.filter(match)}
          folded={folded.has("favorites")}
          onToggle={() => toggle("favorites")}
          searching={q !== ""}
        />
        <Section
          store={store}
          title="Recently played"
          id="recent"
          songs={store.recent.value.filter(match)}
          folded={folded.has("recent")}
          onToggle={() => toggle("recent")}
          searching={q !== ""}
        />
        <Section
          store={store}
          title="Roll exercises"
          id="exercises"
          songs={exercises}
          folded={folded.has("exercises")}
          onToggle={() => toggle("exercises")}
          searching={q !== ""}
        />
        <div class="my-songs-head">
          <button
            class="plain-button"
            data-action="new-song"
            onClick={() => (store.editing.value = "new")}
          >
            + New song
          </button>
          {mine.length > 0 && (
            <span class="setting-help" data-testid="panel-last-backup">
              Last backup: {daysAgo(store.lastBackupAt.value)}
            </span>
          )}
        </div>
        <Section
          store={store}
          title="My songs"
          id="mine"
          songs={mine}
          folded={folded.has("mine")}
          onToggle={() => toggle("mine")}
          searching={q !== ""}
        />
        <Section
          store={store}
          title="Songs"
          id="builtin"
          songs={builtins}
          folded={folded.has("builtin")}
          onToggle={() => toggle("builtin")}
          searching={q !== ""}
        />
      </aside>
    </>
  );
}

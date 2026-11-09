// F2 song library + F24 favorites and recently played. Collapsible left panel; on narrow
// screens it overlays the song and closes when a song is picked.

import { useState } from "preact/hooks";
import { daysAgo } from "./BackupSection.tsx";
import type { AppStore } from "../app/store.ts";
import { indexAbc } from "../core/song/abcIndex.ts";
import { formatKey } from "../core/music/keys.ts";
import type { Song } from "../core/song/song.ts";

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
  const current = store.session.value.songId === song.id;
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
}: {
  store: AppStore;
  title: string;
  id: string;
  songs: readonly Song[];
}) {
  if (songs.length === 0) return null;
  return (
    <section class="song-section" aria-label={title}>
      <h3>{title}</h3>
      <ul>
        {songs.map((s) => (
          <SongRow key={`${id}-${s.id}`} store={store} song={s} section={id} />
        ))}
      </ul>
    </section>
  );
}

export function SongPanel({ store }: { store: AppStore }) {
  const [query, setQuery] = useState("");
  const open = store.session.value.songPanelOpen;
  const all = store.songs;
  const q = query.trim().toLowerCase();
  const match = (s: Song) => q === "" || s.title.toLowerCase().includes(q);
  const isExercise = (s: Song) => s.tags.includes("exercise");
  const builtins = all.filter((s) => s.source === "builtin" && !isExercise(s) && match(s));
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
        {all.length > SEARCH_THRESHOLD && (
          <input
            class="song-search"
            type="search"
            placeholder="Find a song"
            value={query}
            onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          />
        )}
        <Section
          store={store}
          title="Favorites"
          id="favorites"
          songs={store.favorites.value.filter(match)}
        />
        <Section
          store={store}
          title="Recently played"
          id="recent"
          songs={store.recent.value.filter(match)}
        />
        <Section store={store} title="Songs" id="builtin" songs={builtins} />
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
        <Section store={store} title="My songs" id="mine" songs={mine} />
        <Section store={store} title="Roll exercises" id="exercises" songs={exercises} />
      </aside>
    </>
  );
}

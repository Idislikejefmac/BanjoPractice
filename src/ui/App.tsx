// F1 app shell: toolbar always on screen, collapsible song panel, the song, settings.
// With no song open, the welcome screen shows the roll reference (each roll checked live).

import { useSignalEffect } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import type { Player } from "../app/player.ts";
import type { Services } from "../app/services.ts";
import type { AppStore } from "../app/store.ts";
import { SIZE_STEPS } from "../app/model.ts";
import { ROLLS, rollMeasure } from "../core/banjo/rolls.ts";
import type { Finger } from "../core/banjo/types.ts";
import { FINGER_NAME } from "../core/banjo/types.ts";
import { validate } from "../core/banjo/validator.ts";
import { ChordFinder } from "./ChordFinder.tsx";
import { PracticeTools } from "./PracticeTools.tsx";
import { SongEditor } from "./SongEditor.tsx";
import { PracticeBar } from "./PracticeBar.tsx";
import { SettingsPage } from "./SettingsPage.tsx";
import { SongPanel } from "./SongPanel.tsx";
import { SongView } from "./SongView.tsx";

function FingerBadge({ finger }: { finger: Finger }) {
  return (
    <span
      class={`badge badge-${finger}`}
      title={FINGER_NAME[finger]}
      aria-label={FINGER_NAME[finger]}
    >
      {finger}
    </span>
  );
}

function RollCard({ roll }: { roll: (typeof ROLLS)[number] }) {
  // Two copies, so the join into the next measure is checked too.
  const problems = validate([rollMeasure(roll, { index: 1 }), rollMeasure(roll, { index: 2 })]);
  return (
    <li class="roll">
      <div class="roll-head">
        <h3>{roll.name}</h3>
        <span class={problems.length === 0 ? "check ok" : "check bad"}>
          {problems.length === 0 ? "✓ follows the rules" : `${problems.length} problem(s)`}
        </span>
      </div>
      <div class="roll-grid" role="table" aria-label={`${roll.name} roll`}>
        <div class="row" role="row">
          {roll.fingers.map((f, i) => (
            <span role="cell" key={i} class={roll.accents.includes(i) ? "accent" : ""}>
              <FingerBadge finger={f} />
            </span>
          ))}
        </div>
        <div class="row strings" role="row">
          {roll.exampleStrings.map((s, i) => (
            <span role="cell" key={i}>
              {s}
            </span>
          ))}
        </div>
      </div>
      <p class="use">{roll.use}</p>
    </li>
  );
}

function Welcome({ store }: { store: AppStore }) {
  return (
    <div class="welcome">
      <section class="intro">
        <h2>Pick a song</h2>
        <p>
          Choose a song from the list to see its tab and notation.{" "}
          {!store.session.value.songPanelOpen && (
            <button class="link-button" onClick={() => store.toggleSongPanel(true)}>
              Show the song list
            </button>
          )}
        </p>
      </section>
      <section>
        <h2>Rolls</h2>
        <p class="legend">
          <FingerBadge finger="T" /> Thumb <FingerBadge finger="I" /> Index{" "}
          <FingerBadge finger="M" /> Middle
          <span class="legend-note">Underlined = accented note. Numbers = strings.</span>
        </p>
        <ul class="rolls">
          {ROLLS.map((r) => (
            <RollCard key={r.id} roll={r} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function Toolbar({ store, player }: { store: AppStore; player: Player }) {
  const song = store.currentSong.value;
  const size = store.settings.value.size;
  return (
    <header class={song ? "toolbar has-song" : "toolbar"}>
      <div class="toolbar-row">
        <h1 class="toolbar-title">{song ? song.title : "Banjo Practice"}</h1>
        <div class="tool-group">
          <button
            class="tool"
            data-action="smaller"
            aria-label="Smaller"
            disabled={size <= 0}
            onClick={() => store.updateSettings({ size: size - 1 })}
          >
            A−
          </button>
          <button
            class="tool"
            data-action="bigger"
            aria-label="Bigger"
            disabled={size >= SIZE_STEPS.length - 1}
            onClick={() => store.updateSettings({ size: size + 1 })}
          >
            A+
          </button>
          <button
            class="tool"
            data-action="practice-tools"
            onClick={() =>
              (store.practiceTools.value = store.practiceTools.value === null ? "tuner" : null)
            }
          >
            Tuner
          </button>
          <button
            class="tool"
            data-action="chords"
            onClick={() =>
              (store.chordFinder.value = store.chordFinder.value === null ? "G" : null)
            }
          >
            Chords
          </button>
          <button
            class="tool"
            data-action="settings"
            aria-label="Settings"
            onClick={() => (store.settingsOpen.value = !store.settingsOpen.value)}
          >
            ⚙
          </button>
        </div>
      </div>
      {song && <PracticeBar store={store} player={player} />}
    </header>
  );
}

function Notices({ store }: { store: AppStore }) {
  const notices = store.notices.value;
  if (notices.length === 0) return null;
  return (
    <div class="notices" role="status" aria-live="polite">
      {notices.map((n) => (
        <p key={n.id} class={`notice notice-${n.kind}`}>
          <span>{n.text}</span>
          <button class="link-button" onClick={() => store.dismiss(n.id)} aria-label="Dismiss">
            ✕
          </button>
        </p>
      ))}
    </div>
  );
}

export function App({
  services,
  store,
  player,
}: {
  services: Services;
  store: AppStore;
  player: Player;
}) {
  // F12: keep the screen awake while a song is open (re-acquired by the service on return).
  useSignalEffect(() => {
    const wanted = store.currentSong.value !== null && store.settings.value.keepAwake;
    void services.wakeLock.setWanted(wanted);
  });

  useEffect(() => {
    if (services.storageMode !== "ok") {
      store.notify(
        "error",
        services.storageMode === "read-only-newer"
          ? "Your saved songs were made by a newer version of the app. Please update the app."
          : "Saving isn't available right now, so changes won't be kept.",
      );
    }
  }, [services, store]);

  // Playing is what the screen is for: when playback starts the song list steps aside so the
  // music gets the whole width. It can be opened again (the › tab) and stays open until the next
  // time playback starts.
  const wasPlaying = useRef(false);
  useSignalEffect(() => {
    const playing = player.state.value !== "stopped";
    if (playing && !wasPlaying.current && store.session.peek().songPanelOpen) {
      store.toggleSongPanel(false);
    }
    wasPlaying.current = playing;
  });

  // The toolbar's height changes (practice row, wrapping): panels below it follow.
  useEffect(() => {
    const bar = document.querySelector(".toolbar");
    if (!bar) return;
    const set = () =>
      document.documentElement.style.setProperty(
        "--toolbar-h",
        `${Math.ceil(bar.getBoundingClientRect().height)}px`,
      );
    set();
    const ro = new ResizeObserver(set);
    ro.observe(bar);
    return () => ro.disconnect();
  }, []);

  const settings = store.settings.value;
  const panelOpen = store.session.value.songPanelOpen;
  return (
    <div
      class={`shell${panelOpen ? " panel-open" : ""}${settings.colorBadges ? "" : " grey-badges"}`}
      style={{ "--size": String(SIZE_STEPS[settings.size] ?? 1) }}
    >
      <Toolbar store={store} player={player} />
      <div class="body">
        <SongPanel store={store} />
        {!panelOpen && (
          <button
            class="panel-handle"
            data-action="show-songs"
            aria-label="Show the song list"
            title="Show the song list"
            onClick={() => store.toggleSongPanel(true)}
          >
            ›
          </button>
        )}
        <main class="content">
          {store.currentSong.value ? (
            <SongView store={store} player={player} />
          ) : (
            <Welcome store={store} />
          )}
        </main>
      </div>
      {store.settingsOpen.value && <SettingsPage store={store} services={services} />}
      {store.chordFinder.value !== null && <ChordFinder store={store} player={player} />}
      {store.editing.value !== null && <SongEditor key={store.editing.value} store={store} />}
      {store.practiceTools.value !== null && (
        <PracticeTools store={store} services={services} player={player} />
      )}
      <Notices store={store} />
    </div>
  );
}

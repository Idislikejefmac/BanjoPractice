// F17 song editor (DEVELOPMENT.md F17). Dad enters notes by name and length, measure by
// measure, with big buttons; sets a chord per measure or half-measure; the tab is arranged
// live by C6 (with a roll override per measure, explained when it can't work); drafts save on
// every change. "Edit ABC" is a text view for Jeff, validated before saving.

import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { AppStore } from "../app/store.ts";
import { arrange } from "../core/banjo/arranger.ts";
import { ROLLS } from "../core/banjo/rolls.ts";
import type { Key, Mode } from "../core/music/keys.ts";
import { formatKey, parseKey } from "../core/music/keys.ts";
import type { Letter } from "../core/music/notes.ts";
import { indexAbc } from "../core/song/abcIndex.ts";
import type { EditorMeasure, EditorNote, EditorSong, Eighths } from "../core/song/editorModel.ts";
import {
  emptySong,
  fits,
  LENGTHS,
  measureEighths,
  overridesOf,
  toAbc,
  usedEighths,
} from "../core/song/editorModel.ts";
import type { Song } from "../core/song/song.ts";
import { SONG_SCHEMA_VERSION } from "../core/song/song.ts";
import { evenGeometry, layoutTabLine } from "../render/tabLayout.ts";
import { TabSvg } from "../render/TabSvg.tsx";

const LETTERS: readonly Letter[] = ["C", "D", "E", "F", "G", "A", "B"];
const KEYS = ["G", "A", "Bb", "C", "D", "E", "F"];
const MODES: readonly { mode: Mode; label: string }[] = [
  { mode: "major", label: "major" },
  { mode: "mixolydian", label: "Mixolydian" },
  { mode: "dorian", label: "Dorian" },
  { mode: "minor", label: "minor" },
];
const CHORD_ROOTS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const CHORD_TYPES = [
  { suffix: "", label: "major" },
  { suffix: "m", label: "minor" },
  { suffix: "7", label: "7" },
  { suffix: "m7", label: "m7" },
  { suffix: "maj7", label: "maj7" },
  { suffix: "6", label: "6" },
  { suffix: "sus4", label: "sus4" },
  { suffix: "dim", label: "dim" },
];

function noteLabel(n: EditorNote): string {
  if (n.letter === null) return "rest";
  const acc = n.accidental === 1 ? "♯" : n.accidental === -1 ? "♭" : n.accidental === 0 ? "♮" : "";
  const len = LENGTHS.find((l) => l.eighths === n.eighths)?.label.toLowerCase() ?? "";
  return `${n.letter}${acc}${n.octave >= 5 ? " (high)" : ""} · ${len}`;
}

function splitChord(chord: string | undefined): { root: string; suffix: string } {
  const m = /^([A-G][#b]?)(.*)$/.exec(chord ?? "G");
  return { root: m?.[1] ?? "G", suffix: m?.[2] ?? "" };
}

function ChordPicker({
  value,
  onChange,
  name,
}: {
  value: string | undefined;
  onChange: (chord: string) => void;
  name: string;
}) {
  const { root, suffix } = splitChord(value);
  return (
    <span class="chord-picker">
      <select
        name={`${name}-root`}
        value={root}
        onChange={(e) => onChange((e.target as HTMLSelectElement).value + suffix)}
      >
        {CHORD_ROOTS.map((r) => (
          <option key={r} value={r}>
            {r.replace("#", "♯").replace("b", "♭")}
          </option>
        ))}
      </select>
      <select
        name={`${name}-type`}
        value={suffix}
        onChange={(e) => onChange(root + (e.target as HTMLSelectElement).value)}
      >
        {CHORD_TYPES.map((t) => (
          <option key={t.suffix} value={t.suffix}>
            {t.label}
          </option>
        ))}
      </select>
    </span>
  );
}

export function SongEditor({ store }: { store: AppStore }) {
  const editingId = store.editing.value!;
  const existing = store.songs.find((s) => s.id === editingId && s.source === "user") ?? null;
  const draftKey = existing?.id ?? "new";
  const initial: EditorSong =
    (existing?.editor as EditorSong | undefined) ?? emptySong(parseKey("G")!);
  const [song, setSong] = useState<EditorSong>(initial);
  const [abcMode, setAbcMode] = useState(existing !== null && existing.editor === undefined);
  const [abcText, setAbcText] = useState(existing?.abc ?? toAbc(initial));
  const [current, setCurrent] = useState(0);
  const [accidental, setAccidental] = useState<EditorNote["accidental"]>("key");
  const [octave, setOctave] = useState(4);
  const [restored, setRestored] = useState(false);
  const loadedDraft = useRef(false);

  // Restore an unsaved draft (F17: autosave; CHAOS_TESTING.md §6.5 reload with editor open).
  useEffect(() => {
    if (loadedDraft.current) return;
    loadedDraft.current = true;
    void store.loadDraft(draftKey).then((d) => {
      if (d && typeof d === "object" && Array.isArray((d as EditorSong).measures)) {
        setSong(d as EditorSong);
        setRestored(true);
      }
    });
  }, [draftKey, store]);

  const update = (next: EditorSong) => {
    setSong(next);
    store.saveDraft(draftKey, next);
  };
  const m: EditorMeasure = song.measures[current] ?? { notes: [], chords: [] };
  const setMeasure = (next: EditorMeasure) =>
    update({ ...song, measures: song.measures.map((x, i) => (i === current ? next : x)) });
  const full = measureEighths(song.meter);
  const left = full - usedEighths(m);

  const addNote = (letter: Letter | null, eighths: Eighths) => {
    if (!fits(song, m, eighths)) return;
    const next: EditorMeasure = {
      ...m,
      notes: [...m.notes, { letter, accidental, octave, eighths }],
    };
    if (left - eighths === 0 && current === song.measures.length - 1) {
      // Measure full: start the next one, carrying the chord.
      const lastChord = m.chords[m.chords.length - 1]?.chord ?? "G";
      update({
        ...song,
        measures: [
          ...song.measures.map((x, i) => (i === current ? next : x)),
          { notes: [], chords: [{ atSlot: 0, chord: lastChord }] },
        ],
      });
      setCurrent(current + 1);
    } else {
      setMeasure(next);
    }
  };
  const [length, setLength] = useState<Eighths>(2);

  // Live arrangement (C6) for the preview and to explain roll overrides.
  const abc = abcMode ? abcText : toAbc(song);
  const live = useMemo(() => {
    try {
      const idx = indexAbc(abc);
      if (idx.errors.length > 0) return { idx, result: null, error: idx.errors[0]! };
      const result = arrange(idx, { overrides: abcMode ? new Map() : overridesOf(song) });
      return { idx, result, error: null };
    } catch (e) {
      return { idx: null, result: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [abc, abcMode, song]);
  const problem = live.result?.problems.find((p) => p.measure === current + 1);
  const previewMeasures = live.result?.arrangement.measures.slice(
    Math.max(0, current - 1),
    current + 2,
  );

  const save = () => {
    const title = (abcMode ? live.idx?.title : song.title)?.trim() || "Untitled";
    if (live.error || !live.idx || live.idx.measures.length === 0) {
      store.notify("error", `This song can't be saved yet: ${live.error ?? "it has no music"}`);
      return;
    }
    const id = existing?.id ?? crypto.randomUUID();
    const saved: Song = {
      schemaVersion: SONG_SCHEMA_VERSION,
      id,
      title,
      source: "user",
      abc,
      tags: [],
      ...(abcMode
        ? {}
        : { editor: { ...song, title }, overrides: Object.fromEntries(overridesOf(song)) }),
    };
    store.saveSong(saved);
    store.discardDraft(draftKey);
    store.editing.value = null;
    store.openSong(id);
  };

  return (
    <div class="settings-page song-editor" role="dialog" aria-modal="true" aria-label="Song editor">
      <header class="settings-head">
        <h2>{existing ? "Edit song" : "New song"}</h2>
        <div class="button-row">
          <button
            class="plain-button"
            data-action="editor-cancel"
            onClick={() => (store.editing.value = null)}
          >
            Close
          </button>
          <button class="big-button" data-action="editor-save" onClick={save}>
            Save
          </button>
        </div>
      </header>
      {restored && (
        <p class="notice" role="status">
          Restored your unsaved changes.
        </p>
      )}

      {abcMode ? (
        <section>
          <h3>ABC text</h3>
          <textarea
            class="abc-text"
            name="abc"
            rows={14}
            value={abcText}
            onInput={(e) => setAbcText((e.target as HTMLTextAreaElement).value)}
          />
          {live.error && <p class="song-note warn">{live.error}</p>}
        </section>
      ) : (
        <>
          <section>
            <label class="setting-row">
              <span>Title</span>
              <input
                class="text-input"
                name="title"
                value={song.title}
                onInput={(e) => update({ ...song, title: (e.target as HTMLInputElement).value })}
              />
            </label>
            <div class="loop-row">
              <label>
                Key{" "}
                <select
                  name="key"
                  value={song.key.tonic.letter + (song.key.tonic.accidental < 0 ? "b" : "")}
                  onChange={(e) =>
                    update({
                      ...song,
                      key: {
                        ...parseKey((e.target as HTMLSelectElement).value)!,
                        mode: song.key.mode,
                      },
                    })
                  }
                >
                  {KEYS.map((k) => (
                    <option key={k} value={k}>
                      {k.replace("b", "♭")}
                    </option>
                  ))}
                </select>{" "}
                <select
                  name="mode"
                  value={song.key.mode}
                  onChange={(e) =>
                    update({
                      ...song,
                      key: {
                        ...song.key,
                        mode: (e.target as HTMLSelectElement).value as Mode,
                      } as Key,
                    })
                  }
                >
                  {MODES.map((x) => (
                    <option key={x.mode} value={x.mode}>
                      {x.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Time{" "}
                <select
                  name="meter"
                  value={song.meter}
                  onChange={(e) =>
                    update({
                      ...song,
                      meter: (e.target as HTMLSelectElement).value as EditorSong["meter"],
                    })
                  }
                >
                  {["4/4", "2/4", "3/4", "2/2"].map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </label>
              <span class="setting-help">{formatKey(song.key)}</span>
            </div>
          </section>

          <section>
            <div class="measure-strip" role="tablist" aria-label="Measures">
              {song.measures.map((x, i) => (
                <button
                  key={i}
                  role="tab"
                  aria-selected={i === current}
                  class={i === current ? "plain-button on" : "plain-button"}
                  data-measure-tab={i + 1}
                  onClick={() => setCurrent(i)}
                >
                  {i + 1}
                  {usedEighths(x) < full ? " …" : ""}
                </button>
              ))}
              <button
                class="plain-button"
                data-action="add-measure"
                onClick={() => {
                  const chord = m.chords[m.chords.length - 1]?.chord ?? "G";
                  update({
                    ...song,
                    measures: [...song.measures, { notes: [], chords: [{ atSlot: 0, chord }] }],
                  });
                  setCurrent(song.measures.length);
                }}
              >
                + Measure
              </button>
            </div>

            <h3>
              Measure {current + 1}{" "}
              <span class="setting-help">
                {left === 0 ? "full" : `room for ${left} eighth${left === 1 ? "" : "s"}`}
              </span>
            </h3>
            <ol class="note-list" data-testid="note-list">
              {m.notes.map((n, i) => (
                <li key={i}>{noteLabel(n)}</li>
              ))}
              {m.notes.length === 0 && <li class="setting-help">No notes yet</li>}
            </ol>

            <div class="note-pad">
              <div class="segmented" role="group" aria-label="Length">
                {LENGTHS.filter((l) => l.eighths <= full).map((l) => (
                  <button
                    key={l.eighths}
                    name="length"
                    class={length === l.eighths ? "on" : ""}
                    aria-pressed={length === l.eighths}
                    onClick={() => setLength(l.eighths)}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              <div class="segmented" role="group" aria-label="Sharp or flat">
                {(
                  [
                    ["key", "As the key"],
                    [-1, "♭"],
                    [0, "♮"],
                    [1, "♯"],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={String(v)}
                    name="accidental"
                    class={accidental === v ? "on" : ""}
                    aria-pressed={accidental === v}
                    onClick={() => setAccidental(v)}
                  >
                    {label}
                  </button>
                ))}
                <button
                  name="octave"
                  class={octave >= 5 ? "on" : ""}
                  aria-pressed={octave >= 5}
                  onClick={() => setOctave(octave >= 5 ? 4 : 5)}
                >
                  High octave
                </button>
              </div>
              <div class="letter-pad">
                {LETTERS.map((l) => (
                  <button
                    key={l}
                    class="big-button letter"
                    data-note={l}
                    disabled={!fits(song, m, length)}
                    onClick={() => addNote(l, length)}
                  >
                    {l}
                  </button>
                ))}
                <button
                  class="big-button letter"
                  data-note="rest"
                  disabled={!fits(song, m, length)}
                  onClick={() => addNote(null, length)}
                >
                  Rest
                </button>
              </div>
              <div class="button-row">
                <button
                  class="plain-button"
                  data-action="delete-note"
                  disabled={m.notes.length === 0}
                  onClick={() => setMeasure({ ...m, notes: m.notes.slice(0, -1) })}
                >
                  Delete last note
                </button>
                <button
                  class="plain-button"
                  data-action="delete-measure"
                  disabled={song.measures.length <= 1}
                  onClick={() => {
                    update({ ...song, measures: song.measures.filter((_, i) => i !== current) });
                    setCurrent(Math.max(0, current - 1));
                  }}
                >
                  Delete this measure
                </button>
              </div>
            </div>

            <h3>Chord</h3>
            <div class="loop-row">
              <ChordPicker
                name="chord1"
                value={m.chords.find((c) => c.atSlot === 0)?.chord}
                onChange={(chord) =>
                  setMeasure({
                    ...m,
                    chords: [{ atSlot: 0, chord }, ...m.chords.filter((c) => c.atSlot !== 0)],
                  })
                }
              />
              {m.chords.some((c) => c.atSlot > 0) ? (
                <>
                  <span>then</span>
                  <ChordPicker
                    name="chord2"
                    value={m.chords.find((c) => c.atSlot > 0)?.chord}
                    onChange={(chord) =>
                      setMeasure({
                        ...m,
                        chords: [
                          ...m.chords.filter((c) => c.atSlot === 0),
                          { atSlot: full / 2, chord },
                        ],
                      })
                    }
                  />
                  <button
                    class="plain-button"
                    onClick={() =>
                      setMeasure({ ...m, chords: m.chords.filter((c) => c.atSlot === 0) })
                    }
                  >
                    One chord
                  </button>
                </>
              ) : (
                <button
                  class="plain-button"
                  data-action="split-measure"
                  onClick={() =>
                    setMeasure({
                      ...m,
                      chords: [
                        ...(m.chords.length ? m.chords : [{ atSlot: 0, chord: "G" }]),
                        { atSlot: full / 2, chord: m.chords[0]?.chord ?? "G" },
                      ],
                    })
                  }
                >
                  Change chord halfway
                </button>
              )}
            </div>

            <h3>Roll</h3>
            <select
              name="roll"
              value={m.roll ?? ""}
              onChange={(e) => {
                const roll = (e.target as HTMLSelectElement).value;
                const base: EditorMeasure = { notes: m.notes, chords: m.chords };
                setMeasure(roll ? { ...base, roll } : base);
              }}
            >
              <option value="">Chosen by the app</option>
              {ROLLS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            {problem && (
              <p class="song-note warn" role="status" data-testid="roll-problem">
                {problem.message}.
              </p>
            )}
          </section>
        </>
      )}

      <section>
        <h3>Tab preview</h3>
        {previewMeasures && previewMeasures.length > 0 ? (
          <TabSvg
            p={layoutTabLine(previewMeasures, evenGeometry(previewMeasures, 700, 30), 700, {
              scale: 1,
              showRollNames: true,
              showAccents: false,
              showChords: true,
              fretNumbering: "actual",
              showMeasureNumber: true,
              lineStart: 0,
            })}
            highlight={current + 1}
            label="Tab preview"
          />
        ) : (
          <p class="setting-help">{live.error ?? "Add some notes to see the tab."}</p>
        )}
        <div class="button-row">
          <button
            class="plain-button"
            data-action="toggle-abc"
            onClick={() => {
              if (!abcMode) setAbcText(toAbc(song));
              setAbcMode(!abcMode);
            }}
          >
            {abcMode ? "Back to the note buttons" : "Edit ABC (for Jeff)"}
          </button>
        </div>
        {abcMode && existing?.editor !== undefined && (
          <p class="setting-help">
            Saving from the ABC view keeps the text; the note buttons start over from it.
          </p>
        )}
      </section>
    </div>
  );
}

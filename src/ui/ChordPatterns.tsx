// F46 · Saved chord patterns for the roll exercises. A bar above the exercise says which chords
// are in use ("Chords: D7 version") and opens a sheet where he can save the chords he has chosen
// under a name, load a saved pattern, update it, rename it or delete it. Only the full exercise
// has this: sheet music has its own chords, written in the song.

import { useEffect, useRef, useState } from "preact/hooks";
import type { AppStore } from "../app/store.ts";
import { patternSummary, sameChords } from "../core/banjo/chordPatterns.ts";
import type { ChordPattern } from "../core/banjo/chordPatterns.ts";

/** What the bar says: the pattern in use, or whether the chords are the exercise's own. */
export function patternLabel(
  patterns: readonly ChordPattern[],
  active: string | null,
  current: Readonly<Record<string, string>>,
): { name: string; changed: boolean } {
  const pattern = patterns.find((p) => p.id === active);
  if (pattern) return { name: pattern.name, changed: !sameChords(pattern.chords, current) };
  return { name: Object.keys(current).length === 0 ? "standard" : "your own", changed: false };
}

export function ChordPatterns({ store }: { store: AppStore }) {
  const [open, setOpen] = useState(false);
  const s = store.settings.value;
  const label = patternLabel(s.chordPatterns, s.activeChordPattern, s.exerciseChords);
  return (
    <>
      <div class="pattern-bar" data-testid="pattern-bar">
        <span class="pattern-name">
          Chords: <strong data-testid="pattern-name">{label.name}</strong>
          {label.changed && <span class="pattern-changed"> (changed)</span>}
        </span>
        <button
          type="button"
          class="plain-button"
          data-action="patterns-open"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
        >
          Chord patterns ▾
        </button>
      </div>
      {open && <PatternSheet store={store} onClose={() => setOpen(false)} />}
    </>
  );
}

function PatternSheet({ store, onClose }: { store: AppStore; onClose: () => void }) {
  const s = store.settings.value;
  const label = patternLabel(s.chordPatterns, s.activeChordPattern, s.exerciseChords);
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), [renaming]);

  const submit = () => {
    const why =
      renaming !== null ? store.renameChordPattern(renaming, name) : store.saveChordPattern(name);
    setProblem(why);
    if (why === null) {
      setName("");
      setRenaming(null);
    }
  };
  const active = s.chordPatterns.find((p) => p.id === s.activeChordPattern);

  return (
    <div class="chord-sheet-backdrop" onClick={onClose} data-testid="pattern-sheet-backdrop">
      <div
        class="chord-sheet pattern-sheet"
        role="dialog"
        aria-label="Chord patterns"
        data-testid="pattern-sheet"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        <p class="chord-sheet-title">Chord patterns for the roll exercises</p>

        <form
          class="pattern-save"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label class="pattern-label" for="pattern-name-input">
            {renaming !== null ? "New name" : "Save the chords now showing as"}
          </label>
          <div class="pattern-save-row">
            <input
              id="pattern-name-input"
              ref={input}
              class="pattern-input"
              type="text"
              maxLength={40}
              placeholder="For example: D7 version"
              value={name}
              onInput={(e) => {
                setName((e.target as HTMLInputElement).value);
                setProblem(null);
              }}
            />
            <button type="submit" class="plain-button on" data-action="pattern-save">
              {renaming !== null ? "Rename" : "Save"}
            </button>
            {renaming !== null && (
              <button
                type="button"
                class="plain-button"
                data-action="pattern-cancel-rename"
                onClick={() => {
                  setRenaming(null);
                  setName("");
                  setProblem(null);
                }}
              >
                Cancel
              </button>
            )}
          </div>
          {problem && (
            <p class="pattern-problem" role="alert" data-testid="pattern-problem">
              {problem}
            </p>
          )}
        </form>

        {active && label.changed && (
          <button
            type="button"
            class="big-button"
            data-action="pattern-update"
            onClick={() => store.updateChordPattern()}
          >
            Update “{active.name}” with these chords
          </button>
        )}

        <ul class="pattern-list" aria-label="Saved patterns">
          <li class="pattern-row">
            <button
              type="button"
              class={
                s.activeChordPattern === null && Object.keys(s.exerciseChords).length === 0
                  ? "pattern-load on"
                  : "pattern-load"
              }
              data-pattern="standard"
              onClick={() => {
                store.loadChordPattern(null);
                onClose();
              }}
            >
              <span class="pattern-load-name">Standard chords</span>
              <span class="pattern-load-chords">{patternSummary({})}</span>
            </button>
          </li>
          {s.chordPatterns.map((p) => (
            <li class="pattern-row" key={p.id}>
              <button
                type="button"
                class={p.id === s.activeChordPattern ? "pattern-load on" : "pattern-load"}
                data-pattern={p.id}
                aria-pressed={p.id === s.activeChordPattern}
                onClick={() => {
                  store.loadChordPattern(p.id);
                  onClose();
                }}
              >
                <span class="pattern-load-name">{p.name}</span>
                <span class="pattern-load-chords">{patternSummary(p.chords)}</span>
              </button>
              <button
                type="button"
                class="row-action"
                aria-label={`Rename ${p.name}`}
                data-pattern-rename={p.id}
                onClick={() => {
                  setRenaming(p.id);
                  setName(p.name);
                  setProblem(null);
                }}
              >
                ✎
              </button>
              <button
                type="button"
                class="row-action"
                aria-label={`Delete ${p.name}`}
                data-pattern-delete={p.id}
                onClick={() => {
                  if (window.confirm(`Delete the pattern "${p.name}"?`)) {
                    store.deleteChordPattern(p.id);
                    if (renaming === p.id) setRenaming(null);
                  }
                }}
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
        {s.chordPatterns.length === 0 && (
          <p class="pattern-empty">
            Nothing saved yet. Choose the chords you want in the exercise, then save them here.
          </p>
        )}

        <button class="big-button secondary" data-action="pattern-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

// F45 · Changing the chord of one measure of a roll exercise. He touches the chord letter above
// the measure and this sheet slides up with the chords of the key to choose from. The measure's
// chord changes and its roll is arranged again to fit it. The choice is saved with his settings.

import { useEffect, useRef } from "preact/hooks";
import { EXERCISE_CHORD_CHOICES, exerciseChordAt } from "../core/banjo/exercises.ts";
import type { AppStore } from "../app/store.ts";

export function ChordSheet({
  store,
  position,
  display,
  onClose,
}: {
  store: AppStore;
  /** Which measure of the exercise (0-based), shown to him 1-based. */
  position: number;
  /** A chord (as G-shape name) written the way the notation writes it in the current key. */
  display: (shapeName: string) => string;
  onClose: () => void;
}) {
  const chosen = store.settings.value.exerciseChords;
  const current = exerciseChordAt(chosen, position);
  const listRef = useRef<HTMLDivElement>(null);

  // Bring the current chord to the middle of the list.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[aria-pressed="true"]')
      ?.scrollIntoView?.({ block: "center" });
  }, [position]);

  const choose = (chord: string) => {
    store.updateSettings({ exerciseChords: { ...chosen, [String(position)]: chord } });
    onClose();
  };

  return (
    <div class="chord-sheet-backdrop" onClick={onClose} data-testid="chord-sheet-backdrop">
      <div
        class="chord-sheet"
        role="dialog"
        aria-label={`Choose the chord for measure ${position + 1}`}
        data-testid="chord-sheet"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        <p class="chord-sheet-title">Measure {position + 1}: slide, then touch a chord</p>
        <div class="chord-list" ref={listRef}>
          {EXERCISE_CHORD_CHOICES.map((o) => (
            <button
              key={o.chord}
              class={current === o.chord ? "chord-option on" : "chord-option"}
              data-chord={o.chord}
              aria-pressed={current === o.chord}
              onClick={() => choose(o.chord)}
            >
              <span class="chord-option-name">{display(o.chord)}</span>
              <span class="chord-option-degree">{o.degree}</span>
            </button>
          ))}
        </div>
        <button class="big-button secondary" data-action="chord-sheet-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

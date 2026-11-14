// F36 / F37 · The roll lesson, shown above a roll exercise: the roll as three finger lanes, taught
// in two halves of four, with four steps of fading help. Dad moves between steps himself (swipe,
// Back / Next, or the dots); the app can't hear him play, so it never judges or nudges.
// Everything drawn comes from core/learning.

import { signal } from "@preact/signals";
import { useRef, useState } from "preact/hooks";
import type { AppStore } from "../app/store.ts";
import { rollById } from "../core/banjo/rolls.ts";
import type { Finger } from "../core/banjo/types.ts";
import { FINGER_NAME } from "../core/banjo/types.ts";
import { listenCue } from "../core/learning/cues.ts";
import type { FadeLevel } from "../core/learning/fade.ts";
import { stepLevel } from "../core/learning/fade.ts";
import { FADE_LEVEL_NAME, lessonCells } from "../core/learning/lesson.ts";
import { fadeFor } from "../core/learning/progress.ts";

const LANES: readonly Finger[] = ["T", "I", "M"];

export const EXERCISE_PREFIX = "exercise:";

/** Whether the lesson is folded away so he can play with just the tab (this visit only). */
const folded = signal(false);

export function RollLesson({ store, rollId }: { store: AppStore; rollId: string }) {
  const roll = rollById(rollId);
  const [reveal, setReveal] = useState(false);
  if (!roll) return null;
  const fade = fadeFor(store.learning.value, roll.id);
  const cells = lessonCells(roll, fade.level, reveal);
  const swipeFrom = useRef<{ x: number; y: number } | null>(null);
  const go = (level: FadeLevel) => {
    if (level === fade.level) return;
    setReveal(false);
    store.setRollStep(roll.id, level);
  };
  const onPointerUp = (e: PointerEvent) => {
    const from = swipeFrom.current;
    swipeFrom.current = null;
    if (!from) return;
    const dx = e.clientX - from.x;
    const dy = e.clientY - from.y;
    // A clear sideways swipe; a mostly-vertical drag is just scrolling the page.
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    go(stepLevel(fade.level, dx < 0 ? 1 : -1));
  };

  return (
    <section
      class="lesson"
      aria-label={`Learn the ${roll.name} roll`}
      data-testid="roll-lesson"
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        swipeFrom.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (swipeFrom.current = null)}
    >
      <header class="lesson-head">
        <h3>Learn the {roll.name} roll</h3>
        {!folded.value && (
          <p class="lesson-step" data-testid="lesson-step">
            Step {fade.level} of 4 · {FADE_LEVEL_NAME[fade.level]}
          </p>
        )}
        <button
          type="button"
          class="lesson-fold"
          data-action="lesson-fold"
          aria-expanded={!folded.value}
          aria-label={folded.value ? "Show the lesson" : "Hide the lesson"}
          onClick={() => {
            folded.value = !folded.value;
          }}
        >
          {folded.value ? "▼" : "▲"}
        </button>
      </header>

      {!folded.value && (
        <>
          <div class="lanes" role="group" aria-label="Which finger plays each note">
            <div class="lane-labels" aria-hidden="true">
              {LANES.map((f) => (
                <span key={f} class="lane-label">
                  {FINGER_NAME[f]}
                </span>
              ))}
              <span class="lane-label lane-label-string">String</span>
              <span class="lane-label lane-label-slot">Note</span>
            </div>
            <ol class="lane-notes">
              {cells.map((c) => (
                <li
                  key={c.slot}
                  class={`lane-note${c.half === 1 ? " second-half" : ""}${c.slot === 4 ? " half-start" : ""}`}
                  aria-label={`Note ${c.slot + 1}: ${
                    c.finger ? FINGER_NAME[c.finger] : "finger hidden"
                  }${c.string ? `, string ${c.string}` : ""}`}
                >
                  {LANES.map((f) => (
                    <span key={f} class="lane-cell">
                      {c.finger === f && <span class={`badge badge-${f}`}>{f}</span>}
                      {c.finger === null && f === "I" && <span class="badge badge-hidden">?</span>}
                    </span>
                  ))}
                  <span class="lane-string">{c.string ?? "?"}</span>
                  <span class={c.accent ? "lane-slot accent" : "lane-slot"}>{c.slot + 1}</span>
                </li>
              ))}
            </ol>
          </div>

          <p class="lesson-rule">
            {cells.map((c) => c.finger ?? "?").join(" ")}{" "}
            <span class="lesson-use">· {roll.use}</span>
          </p>
          <p class="lesson-cue">{listenCue(roll)}</p>
          <nav class="lesson-nav" aria-label="Lesson steps">
            <button
              type="button"
              class="lesson-button lesson-prev"
              data-action="lesson-prev"
              disabled={fade.level === 1}
              onClick={() => go(stepLevel(fade.level, -1))}
            >
              ‹ Back
            </button>
            <span class="lesson-dots">
              {([1, 2, 3, 4] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  class="dot-button"
                  data-action={`lesson-step-${n}`}
                  aria-label={`Step ${n}: ${FADE_LEVEL_NAME[n]}`}
                  aria-current={n === fade.level ? "step" : undefined}
                  onClick={() => go(n)}
                >
                  <span class={n <= fade.level ? "dot on" : "dot"} />
                </button>
              ))}
            </span>
            <button
              type="button"
              class="lesson-button lesson-next"
              data-action="lesson-next"
              disabled={fade.level === 4}
              onClick={() => go(stepLevel(fade.level, 1))}
            >
              Next ›
            </button>
          </nav>
          <p class="lesson-extra">
            <span class="lesson-hint">Swipe, or use Back and Next, to hide more or less help.</span>
            <button
              type="button"
              class="plain-button"
              data-action="lesson-reveal"
              aria-pressed={reveal}
              onClick={() => setReveal(!reveal)}
            >
              {reveal ? "Hide the answer" : "Peek"}
            </button>
          </p>
        </>
      )}
    </section>
  );
}

// F36 / F37 · The roll lesson, shown above a roll exercise: the roll as three finger lanes, taught
// in two halves of four, with help that fades as Dad rates his own passes ("Got it" / "Again").
// The app can't hear him play, so he decides. Everything drawn comes from core/learning.

import { useState } from "preact/hooks";
import type { AppStore } from "../app/store.ts";
import { rollById } from "../core/banjo/rolls.ts";
import type { Finger } from "../core/banjo/types.ts";
import { FINGER_NAME } from "../core/banjo/types.ts";
import { listenCue } from "../core/learning/cues.ts";
import { GOT_IT_TO_ADVANCE } from "../core/learning/fade.ts";
import { FADE_LEVEL_NAME, lessonCells } from "../core/learning/lesson.ts";
import { fadeFor } from "../core/learning/progress.ts";

const LANES: readonly Finger[] = ["T", "I", "M"];

export const EXERCISE_PREFIX = "exercise:";

export function RollLesson({ store, rollId }: { store: AppStore; rollId: string }) {
  const roll = rollById(rollId);
  const [reveal, setReveal] = useState(false);
  if (!roll) return null;
  const fade = fadeFor(store.learning.value, roll.id);
  const cells = lessonCells(roll, fade.level, reveal);
  const steady = fade.level === 4 && fade.gotItRun >= GOT_IT_TO_ADVANCE;
  const rate = (r: "got-it" | "again") => {
    setReveal(false);
    store.rateRollPass(roll.id, r);
  };

  return (
    <section class="lesson" aria-label={`Learn the ${roll.name} roll`} data-testid="roll-lesson">
      <header class="lesson-head">
        <h3>Learn the {roll.name} roll</h3>
        <p class="lesson-step" data-testid="lesson-step">
          <span class="lesson-dots" aria-hidden="true">
            {[1, 2, 3, 4].map((n) => (
              <span key={n} class={n <= fade.level ? "dot on" : "dot"} />
            ))}
          </span>
          Step {fade.level} of 4 · {FADE_LEVEL_NAME[fade.level]}
          {steady && <strong class="lesson-steady"> · Steady</strong>}
        </p>
      </header>

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
        {cells.map((c) => c.finger ?? "?").join(" ")} <span class="lesson-use">· {roll.use}</span>
      </p>
      <p class="lesson-cue">{listenCue(roll)}</p>
      <p class="lesson-ask">Play it, then tell the app how it went.</p>

      <div class="lesson-buttons">
        <button
          type="button"
          class="lesson-button lesson-again"
          data-action="lesson-again"
          onClick={() => rate("again")}
        >
          Again
        </button>
        <button
          type="button"
          class="lesson-button lesson-got-it"
          data-action="lesson-got-it"
          onClick={() => rate("got-it")}
        >
          Got it
        </button>
      </div>
      <p class="lesson-extra">
        <button
          type="button"
          class="plain-button"
          data-action="lesson-reveal"
          aria-pressed={reveal}
          onClick={() => setReveal(!reveal)}
        >
          {reveal ? "Hide the answer" : "Show me"}
        </button>
        <button
          type="button"
          class="plain-button"
          data-action="lesson-reset"
          onClick={() => {
            setReveal(false);
            store.resetRollLesson(roll.id);
          }}
        >
          Start over
        </button>
      </p>
    </section>
  );
}

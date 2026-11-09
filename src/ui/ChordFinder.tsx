// F16 chord finder and fretboard (DEVELOPMENT.md F16): pick any chord, step through C7's
// voicings (open shapes first), and hear each one strummed or picked, using the exact frets
// and the current capo. Opened from the toolbar or by tapping a chord symbol in the notation.

import { useMemo, useState } from "preact/hooks";
import type { Player } from "../app/player.ts";
import type { AppStore } from "../app/store.ts";
import { strumNotes, voicings } from "../core/banjo/voicings.ts";
import type { Voicing } from "../core/banjo/voicings.ts";
import type { CapoPlan } from "../core/banjo/tuning.ts";
import { actualFret, capoPlan, FIFTH_STRING_NUT } from "../core/banjo/tuning.ts";
import { formatChord, parseChord, QUALITIES } from "../core/music/chords.ts";

const ROOTS = ["C", "C#", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const FRETS = 17;
const MARKERS = [3, 5, 7, 10, 12, 15, 17];

function Neck({
  voicing,
  plan,
  spikes,
}: {
  voicing: Voicing | null;
  plan: CapoPlan;
  spikes: readonly number[];
}) {
  const w = 760;
  const h = 150;
  const left = 34;
  const fretW = (w - left - 10) / FRETS;
  const top = 18;
  const gap = (h - top - 14) / 4;
  const y = (s: number) => top + (s - 1) * gap; // string 1 on top, like the tab
  const x = (fret: number) => left + (fret - 0.5) * fretW; // between fret wires
  const wire = (fret: number) => left + fret * fretW;
  const capo = plan.capo;
  return (
    <svg class="neck" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Banjo neck">
      {MARKERS.map((f) => (
        <circle key={f} class="neck-marker" cx={x(f)} cy={(y(2) + y(3)) / 2} r={4} />
      ))}
      {Array.from({ length: FRETS + 1 }, (_, f) => (
        <line
          key={f}
          class={f === 0 ? "neck-nut" : "neck-fret"}
          x1={wire(f)}
          x2={wire(f)}
          y1={y(1)}
          y2={y(f >= FIFTH_STRING_NUT ? 5 : 4)}
        />
      ))}
      {[1, 2, 3, 4].map((s) => (
        <line key={s} class="neck-string" x1={wire(0)} x2={wire(FRETS)} y1={y(s)} y2={y(s)} />
      ))}
      {/* The 5th string starts at the 5th fret. */}
      <line class="neck-string" x1={wire(FIFTH_STRING_NUT)} x2={wire(FRETS)} y1={y(5)} y2={y(5)} />
      {spikes.map((f) => (
        <rect key={f} class="neck-spike" x={wire(f) - 2} y={y(5) - 7} width={4} height={6} />
      ))}
      {capo > 0 && (
        <rect
          class="neck-capo"
          x={wire(capo) - 4}
          y={y(1) - 8}
          width={8}
          height={y(4) - y(1) + 16}
          rx={3}
        />
      )}
      {[1, 2, 3, 4, 5].map((s) => (
        <text key={s} class="neck-label" x={8} y={y(s) + 4}>
          {s}
        </text>
      ))}
      {voicing &&
        voicing.frets.map((f, i) => {
          const s = i + 1;
          const actual = actualFret(s as 1 | 2 | 3 | 4, f, plan);
          if (f === 0) {
            return (
              <circle
                key={s}
                class="neck-open"
                cx={capo > 0 ? wire(capo) + 10 : wire(0) - 10}
                cy={y(s)}
                r={6}
              />
            );
          }
          return (
            <g key={s} class="neck-dot">
              <circle cx={x(actual)} cy={y(s)} r={9} />
              <text x={x(actual)} y={y(s) + 4}>
                {actual}
              </text>
            </g>
          );
        })}
      <circle class="neck-open drone" cx={wire(FIFTH_STRING_NUT) - 10} cy={y(5)} r={6} />
    </svg>
  );
}

export function ChordFinder({ store, player }: { store: AppStore; player: Player }) {
  const initial = parseChord(store.chordFinder.value ?? "G");
  const [root, setRoot] = useState(
    initial
      ? initial.root.letter +
          (initial.root.accidental > 0 ? "#" : initial.root.accidental < 0 ? "b" : "")
      : "G",
  );
  const [quality, setQuality] = useState(initial?.quality.id ?? QUALITIES[0]!.id);
  const [index, setIndex] = useState(0);
  const settings = store.settings.value;
  // The capo from the open song's practice key, so shapes match what Dad is playing.
  const plan = player.plan()?.capo ?? capoPlan(0, settings.spikes);
  const chord = parseChord(
    `${root}${
      QUALITIES.find((q) => q.id === quality)
        ?.symbol.replace("♭", "b")
        .replace("♯", "#") ?? ""
    }`,
  );
  const list = useMemo(
    () => (chord ? voicings(chord, { plan }) : []),
    [root, quality, plan.capo, plan.fifth.semitones],
  );
  const v = list[Math.min(index, list.length - 1)] ?? null;

  return (
    <div
      class="settings-page chord-finder"
      role="dialog"
      aria-modal="true"
      aria-label="Chord finder"
    >
      <header class="settings-head">
        <h2>Chord finder</h2>
        <button class="big-button" onClick={() => (store.chordFinder.value = null)}>
          Done
        </button>
      </header>
      <section>
        <div class="chord-pick">
          <label>
            Root{" "}
            <select
              name="root"
              value={root}
              onChange={(e) => {
                setRoot((e.target as HTMLSelectElement).value);
                setIndex(0);
              }}
            >
              {ROOTS.map((r) => (
                <option key={r} value={r}>
                  {r.replace("#", "♯").replace("b", "♭")}
                </option>
              ))}
            </select>
          </label>
          <label>
            Type{" "}
            <select
              name="quality"
              value={quality}
              onChange={(e) => {
                setQuality((e.target as HTMLSelectElement).value);
                setIndex(0);
              }}
            >
              {QUALITIES.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.symbol === "" ? "major" : q.symbol}
                </option>
              ))}
            </select>
          </label>
          <strong class="chord-name" data-testid="chord-name">
            {chord ? formatChord(chord) : "?"}
          </strong>
        </div>
        {plan.capo > 0 && <p class="setting-help">Shown with capo {plan.capo}, as for the song.</p>}
        <Neck voicing={v} plan={plan} spikes={settings.spikes} />
        {v ? (
          <>
            <p class="voicing-info" data-testid="voicing-info">
              Shape {Math.min(index, list.length - 1) + 1} of {list.length}
              {v.shape
                ? ` · ${v.shape}`
                : v.position === 0
                  ? " · open"
                  : ` · fret ${v.position + plan.capo}`}
              {v.noThird ? " · no 3rd" : ""} · 5th string {v.fifthString}
              <br />
              Frets (4th to 1st string):{" "}
              {[3, 2, 1, 0]
                .map((i) => actualFret((i + 1) as 1 | 2 | 3 | 4, v.frets[i]!, plan))
                .join(" ")}
            </p>
            <div class="button-row">
              <button
                class="plain-button"
                data-action="prev-voicing"
                disabled={index <= 0}
                onClick={() => setIndex(index - 1)}
              >
                ◀ Previous shape
              </button>
              <button
                class="plain-button"
                data-action="next-voicing"
                disabled={index >= list.length - 1}
                onClick={() => setIndex(index + 1)}
              >
                Next shape ▶
              </button>
              <button
                class="plain-button"
                data-action="strum"
                onClick={() => void player.playChord(strumNotes(v, { plan }), "strum")}
              >
                Strum
              </button>
              <button
                class="plain-button"
                data-action="pick"
                onClick={() => void player.playChord(strumNotes(v, { plan }), "pick")}
              >
                Pick one string at a time
              </button>
            </div>
          </>
        ) : (
          <p>No playable shape for this chord.</p>
        )}
      </section>
    </div>
  );
}

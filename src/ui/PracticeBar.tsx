// The practice row of the toolbar (F1): Play/Stop, Restart, Auto-repeat, tempo, key and part
// toggles, always visible. Less-used controls (volumes, metronome, loop, speed builder) are in
// panels that open under the toolbar.

import { useRef, useState } from "preact/hooks";
import type { Player } from "../app/player.ts";
import type { AppStore } from "../app/store.ts";
import type { MetronomeMode, PartId, PracticePrefs } from "../app/model.ts";
import { DEFAULT_TEMPO, TEMPO_MAX, TEMPO_MIN } from "../app/model.ts";
import { MELODY_INSTRUMENTS } from "../audio/engine.ts";
import { planFor } from "../core/banjo/position.ts";
import { transposeKey } from "../core/music/spelling.ts";
import { songParts } from "../core/playback/parts.ts";
import { formatKey } from "../core/music/keys.ts";

const PART_LABEL: Readonly<Record<PartId, string>> = {
  melody: "Melody",
  chords: "Chords",
  banjo: "Banjo",
};
const METRONOME_LABEL: Readonly<Record<MetronomeMode, string>> = {
  off: "Click off",
  "count-in": "Count-in",
  throughout: "Click on",
};
const NEXT_METRONOME: Readonly<Record<MetronomeMode, MetronomeMode>> = {
  off: "count-in",
  "count-in": "throughout",
  throughout: "off",
};

type Panel = "none" | "tempo" | "parts" | "loop";

/** A short vertical volume slider (0–100%) under a part's button. */
function VolumeSlider({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <span class="vslider-wrap">
      <input
        type="range"
        name={name}
        aria-label={label}
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onInput={(e) => onChange(Number((e.target as HTMLInputElement).value) / 100)}
      />
    </span>
  );
}

function clampTempo(n: number): number {
  return Math.max(TEMPO_MIN, Math.min(TEMPO_MAX, Math.round(n)));
}

/** F9: a tap changes by 1; holding the button changes by 5 every 300 ms. */
function useHoldStep(apply: (step: number) => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  return (sign: 1 | -1) => ({
    onPointerDown: () => {
      held.current = false;
      clear();
      const repeat = () => {
        held.current = true;
        apply(5 * sign);
        timer.current = setTimeout(repeat, 300);
      };
      timer.current = setTimeout(repeat, 500);
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onClick: () => {
      clear();
      if (!held.current) apply(sign);
      held.current = false;
    },
  });
}

/** F33: tap 4 or more times to set the tempo from the average gap. */
function useTapTempo(onTempo: (bpm: number) => void) {
  const taps = useRef<number[]>([]);
  return () => {
    const now = performance.now();
    const recent = taps.current.filter((t) => now - t < 2500);
    recent.push(now);
    taps.current = recent.slice(-6);
    if (taps.current.length >= 4) {
      const gaps = taps.current.slice(1).map((t, i) => t - taps.current[i]!);
      const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      if (avg > 0) onTempo(clampTempo(60000 / avg));
    }
    return taps.current.length;
  };
}

export function PracticeBar({ store, player }: { store: AppStore; player: Player }) {
  const [panel, setPanel] = useState<Panel>("none");
  const loaded = player.song();
  const p = store.practice.value;
  const state = player.state.value;
  const follow = player.follow.value;
  const settings = store.settings.value;
  const [tapCount, setTapCount] = useState(0);
  const tap = useTapTempo((bpm) => store.updatePractice({ tempoBpm: bpm }));
  const nudge = useHoldStep((delta) => {
    const current =
      store.practice.peek().tempoBpm ?? player.song()?.index.tempoBpm ?? DEFAULT_TEMPO;
    store.updatePractice({ tempoBpm: clampTempo(current + delta) });
  });
  if (!loaded) return null;

  const songTempo = loaded.index.tempoBpm ?? DEFAULT_TEMPO;
  const tempo = p.tempoBpm ?? songTempo;
  const shownTempo = state !== "stopped" && p.speedBuilder.enabled ? follow.bpm : tempo;
  const playing = state !== "stopped";
  const set = (patch: Partial<PracticePrefs>) => store.updatePractice(patch);
  const allKeys = Array.from({ length: 12 }, (_, shift) => {
    const plan = planFor(transposeKey(loaded.index.key, shift), {
      arrangementShape: loaded.index.key,
      spikes: settings.spikes,
    });
    const name = formatKey(plan.soundingKey).replace(" major", "");
    const position = `${formatKey(plan.shapeKey).replace(" major", "")} position`;
    const capo = plan.capo.capo > 0 ? `capo ${plan.capo.capo}` : "";
    const where = plan.keepsTab ? capo : [position, capo].filter(Boolean).join(", ");
    return { shift, label: where ? `${name} (${where})` : name };
  });
  const measures = loaded.index.measures.map((m) => m.index);
  const toggle = (which: Panel) => setPanel(panel === which ? "none" : which);
  const step = player.step.value;
  const parts = songParts(loaded.song.abc, loaded.index);

  return (
    <>
      <div class="practice-bar" role="toolbar" aria-label="Playback">
        {step ? (
          <>
            <button class="tool" data-action="step-prev" onClick={() => void player.stepBy(-1)}>
              ◀ Back
            </button>
            <button class="tool play" data-action="step-next" onClick={() => void player.stepBy(1)}>
              Next note ▶
            </button>
            <button class="tool" data-action="step-exit" onClick={() => player.setStepMode(false)}>
              Done stepping
            </button>
          </>
        ) : (
          <button
            class={playing ? "tool play on" : "tool play"}
            data-action="play"
            aria-label={playing ? "Stop" : "Play"}
            onClick={() => void player.toggle()}
          >
            {state === "loading" ? "…" : playing ? "■ Stop" : "▶ Play"}
          </button>
        )}
        {playing && settings.visualMetronome && (
          <span class="beat-light" key={follow.beat} aria-hidden="true" />
        )}
        <button
          class="tool"
          data-action="restart"
          aria-label="Restart"
          onClick={() => player.restart()}
        >
          ⏮
        </button>
        <button
          class={p.autoRepeat ? "tool on" : "tool"}
          data-action="repeat"
          aria-pressed={p.autoRepeat}
          aria-label="Repeat"
          onClick={() => set({ autoRepeat: !p.autoRepeat })}
        >
          🔁
        </button>

        <div class="tempo" role="group" aria-label="Tempo">
          <button class="tool" data-action="slower" aria-label="Slower" {...nudge(-1)}>
            −
          </button>
          <button
            class={panel === "tempo" ? "tool tempo-value on" : "tool tempo-value"}
            data-action="tempo"
            aria-label={`Tempo ${shownTempo} beats per minute`}
            onClick={() => toggle("tempo")}
          >
            {shownTempo}
          </button>
          <button class="tool" data-action="faster" aria-label="Faster" {...nudge(1)}>
            +
          </button>
        </div>

        <select
          class="tool key-select"
          aria-label="Key"
          data-action="key"
          value={String(p.keyShift)}
          onChange={(e) => set({ keyShift: Number((e.target as HTMLSelectElement).value) })}
        >
          {allKeys.map(({ shift, label }) => (
            <option key={shift} value={String(shift)}>
              {label}
            </option>
          ))}
        </select>

        <div class="parts" role="group" aria-label="Parts and volumes">
          {(["melody", "chords", "banjo"] as const).map((part) => (
            <div class="part-stack" key={part}>
              <button
                class={p.parts[part].on ? "tool chip on" : "tool chip"}
                data-part={part}
                aria-pressed={p.parts[part].on}
                onClick={() =>
                  set({
                    parts: { ...p.parts, [part]: { ...p.parts[part], on: !p.parts[part].on } },
                  })
                }
              >
                {PART_LABEL[part]}
              </button>
              <VolumeSlider
                label={`${PART_LABEL[part]} volume`}
                name={`mix-${part}`}
                value={p.parts[part].volume}
                onChange={(volume) =>
                  set({ parts: { ...p.parts, [part]: { ...p.parts[part], volume } } })
                }
              />
            </div>
          ))}
          <div class="part-stack">
            <button
              class={p.metronome === "off" ? "tool chip" : "tool chip on"}
              data-action="metronome"
              onClick={() => set({ metronome: NEXT_METRONOME[p.metronome] })}
            >
              {METRONOME_LABEL[p.metronome]}
            </button>
            <VolumeSlider
              label="Click volume"
              name="mix-click"
              value={p.clickVolume}
              onChange={(clickVolume) => set({ clickVolume })}
            />
          </div>
        </div>

        <button
          class={p.loop ? "tool on" : panel === "loop" ? "tool on" : "tool"}
          data-action="loop"
          onClick={() => toggle("loop")}
        >
          {p.loop
            ? `Loop ${Math.min(p.loop.from, p.loop.to)}–${Math.max(p.loop.from, p.loop.to)}`
            : "Loop"}
        </button>
        <button
          class={panel === "parts" ? "tool on" : "tool"}
          data-action="mixer"
          aria-label="More playback settings"
          onClick={() => toggle("parts")}
        >
          ⋯
        </button>
      </div>

      {panel !== "none" && (
        <div class="practice-panel" role="dialog" aria-label="Playback settings">
          {panel === "tempo" && (
            <section>
              <label class="slider-row">
                <span>Tempo {tempo}</span>
                <input
                  type="range"
                  name="tempo"
                  min={TEMPO_MIN}
                  max={TEMPO_MAX}
                  value={tempo}
                  onInput={(e) =>
                    set({ tempoBpm: clampTempo(Number((e.target as HTMLInputElement).value)) })
                  }
                />
              </label>
              <div class="button-row">
                {[60, 80, 100, 120].map((bpm) => (
                  <button key={bpm} class="plain-button" onClick={() => set({ tempoBpm: bpm })}>
                    {bpm}
                  </button>
                ))}
                <button
                  class="plain-button"
                  data-action="tap-tempo"
                  onClick={() => setTapCount(tap())}
                >
                  Tap {tapCount > 0 && tapCount < 4 ? `(${4 - tapCount} more)` : ""}
                </button>
                <button class="plain-button" onClick={() => set({ tempoBpm: null })}>
                  Song tempo ({songTempo})
                </button>
              </div>
              <h3>Speed builder</h3>
              <label class="setting-row">
                <span>Start slow and speed up a little each time through</span>
                <input
                  type="checkbox"
                  name="speedBuilder"
                  checked={p.speedBuilder.enabled}
                  onChange={(e) =>
                    set({
                      speedBuilder: {
                        ...p.speedBuilder,
                        enabled: (e.target as HTMLInputElement).checked,
                      },
                      ...((e.target as HTMLInputElement).checked && !p.loop
                        ? { autoRepeat: true }
                        : {}),
                    })
                  }
                />
              </label>
              {(["startBpm", "stepBpm", "targetBpm"] as const).map((field) => (
                <label class="setting-row" key={field}>
                  <span>
                    {
                      { startBpm: "Start at", stepBpm: "Add each time", targetBpm: "Stop at" }[
                        field
                      ]
                    }
                  </span>
                  <input
                    type="number"
                    name={field}
                    min={field === "stepBpm" ? 1 : TEMPO_MIN}
                    max={field === "stepBpm" ? 30 : TEMPO_MAX}
                    value={p.speedBuilder[field]}
                    onChange={(e) => {
                      const n = Number((e.target as HTMLInputElement).value);
                      if (Number.isFinite(n))
                        set({ speedBuilder: { ...p.speedBuilder, [field]: n } });
                    }}
                  />
                </label>
              ))}
              {playing && p.speedBuilder.enabled && (
                <p role="status">
                  {p.speedBuilder.startBpm} → {p.speedBuilder.targetBpm}, now {follow.bpm} (time{" "}
                  {follow.pass + 1})
                </p>
              )}
            </section>
          )}

          {panel === "parts" && (
            <section>
              <div class="button-row">
                <button
                  class="plain-button"
                  onClick={() =>
                    set({
                      parts: {
                        melody: { ...p.parts.melody, on: true },
                        chords: { ...p.parts.chords, on: true },
                        banjo: { ...p.parts.banjo, on: false },
                      },
                    })
                  }
                >
                  Play along (banjo off)
                </button>
                <button
                  class="plain-button"
                  onClick={() =>
                    set({
                      parts: {
                        melody: { ...p.parts.melody, on: true },
                        chords: { ...p.parts.chords, on: true },
                        banjo: { ...p.parts.banjo, on: true },
                      },
                    })
                  }
                >
                  Listen (everything on)
                </button>
              </div>
              {(["melody", "chords", "banjo"] as const).map((part) => (
                <label class="slider-row" key={part}>
                  <span>{PART_LABEL[part]} volume</span>
                  <input
                    type="range"
                    name={`volume-${part}`}
                    min={0}
                    max={100}
                    value={Math.round(p.parts[part].volume * 100)}
                    onInput={(e) =>
                      set({
                        parts: {
                          ...p.parts,
                          [part]: {
                            ...p.parts[part],
                            volume: Number((e.target as HTMLInputElement).value) / 100,
                          },
                        },
                      })
                    }
                  />
                </label>
              ))}
              <fieldset class="setting-row choice">
                <legend>Melody sound</legend>
                <div class="segmented">
                  {MELODY_INSTRUMENTS.map((m) => (
                    <button
                      key={m.id}
                      name="melodyInstrument"
                      class={store.settings.value.melodyInstrument === m.id ? "on" : ""}
                      aria-pressed={store.settings.value.melodyInstrument === m.id}
                      onClick={() => store.updateSettings({ melodyInstrument: m.id })}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </fieldset>
              {p.keyShift > 0 && (
                <fieldset class="setting-row choice">
                  <legend>Notation key with a capo</legend>
                  <div class="segmented">
                    {(
                      [
                        [
                          "sounding",
                          `As it sounds (${formatKey(transposeKey(loaded.index.key, p.keyShift)).replace(" major", "")})`,
                        ],
                        [
                          "shape",
                          `As the tab (${formatKey(loaded.index.key).replace(" major", "")})`,
                        ],
                      ] as const
                    ).map(([v, label]) => (
                      <button
                        key={v}
                        name="notationKey"
                        class={p.notationKey === v ? "on" : ""}
                        aria-pressed={p.notationKey === v}
                        onClick={() => set({ notationKey: v })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}
              <fieldset class="setting-row choice">
                <legend>Count-in</legend>
                <div class="segmented">
                  {([4, 8] as const).map((n) => (
                    <button
                      key={n}
                      name="countInBeats"
                      class={p.countInBeats === n ? "on" : ""}
                      aria-pressed={p.countInBeats === n}
                      onClick={() => set({ countInBeats: n })}
                    >
                      {n} clicks
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset class="setting-row choice">
                <legend>Click on</legend>
                <div class="segmented">
                  {(
                    [
                      ["every-beat", "Every beat"],
                      ["two-and-four", "Beats 2 and 4"],
                    ] as const
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      name="clickPattern"
                      class={p.clickPattern === v ? "on" : ""}
                      aria-pressed={p.clickPattern === v}
                      onClick={() => set({ clickPattern: v })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>
            </section>
          )}

          {panel === "loop" && (
            <section>
              {parts.length > 0 && (
                <div class="button-row">
                  {parts.map((part) => (
                    <button
                      key={part.label}
                      class={
                        p.loop?.from === part.from && p.loop.to === part.to
                          ? "plain-button on"
                          : "plain-button"
                      }
                      data-part-loop={part.label}
                      onClick={() => set({ loop: { from: part.from, to: part.to } })}
                    >
                      {part.label} part
                    </button>
                  ))}
                </div>
              )}
              <p>Or loop a few measures to work on a tricky passage.</p>
              <div class="loop-row">
                <label>
                  From{" "}
                  <select
                    name="loopFrom"
                    value={String(p.loop?.from ?? measures[0])}
                    onChange={(e) => {
                      const from = Number((e.target as HTMLSelectElement).value);
                      set({ loop: { from, to: Math.max(from, p.loop?.to ?? from) } });
                    }}
                  >
                    {measures.map((m) => (
                      <option key={m} value={String(m)}>
                        {m === 0 ? "pickup" : m}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  to{" "}
                  <select
                    name="loopTo"
                    value={String(p.loop?.to ?? measures[measures.length - 1])}
                    onChange={(e) => {
                      const to = Number((e.target as HTMLSelectElement).value);
                      set({ loop: { from: Math.min(p.loop?.from ?? to, to), to } });
                    }}
                  >
                    {measures.map((m) => (
                      <option key={m} value={String(m)}>
                        {m === 0 ? "pickup" : m}
                      </option>
                    ))}
                  </select>
                </label>
                {p.loop && (
                  <button
                    class="plain-button"
                    data-action="clear-loop"
                    onClick={() => set({ loop: null })}
                  >
                    Play the whole song
                  </button>
                )}
              </div>
              <fieldset class="setting-row choice">
                <legend>Pause between repeats</legend>
                <div class="segmented">
                  {([0, 1, 2, 4] as const).map((n) => (
                    <button
                      key={n}
                      name="loopGapBeats"
                      class={p.loopGapBeats === n ? "on" : ""}
                      aria-pressed={p.loopGapBeats === n}
                      onClick={() => set({ loopGapBeats: n })}
                    >
                      {n === 0 ? "None" : `${n} beat${n > 1 ? "s" : ""}`}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset class="setting-row choice">
                <legend>Echo: the app plays a phrase, then you play it back</legend>
                <div class="segmented">
                  {([0, 1, 2, 4] as const).map((n) => (
                    <button
                      key={n}
                      name="echoMeasures"
                      class={p.echoMeasures === n ? "on" : ""}
                      aria-pressed={p.echoMeasures === n}
                      onClick={() => set({ echoMeasures: n })}
                    >
                      {n === 0 ? "Off" : `${n} measure${n > 1 ? "s" : ""}`}
                    </button>
                  ))}
                </div>
              </fieldset>
              <button
                class="plain-button"
                data-action="step-mode"
                onClick={() => {
                  player.setStepMode(true);
                  setPanel("none");
                }}
              >
                Step through the notes one at a time
              </button>
            </section>
          )}
          <button class="big-button" onClick={() => setPanel("none")}>
            Done
          </button>
        </div>
      )}

      {settings.showFingerStrip && (playing || step) && follow.slot !== null && (
        <div class="finger-strip" aria-label="Next fingers">
          {player.upcomingFingers(8).map((f, i) => (
            <span key={f.key} class={i === 0 ? "strip-item now" : "strip-item"}>
              {f.finger.split("+").map((finger, j) => (
                <span key={j} class={`badge big badge-${finger}`}>
                  {finger}
                </span>
              ))}
            </span>
          ))}
        </div>
      )}

      {follow.countIn !== null && (
        <div class="count-in" aria-live="assertive">
          {follow.countIn}
        </div>
      )}
    </>
  );
}

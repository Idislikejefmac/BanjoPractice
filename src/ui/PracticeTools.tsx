// Practice tools (phase 6): F19 tuner, F21 practice log, F23 recording.

import { useEffect, useRef, useState } from "preact/hooks";
import type { Player } from "../app/player.ts";
import type { Services } from "../app/services.ts";
import type { AppStore } from "../app/store.ts";
import type { StringNo } from "../core/banjo/types.ts";
import { formatNoteName } from "../core/music/notes.ts";
import { spellInKey } from "../core/music/spelling.ts";
import { parseKey } from "../core/music/keys.ts";
import type { TunerReading } from "../core/tuner/pitch.ts";
import { detectPitch, readString, stringTargets } from "../core/tuner/pitch.ts";
import { capoPlan } from "../core/banjo/tuning.ts";
import { MicDeniedError } from "../platform/types.ts";

const G = parseKey("G")!;
const noteOf = (midi: number) => formatNoteName(spellInKey(midi, G));

function micMessage(e: unknown): string {
  return e instanceof MicDeniedError
    ? "The app isn't allowed to use the microphone. On the iPad: Settings → Safari → Microphone → Allow (or, for the Home Screen app, Settings → Banjo)."
    : "The microphone couldn't start. Close other apps that use it and try again.";
}

// --- F19 tuner -------------------------------------------------------------------------------

function Tuner({ services, player }: { services: Services; player: Player }) {
  const [reading, setReading] = useState<TunerReading | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [locked, setLocked] = useState<StringNo | null>(null);
  const [capoOn, setCapoOn] = useState(true);
  const stop = useRef<() => void>(() => {});
  const plan = capoOn ? (player.plan()?.capo ?? capoPlan(0)) : capoPlan(0);
  const targets = stringTargets(undefined, plan);

  const start = async () => {
    setError("");
    try {
      const stream = await services.mic.open();
      await services.audio.unlock();
      const graph = services.audio.graph();
      if (!graph) throw new Error("no audio");
      const ctx = graph.context as AudioContext;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      source.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      let frame = 0;
      const tick = () => {
        analyser.getFloatTimeDomainData(buf);
        const p = detectPitch(buf, ctx.sampleRate);
        if (p && p.clarity > 0.85) setReading(readString(p.hz, targets, locked ?? undefined));
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
      stop.current = () => {
        cancelAnimationFrame(frame);
        source.disconnect();
        services.mic.close();
        setRunning(false);
      };
      setRunning(true);
    } catch (e) {
      services.diagnostics.log("warning", `Tuner: ${e instanceof Error ? e.message : String(e)}`);
      setError(micMessage(e));
    }
  };
  useEffect(() => () => stop.current(), []);

  const cents = reading ? Math.max(-50, Math.min(50, reading.cents)) : 0;
  const inTune = reading !== null && Math.abs(reading.cents) <= 3;
  return (
    <section>
      <div class="segmented" role="group" aria-label="String">
        <button
          class={locked === null ? "on" : ""}
          aria-pressed={locked === null}
          onClick={() => setLocked(null)}
        >
          Any string
        </button>
        {targets.map((t) => (
          <button
            key={t.string}
            name="tuner-string"
            class={locked === t.string ? "on" : ""}
            aria-pressed={locked === t.string}
            onClick={() => setLocked(t.string)}
          >
            {t.string}: {noteOf(t.midi)}
          </button>
        ))}
      </div>
      {plan.capo > 0 || player.plan()?.capo.capo ? (
        <label class="setting-row">
          <span>Tune with the capo on (capo {player.plan()?.capo.capo ?? 0})</span>
          <input
            type="checkbox"
            checked={capoOn}
            onChange={(e) => setCapoOn((e.target as HTMLInputElement).checked)}
          />
        </label>
      ) : null}
      <div class={inTune ? "tuner-display in-tune" : "tuner-display"} data-testid="tuner-display">
        <div class="tuner-note">
          {reading ? `${reading.target.string}: ${noteOf(reading.target.midi)}` : "—"}
        </div>
        <svg viewBox="-60 -10 120 30" class="tuner-needle" aria-hidden="true">
          <line x1={-50} x2={50} y1={10} y2={10} class="needle-scale" />
          <line x1={0} x2={0} y1={2} y2={18} class="needle-center" />
          <line x1={cents} x2={cents} y1={-6} y2={18} class="needle" />
        </svg>
        <div class="tuner-cents">
          {reading
            ? inTune
              ? "In tune"
              : `${reading.cents > 0 ? "+" : ""}${Math.round(reading.cents)} cents ${reading.cents > 0 ? "(sharp)" : "(flat)"}`
            : "Play a string"}
        </div>
      </div>
      <div class="button-row">
        {running ? (
          <button class="big-button" onClick={() => stop.current()}>
            Stop tuner
          </button>
        ) : (
          <button class="big-button" data-action="start-tuner" onClick={() => void start()}>
            Start tuner
          </button>
        )}
      </div>
      {error && (
        <p class="song-note warn" role="status">
          {error}
        </p>
      )}
    </section>
  );
}

// --- F21 practice log ------------------------------------------------------------------------

function TempoChart({ points }: { points: readonly { date: string; tempo: number }[] }) {
  if (points.length < 2) return null;
  const w = 320;
  const h = 120;
  const min = Math.min(...points.map((p) => p.tempo)) - 5;
  const max = Math.max(...points.map((p) => p.tempo)) + 5;
  const x = (i: number) => 30 + (i / (points.length - 1)) * (w - 40);
  const y = (t: number) => h - 20 - ((t - min) / Math.max(1, max - min)) * (h - 30);
  return (
    <svg
      class="tempo-chart"
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label="Highest tempo over time"
    >
      <text x={2} y={y(max - 5) + 4}>
        {max - 5}
      </text>
      <text x={2} y={y(min + 5) + 4}>
        {min + 5}
      </text>
      <polyline points={points.map((p, i) => `${x(i)},${y(p.tempo)}`).join(" ")} />
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.tempo)} r={3} />
      ))}
    </svg>
  );
}

function PracticeLog({ store }: { store: AppStore }) {
  const log = store.practiceLog.value;
  const titles = new Map(store.songs.map((s) => [s.id, s.title]));
  const bySong = new Map<string, typeof log>();
  for (const s of log) bySong.set(s.songId, [...(bySong.get(s.songId) ?? []), s]);
  if (log.length === 0) return <p>Your practice shows up here after you play a song.</p>;
  return (
    <div>
      {[...bySong.entries()].map(([songId, sessions]) => {
        const total = sessions.reduce((n, s) => n + s.minutes, 0);
        const points = [...sessions]
          .reverse()
          .map((s) => ({ date: s.date, tempo: s.highestTempo }));
        return (
          <section key={songId} data-testid="log-song">
            <h3>{titles.get(songId) ?? "A deleted song"}</h3>
            <p>
              {sessions.length} session{sessions.length === 1 ? "" : "s"}, {Math.round(total)}{" "}
              minutes · best tempo {Math.max(...sessions.map((s) => s.highestTempo))}
            </p>
            <TempoChart points={points} />
            <ul class="log-list">
              {sessions.slice(0, 8).map((s) => (
                <li key={s.id}>
                  {s.date}: {s.minutes} min, {s.startTempo}→{s.highestTempo} bpm
                  {s.loops.length ? `, looped ${s.loops.join(", ")}` : ""}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

// --- F23 recording ---------------------------------------------------------------------------

interface Take {
  readonly id: string;
  readonly songId: string;
  readonly date: string;
  readonly tempo: number;
  readonly mimeType: string;
  readonly blob: Blob;
}

const MAX_TAKES = 20;

function Recordings({
  store,
  services,
  player,
}: {
  store: AppStore;
  services: Services;
  player: Player;
}) {
  const song = store.currentSong.value;
  const [takes, setTakes] = useState<Take[]>([]);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const [usage, setUsage] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  const refresh = async () => {
    const all: Take[] = [];
    for (const key of await services.storage.keys("recordings")) {
      const t = await services.storage.get<Take>("recordings", key);
      if (t && t.songId === song?.id) all.push(t);
    }
    setTakes(all.sort((a, b) => b.date.localeCompare(a.date)));
    const est = await navigator.storage?.estimate?.().catch(() => null);
    if (est?.usage !== undefined)
      setUsage(`${(est.usage / 1024 / 1024).toFixed(1)} MB used on this iPad`);
  };
  useEffect(() => {
    void refresh();
    return () => {
      recorder.current?.stop();
      audio.current?.pause();
    };
  }, [song?.id]);

  if (!song) return <p>Open a song to record yourself playing it.</p>;

  const start = async (withBacking: boolean) => {
    setError("");
    if (typeof MediaRecorder === "undefined") {
      setError("Recording isn't available in this browser.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await services.mic.open();
    } catch (e) {
      setError(micMessage(e));
      return;
    }
    const mimeType = MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "audio/webm";
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream, { mimeType });
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    rec.onstop = async () => {
      services.mic.close();
      setRecording(false);
      if (chunks.length === 0) return;
      const take: Take = {
        id: crypto.randomUUID(),
        songId: song.id,
        date: new Date().toISOString(),
        tempo: store.practice.peek().tempoBpm ?? player.follow.peek().bpm,
        mimeType,
        blob: new Blob(chunks, { type: mimeType }),
      };
      try {
        await services.storage.put("recordings", take.id, take);
        // Keep the last 20 takes per song.
        const mine = [take, ...takes].sort((a, b) => b.date.localeCompare(a.date));
        for (const old of mine.slice(MAX_TAKES))
          await services.storage.delete("recordings", old.id);
      } catch (e) {
        setError("Couldn't save the recording: the iPad's storage may be full.");
        services.diagnostics.log(
          "error",
          `Recording save: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
      await refresh();
    };
    rec.start(1000); // a chunk every second, so a cut-off take still keeps what was recorded
    recorder.current = rec;
    setRecording(true);
    if (withBacking) await player.play();
  };

  const stopRecording = () => {
    recorder.current?.stop();
    recorder.current = null;
    player.stop();
  };

  const play = async (take: Take, withBacking: boolean) => {
    audio.current?.pause();
    const el = new Audio(URL.createObjectURL(take.blob));
    audio.current = el;
    if (withBacking) await player.play();
    await el.play().catch(() => setError("Couldn't play the recording."));
  };

  return (
    <section>
      <p class="setting-help">Headphones help, so the backing isn't recorded too.</p>
      <div class="button-row">
        {recording ? (
          <button class="big-button" data-action="stop-recording" onClick={stopRecording}>
            ■ Stop recording
          </button>
        ) : (
          <>
            <button class="big-button" data-action="record" onClick={() => void start(false)}>
              ● Record
            </button>
            <button
              class="plain-button"
              data-action="record-backing"
              onClick={() => void start(true)}
            >
              ● Record with the backing
            </button>
          </>
        )}
      </div>
      {error && (
        <p class="song-note warn" role="status">
          {error}
        </p>
      )}
      <ul class="log-list" data-testid="takes">
        {takes.map((t) => (
          <li key={t.id}>
            {new Date(t.date).toLocaleString()} · {t.tempo} bpm{" "}
            <button class="plain-button" onClick={() => void play(t, false)}>
              Play
            </button>{" "}
            <button class="plain-button" onClick={() => void play(t, true)}>
              Play with backing
            </button>{" "}
            <button
              class="plain-button"
              onClick={() => void services.storage.delete("recordings", t.id).then(refresh)}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
      {usage && <p class="setting-help">{usage}</p>}
    </section>
  );
}

// --- The page --------------------------------------------------------------------------------

export function PracticeTools({
  store,
  services,
  player,
}: {
  store: AppStore;
  services: Services;
  player: Player;
}) {
  const tab = store.practiceTools.value ?? "tuner";
  return (
    <div class="settings-page" role="dialog" aria-modal="true" aria-label="Practice tools">
      <header class="settings-head">
        <div class="segmented" role="tablist">
          {(
            [
              ["tuner", "Tuner"],
              ["log", "Practice log"],
              ["recordings", "Record"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              class={tab === id ? "on" : ""}
              data-tool={id}
              onClick={() => (store.practiceTools.value = id)}
            >
              {label}
            </button>
          ))}
        </div>
        <button class="big-button" onClick={() => (store.practiceTools.value = null)}>
          Done
        </button>
      </header>
      {tab === "tuner" && <Tuner services={services} player={player} />}
      {tab === "log" && <PracticeLog store={store} />}
      {tab === "recordings" && <Recordings store={store} services={services} player={player} />}
    </div>
  );
}

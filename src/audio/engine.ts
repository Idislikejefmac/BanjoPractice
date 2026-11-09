// A2 · Instruments and the audio output the scheduler plays into (DEVELOPMENT.md §6 A2).
//
// Each part has an instrument (midi-js-soundfonts name). Samples are decoded on demand by P3;
// anything missing falls back to a generated pluck, so playback never goes silent because a
// file is missing. Stop fades every live source out within ~20 ms (I4: silent within 500 ms).
// Live sources and decoded buffers are counted for the resource invariants (I11).

import type { Part } from "../core/playback/generators.ts";
import type { AudioService, SampleLoader } from "../platform/types.ts";
import type { AudioOut, ScheduledNote } from "./scheduler.ts";
import { clickSamples, pluckSamples } from "./synth.ts";

export type MelodyInstrument = "violin" | "flute" | "mandolin";
export const MELODY_INSTRUMENTS: readonly { id: MelodyInstrument; label: string }[] = [
  { id: "violin", label: "Fiddle" },
  { id: "flute", label: "Flute" },
  { id: "mandolin", label: "Mandolin (synthesized)" },
];

/** Sample ranges committed under public/samples (scripts/fetch-samples.mjs). */
const RANGES: Readonly<Record<string, readonly [number, number]>> = {
  banjo: [48, 91],
  acoustic_guitar_steel: [38, 74],
  violin: [55, 93],
  flute: [55, 93],
};

/** Plucked parts ring on past the note; bowed and blown parts stop with it. */
const SUSTAINED = new Set(["violin", "flute"]);

const PART_GAIN: Readonly<Record<Part, number>> = {
  melody: 0.55,
  chords: 0.45,
  banjo: 0.7,
  metronome: 0.6,
};

interface Live {
  source: AudioBufferSourceNode;
  gain: GainNode;
  /** A one-off sound (chord finder, step mode), not part of playback. */
  preview: boolean;
}

export class AudioEngine implements AudioOut {
  private readonly audio: AudioService;
  private readonly samples: SampleLoader;
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly synth = new Map<string, AudioBuffer>();
  private readonly live = new Set<Live>();
  melodyInstrument: MelodyInstrument = "violin";

  constructor(audio: AudioService, samples: SampleLoader) {
    this.audio = audio;
    this.samples = samples;
    audio.onRecreate(() => {
      this.buffers.clear();
      this.synth.clear();
      this.live.clear();
    });
  }

  instrumentFor(part: Part): string {
    if (part === "banjo") return "banjo";
    if (part === "chords") return "acoustic_guitar_steel";
    if (part === "metronome") return "click";
    return this.melodyInstrument;
  }

  /**
   * Decodes every sample a program needs. Missing ones fall back to the synth.
   * Returns how many couldn't be loaded.
   */
  async prepare(notes: readonly { part: Part; midi: number }[]): Promise<number> {
    let missing = 0;
    const wanted = new Set<string>();
    for (const n of notes) {
      const inst = this.instrumentFor(n.part);
      if (!RANGES[inst]) continue;
      wanted.add(`${inst}/${this.clampMidi(inst, n.midi)}`);
    }
    await Promise.all(
      [...wanted].map(async (key) => {
        if (this.buffers.has(key)) return;
        const [inst, midi] = key.split("/") as [string, string];
        try {
          this.buffers.set(key, await this.samples.load(inst, Number(midi)));
        } catch {
          missing++; // Synth fallback at play time.
        }
      }),
    );
    return missing;
  }

  private clampMidi(inst: string, midi: number): number {
    const r = RANGES[inst];
    return r ? Math.max(r[0], Math.min(r[1], midi)) : midi;
  }

  now(): number {
    return this.audio.currentTime();
  }

  /**
   * Live playback sources (I4, I11), preview sources (chord finder, step mode: they ring on
   * after Stop by design) and decoded buffers, for the test hooks.
   */
  counts(): { sources: number; previews: number; buffers: number } {
    let previews = 0;
    for (const l of this.live) if (l.preview) previews++;
    return {
      sources: this.live.size - previews,
      previews,
      buffers: this.buffers.size + this.synth.size,
    };
  }

  private synthBuffer(ctx: BaseAudioContext, kind: string, midi: number): AudioBuffer {
    const key = `${kind}/${midi}`;
    let b = this.synth.get(key);
    if (!b) {
      const rate = ctx.sampleRate;
      const data =
        kind === "click"
          ? clickSamples(rate, midi === 1)
          : pluckSamples(midi, rate, kind === "mandolin" ? 1.2 : 1.8, {
              brightness: kind === "mandolin" ? 0.75 : 0.5,
              decay: kind === "mandolin" ? 0.993 : 0.996,
              seed: midi,
            });
      b = ctx.createBuffer(1, data.length, rate);
      b.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
      this.synth.set(key, b);
    }
    return b;
  }

  play(note: ScheduledNote, opts: { preview?: boolean } = {}): void {
    const graph = this.audio.graph();
    if (!graph) return;
    const ctx = graph.context;
    const inst = this.instrumentFor(note.part);
    let buffer: AudioBuffer;
    let rate = 1;
    const sampleMidi = this.clampMidi(inst, note.midi);
    const sampled = RANGES[inst] ? this.buffers.get(`${inst}/${sampleMidi}`) : undefined;
    if (sampled) {
      buffer = sampled;
      rate = 2 ** ((note.midi - sampleMidi) / 12); // only when outside the sampled range
    } else {
      buffer = this.synthBuffer(
        ctx,
        inst === "click" ? "click" : inst === "mandolin" ? "mandolin" : "pluck",
        note.midi,
      );
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    const gain = ctx.createGain();
    const level = PART_GAIN[note.part] * note.velocity ** 1.5;
    const start = Math.max(note.time, ctx.currentTime);
    gain.gain.setValueAtTime(level, start);
    const ring = SUSTAINED.has(inst) ? 0.05 : 0.6;
    const release = start + note.duration + ring;
    gain.gain.setTargetAtTime(0, start + note.duration, SUSTAINED.has(inst) ? 0.04 : 0.25);
    source.connect(gain);
    gain.connect(graph.master);
    source.start(start);
    source.stop(release + 0.6);
    const live: Live = { source, gain, preview: opts.preview === true };
    this.live.add(live);
    source.onended = () => {
      this.live.delete(live);
      try {
        gain.disconnect();
      } catch {
        // Already disconnected.
      }
    };
  }

  stopAll(): void {
    const graph = this.audio.graph();
    const now = graph?.context.currentTime ?? 0;
    for (const l of this.live) {
      try {
        l.gain.gain.cancelScheduledValues(now);
        l.gain.gain.setTargetAtTime(0, now, 0.005);
        l.source.stop(now + 0.03);
      } catch {
        // The source already stopped.
      }
    }
  }
}

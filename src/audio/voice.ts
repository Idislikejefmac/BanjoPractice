// Voice · A small formant synthesizer that sings one syllable on one note (a simplified Klatt
// design). A glottal pulse train at the note's pitch goes through four resonators set to a
// vowel's formants; noise stands in for the hiss of "s" and "sh", the burst of "t" and "k" and
// the breath of "h". Consonants are short stretches before and after the vowel, so the vowel
// lands on the beat (`lead` is how early the sound has to start). Pure: returns sample data,
// like synth.ts, so it can be tested without Web Audio.
//
// It sounds like a talking machine, not a person. What it gets right is the pitch, the
// timing, the length of each note and (roughly) the sounds of the words.

import type { Consonant, Syllable, Vowel } from "../core/voice/phonemes.ts";
import { parseSyllable } from "../core/voice/phonemes.ts";
import { midiToHz } from "./synth.ts";

type F3 = readonly [number, number, number];

/** Male vowel formants (Hz), after Peterson & Barney; diphthongs glide to `to` at the end. */
const VOWELS: Readonly<Record<Vowel, { f: F3; to?: F3 }>> = {
  IY: { f: [270, 2290, 3010] },
  IH: { f: [390, 1990, 2550] },
  EH: { f: [530, 1840, 2480] },
  AE: { f: [660, 1720, 2410] },
  AA: { f: [730, 1090, 2440] },
  AO: { f: [570, 840, 2410] },
  UH: { f: [440, 1020, 2240] },
  UW: { f: [300, 870, 2240] },
  AH: { f: [640, 1190, 2390] },
  ER: { f: [490, 1350, 1690] },
  EY: { f: [530, 1840, 2480], to: [390, 1990, 2550] },
  AY: { f: [730, 1090, 2440], to: [390, 1990, 2550] },
  OW: { f: [570, 840, 2410], to: [440, 1020, 2240] },
  AW: { f: [730, 1090, 2440], to: [440, 1020, 2240] },
  OY: { f: [570, 840, 2410], to: [390, 1990, 2550] },
};

/** One moment's synthesizer settings; the settings between two moments are interpolated. */
interface Key {
  t: number;
  /** 0–1 loudness of the pitched source. */
  voice: number;
  /** Noise through the vowel's resonators (breath, the "h" in "he"). */
  asp: number;
  /** Noise through its own resonator at `ff` (the hiss of "s", the burst of "t"). */
  fric: number;
  ff: number;
  fbw: number;
  f: F3;
}

interface Seg {
  dur: number;
  voice?: number;
  asp?: number;
  fric?: number;
  ff?: number;
  fbw?: number;
  f?: F3;
}

const NEUTRAL: F3 = [400, 1400, 2500];

/** The stretches of sound that make up one consonant. */
function segments(c: Consonant, vowel: F3, coda: boolean): Seg[] {
  const stop = (ff: number, fbw: number, voiced: boolean): Seg[] =>
    voiced
      ? [
          { dur: coda ? 0.02 : 0.025, voice: 0.25, f: [220, 1100, 2200] },
          { dur: 0.008, voice: 0.25, fric: 1.1, ff, fbw, f: [220, 1100, 2200] },
        ]
      : [
          { dur: 0.03 },
          { dur: 0.012, fric: 2.2, ff, fbw },
          ...(coda ? [] : [{ dur: 0.03, asp: 0.7, f: vowel } as Seg]),
        ];
  const fric = (dur: number, amp: number, ff: number, fbw: number, voice = 0): Seg[] => [
    { dur, fric: amp, ff, fbw, voice, f: voice > 0 ? [250, 1400, 2500] : NEUTRAL },
  ];
  const nasal = (f2: number): Seg[] => [{ dur: 0.07, voice: 1, f: [250, f2, 2500] }];
  switch (c) {
    case "P":
      return stop(900, 1800, false);
    case "T":
      return stop(4500, 2500, false);
    case "K":
      return stop(2200, 1200, false);
    case "B":
      return stop(900, 1800, true);
    case "D":
      return stop(4000, 2500, true);
    case "G":
      return stop(2000, 1200, true);
    case "S":
      return fric(0.09, 0.9, 6500, 3000);
    case "Z":
      return fric(0.08, 0.7, 6500, 3000, 0.3);
    case "SH":
      return fric(0.09, 1.6, 3000, 1800);
    case "ZH":
      return fric(0.08, 0.8, 3000, 1800, 0.3);
    case "F":
      return fric(0.07, 0.35, 6500, 5000);
    case "V":
      return fric(0.06, 0.35, 6500, 5000, 0.35);
    case "TH":
      return fric(0.07, 0.25, 7000, 6000);
    case "DH":
      return fric(0.05, 0.25, 7000, 6000, 0.4);
    case "HH":
      return [{ dur: 0.07, asp: 0.8, f: vowel }];
    case "CH":
      return [{ dur: 0.03 }, { dur: 0.07, fric: 1.5, ff: 3200, fbw: 1600 }];
    case "JH":
      return [
        { dur: 0.025, voice: 0.2, f: [220, 1100, 2200] },
        { dur: 0.06, voice: 0.3, fric: 1.0, ff: 3200, fbw: 1600, f: [250, 1500, 2500] },
      ];
    case "M":
      return nasal(1000);
    case "N":
      return nasal(1500);
    case "NG":
      return nasal(1800);
    case "L":
      return [{ dur: 0.06, voice: 0.8, f: [360, 1300, 2700] }];
    case "R":
      return [{ dur: 0.06, voice: 0.8, f: [350, 1100, 1500] }];
    case "W":
      return [{ dur: 0.05, voice: 0.8, f: [300, 700, 2200] }];
    case "Y":
      return [{ dur: 0.05, voice: 0.8, f: [270, 2300, 3000] }];
  }
}

const sum = (segs: readonly Seg[]) => segs.reduce((a, s) => a + s.dur, 0);

interface Timeline {
  keys: Key[];
  /** Seconds from the start of the sound to the start of the vowel. */
  lead: number;
  /** Seconds from the start of the sound to its end (before the final quiet tail). */
  end: number;
  /** The vowel's steady part, for loudness. */
  steady: readonly [number, number];
}

function timeline(syl: Syllable, seconds: number, legato: boolean): Timeline {
  const vowel = VOWELS[syl.vowel];
  const onset = legato ? [] : syl.onset.flatMap((c) => segments(c, vowel.f, false));
  let coda = syl.coda.flatMap((c) => segments(c, vowel.to ?? vowel.f, true));
  const lead = sum(onset);
  // The ending consonants take the last part of the note, but never most of it.
  let codaDur = sum(coda) * 0.85;
  const room = Math.max(0, seconds - 0.12);
  if (codaDur > room) codaDur = room;
  const scale = sum(coda) > 0 ? codaDur / sum(coda) : 0;
  coda = coda.map((s) => ({ ...s, dur: s.dur * scale }));

  const keys: Key[] = [];
  const push = (t: number, s: Partial<Key>, prev?: Key) => {
    const base = prev ??
      keys[keys.length - 1] ?? { t: 0, voice: 0, asp: 0, fric: 0, ff: 4000, fbw: 2000, f: vowel.f };
    keys.push({
      t,
      voice: s.voice ?? 0,
      asp: s.asp ?? 0,
      fric: s.fric ?? 0,
      ff: s.ff ?? base.ff,
      fbw: s.fbw ?? base.fbw,
      f: s.f ?? vowel.f,
    });
  };

  let t = 0;
  push(0, { voice: 0, f: vowel.f });
  for (const s of onset) {
    push(t, s);
    push(t + Math.max(0, s.dur - 0.003), s);
    t += s.dur;
  }
  const attack = lead > 0 ? 0.035 : 0.02;
  const steadyStart = lead + attack;
  const vowelEnd = Math.max(steadyStart + 0.04, lead + seconds - codaDur);
  if (lead > 0) push(lead, onset[onset.length - 1]!);
  else push(0, { voice: 0 });
  push(steadyStart, { voice: 1, f: vowel.f });
  if (vowel.to) {
    push(steadyStart + 0.5 * (vowelEnd - steadyStart), { voice: 1, f: vowel.f });
    push(vowelEnd, { voice: 1, f: vowel.to });
  } else {
    push(vowelEnd, { voice: 1, f: vowel.f });
  }
  let end = vowelEnd;
  if (coda.length > 0) {
    let c = vowelEnd + 0.01;
    for (const s of coda) {
      push(c, s);
      push(c + Math.max(0, s.dur - 0.003), s);
      c += s.dur;
    }
    end = c;
    push(end + 0.015, { voice: 0, f: vowel.to ?? vowel.f });
  } else {
    // Let the vowel die away over the last moments of the note.
    keys.pop();
    push(Math.max(steadyStart + 0.02, vowelEnd - 0.07), { voice: 1, f: vowel.to ?? vowel.f });
    push(vowelEnd, { voice: 0, f: vowel.to ?? vowel.f });
  }
  keys.sort((a, b) => a.t - b.t);
  return { keys, lead, end, steady: [steadyStart, vowelEnd] };
}

const resonator = (f: number, bw: number, rate: number): [number, number, number] => {
  const r = Math.exp((-Math.PI * bw) / rate);
  const b = 2 * r * Math.cos((2 * Math.PI * f) / rate);
  const c = -r * r;
  return [1 - b - c, b, c];
};

/** One slice of a glottal pulse (Rosenberg): phase 0–1 in, flow out. */
function pulse(phase: number): number {
  const open = 0.4;
  const close = 0.16;
  if (phase < open) return 0.5 * (1 - Math.cos((Math.PI * phase) / open));
  if (phase < open + close) return Math.cos((Math.PI * (phase - open)) / (2 * close));
  return 0;
}

export interface VoiceOptions {
  /** The printed syllable, e.g. "Crip-"; several joined by a space or ~ share the note. */
  readonly text: string;
  /** MIDI note to sing. */
  readonly midi: number;
  /** How long the note lasts, in seconds. */
  readonly seconds: number;
  /** A held note carrying on the same vowel: no consonants. */
  readonly legato?: boolean;
  readonly sampleRate: number;
}

export interface VoiceSound {
  readonly data: Float32Array;
  /** Seconds before the note's start that the sound has to begin (its leading consonants). */
  readonly lead: number;
}

const TARGET_RMS = 0.2;

function synthesize(
  syl: Syllable,
  midi: number,
  seconds: number,
  legato: boolean,
  rate: number,
  seed: number,
): VoiceSound {
  const tl = timeline(syl, seconds, legato);
  const n = Math.ceil((tl.end + 0.12) * rate);
  const out = new Float32Array(n);
  const hz = midiToHz(Math.max(36, Math.min(84, midi)));
  let s = seed >>> 0 || 1;
  const noise = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2147483648 - 1;
  };
  let phase = 0;
  let prevPulse = 0;
  // Resonator memories: F1–F4 in a chain, then the hiss resonator.
  const z1 = [0, 0, 0, 0, 0];
  const z2 = [0, 0, 0, 0, 0];
  const BLOCK = 32;
  let ki = 0;
  const keys = tl.keys;
  for (let i0 = 0; i0 < n; i0 += BLOCK) {
    const t = (i0 + BLOCK / 2) / rate;
    while (ki + 1 < keys.length - 1 && keys[ki + 1]!.t <= t) ki++;
    const a = keys[Math.min(ki, keys.length - 1)]!;
    const b = keys[Math.min(ki + 1, keys.length - 1)]!;
    const span = b.t - a.t;
    const u = span > 1e-6 ? Math.max(0, Math.min(1, (t - a.t) / span)) : 1;
    const mix = (x: number, y: number) => x + (y - x) * u;
    const voice = mix(a.voice, b.voice);
    const asp = mix(a.asp, b.asp);
    const fric = mix(a.fric, b.fric);
    const ff = mix(a.ff, b.ff);
    const fbw = mix(a.fbw, b.fbw);

    // Pitch: a small scoop up into the note, then vibrato once the note is held a while.
    const since = t - tl.lead;
    const scoop = legato || since < 0 ? 0 : -0.35 * Math.exp(-since / 0.06);
    const vibDepth = Math.max(0, Math.min(1, (since - 0.25) / 0.25)) * 0.3;
    const f0 =
      hz * 2 ** ((scoop + vibDepth * Math.sin(2 * Math.PI * 5.4 * t)) / 12) * (1 + 0.002 * noise());

    // A singer raises the first formant to stay above the pitch.
    const f1 = Math.max(mix(a.f[0], b.f[0]), f0 * 1.15);
    const coefs = [
      resonator(f1, 70, rate),
      resonator(mix(a.f[1], b.f[1]), 100, rate),
      resonator(mix(a.f[2], b.f[2]), 160, rate),
      resonator(3600, 300, rate),
      resonator(ff, fbw, rate),
    ] as const;
    const dphase = f0 / rate;
    for (let i = i0; i < Math.min(n, i0 + BLOCK); i++) {
      phase += dphase;
      if (phase >= 1) phase -= 1;
      const flow = pulse(phase);
      const deriv = (flow - prevPulse) / dphase;
      prevPulse = flow;
      const white = noise();
      let x = voice * (0.5 * deriv + 0.03 * white) + asp * 2.5 * white;
      for (let k = 0; k < 4; k++) {
        const [ca, cb, cc] = coefs[k]!;
        const y = ca * x + cb * z1[k]! + cc * z2[k]!;
        z2[k] = z1[k]!;
        z1[k] = y;
        x = y;
      }
      // The hiss comes in beside the voice, not through the vowel's resonators.
      const [ha, hb, hc] = coefs[4];
      const hiss = ha * white + hb * z1[4]! + hc * z2[4]!;
      z2[4] = z1[4]!;
      z1[4] = hiss;
      out[i] = x * 0.0016 + fric * hiss * 0.01;
    }
  }
  // Even loudness from one syllable to the next: scale by the vowel's own level.
  const from = Math.max(0, Math.floor(tl.steady[0] * rate));
  const to = Math.min(n, Math.max(from + 1, Math.floor(tl.steady[1] * rate)));
  let energy = 0;
  for (let i = from; i < to; i++) energy += out[i]! * out[i]!;
  const rms = Math.sqrt(energy / (to - from));
  const gain = rms > 1e-9 ? TARGET_RMS / rms : 0;
  for (let i = 0; i < n; i++) out[i] = Math.tanh(out[i]! * gain * 1.2) * 0.9;
  return { data: out, lead: tl.lead };
}

/** Sings one note's syllable. Several syllables on one note ("te ous") share its length. */
export function voiceSamples(o: VoiceOptions): VoiceSound {
  const pieces = o.text.split(/[\s~]+/).filter((p) => p.length > 0);
  const seed = [...o.text].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7) + o.midi;
  if (pieces.length <= 1) {
    return synthesize(
      parseSyllable(pieces[0] ?? ""),
      o.midi,
      o.seconds,
      o.legato === true,
      o.sampleRate,
      seed,
    );
  }
  const each = o.seconds / pieces.length;
  const parts = pieces.map((p, i) =>
    synthesize(
      parseSyllable(p),
      o.midi,
      each,
      o.legato === true && i === 0,
      o.sampleRate,
      seed + i,
    ),
  );
  const lead = parts[0]!.lead;
  const total = Math.ceil((lead + o.seconds + 0.12) * o.sampleRate);
  const data = new Float32Array(total);
  parts.forEach((part, i) => {
    const at = Math.max(0, Math.round((lead + i * each - part.lead) * o.sampleRate));
    for (let j = 0; j < part.data.length && at + j < total; j++) data[at + j]! += part.data[j]!;
  });
  return { data, lead };
}

// Generated sounds: the metronome click, and a Karplus–Strong plucked string used when a
// sample is missing or fails to decode (P3 failure modes), and for the mandolin melody
// voice (no mandolin in the General MIDI soundfont; spike S4).
// Pure: returns sample data, so it's testable without Web Audio.

export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** A plucked string: a noise burst through a damped delay line. */
export function pluckSamples(
  midi: number,
  sampleRate: number,
  seconds: number,
  opts: { brightness?: number; decay?: number; seed?: number } = {},
): Float32Array {
  const n = Math.floor(sampleRate * seconds);
  const out = new Float32Array(n);
  const period = Math.max(2, Math.round(sampleRate / midiToHz(midi)));
  const brightness = opts.brightness ?? 0.5;
  const decay = opts.decay ?? 0.996;
  // Seeded noise, so the same note always sounds the same.
  let s = (opts.seed ?? 12345) >>> 0;
  const noise = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2147483648 - 1;
  };
  const line = new Float32Array(period);
  for (let i = 0; i < period; i++) line[i] = noise();
  let idx = 0;
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const cur = line[idx]!;
    out[i] = cur;
    // Averaging filter: brighter keeps more of the current sample.
    const next = decay * (brightness * cur + (1 - brightness) * (0.5 * (cur + prev)));
    prev = cur;
    line[idx] = next;
    idx = (idx + 1) % period;
  }
  // Short fade-in avoids a click; normalize.
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]!));
  const gain = peak > 0 ? 0.8 / peak : 0;
  for (let i = 0; i < n; i++) out[i] = out[i]! * gain * Math.min(1, i / 32);
  return out;
}

/** A short woodblock-like click; the accented one is higher. */
export function clickSamples(sampleRate: number, accent: boolean): Float32Array {
  const n = Math.floor(sampleRate * 0.04);
  const out = new Float32Array(n);
  const f = accent ? 1600 : 1100;
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    out[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 90) * (accent ? 0.9 : 0.7);
  }
  return out;
}

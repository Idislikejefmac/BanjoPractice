// Downloads the instrument samples the app plays (DEVELOPMENT.md A2, spike S4) into
// public/samples/<instrument>/<midi>.mp3. Run once by a developer; the files are committed so
// the app is self-hosted and works offline (no runtime CDN).
//
// Source: FluidR3_GM via midi-js-soundfonts by Benjamin Gleitzman
// (https://github.com/gleitz/midi-js-soundfonts). FluidR3_GM is licensed CC BY 3.0
// (credited in the app's About section and public/samples/LICENSE.txt).
//
//   node scripts/fetch-samples.mjs

import { mkdirSync, writeFileSync, existsSync } from "node:fs";

const BASE = "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM";
const NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

/** MIDI ranges each part needs (sounding pitch, including capo up to 7). */
const INSTRUMENTS = {
  banjo: [48, 91],
  acoustic_guitar_steel: [38, 74],
  violin: [55, 93],
  flute: [55, 93],
};

const noteName = (midi) => `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;

let total = 0;
for (const [instrument, [lo, hi]] of Object.entries(INSTRUMENTS)) {
  const dir = new URL(`../public/samples/${instrument}/`, import.meta.url);
  mkdirSync(dir, { recursive: true });
  for (let midi = lo; midi <= hi; midi++) {
    const file = new URL(`${midi}.mp3`, dir);
    if (existsSync(file)) continue;
    const res = await fetch(`${BASE}/${instrument}-mp3/${noteName(midi)}.mp3`);
    if (!res.ok) throw new Error(`${instrument} ${noteName(midi)}: HTTP ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    writeFileSync(file, bytes);
    total += bytes.length;
  }
  console.log(`${instrument}: MIDI ${lo}–${hi}`);
}
console.log(`downloaded ${(total / 1024 / 1024).toFixed(1)} MB`);

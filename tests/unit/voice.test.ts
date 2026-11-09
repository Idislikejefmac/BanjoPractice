import { describe, expect, it } from "vitest";
import { voiceSamples } from "../../src/audio/voice.ts";
import type { AudioOut, Program, ScheduledNote } from "../../src/audio/scheduler.ts";
import { Scheduler } from "../../src/audio/scheduler.ts";
import { generateEvents, slotSeconds } from "../../src/core/playback/generators.ts";
import { playbackOrder } from "../../src/core/playback/order.ts";
import { indexAbc } from "../../src/core/song/abcIndex.ts";
import { detectPitch, hzToMidi } from "../../src/core/tuner/pitch.ts";
import { parseSyllable } from "../../src/core/voice/phonemes.ts";
import { DEFAULT_PRACTICE, readPractice } from "../../src/app/model.ts";
import { createFakeClock } from "../../src/platform/fakes.ts";

const rate = 44100;
const say = (text: string) => {
  const s = parseSyllable(text);
  return [...s.onset, `[${s.vowel}]`, ...s.coda].join(" ");
};

describe("voice: reading a printed syllable", () => {
  it("reads common words and the syllables of a sung line", () => {
    expect(say("the")).toBe("DH [AH]");
    expect(say("love")).toBe("L [AH] V");
    expect(say("Creek,")).toBe("K R [IY] K");
    expect(say("Crip-")).toBe("K R [IH] P");
    expect(say("go")).toBe("G [OW]");
    expect(say("time")).toBe("T [AY] M");
    expect(say("ple")).toBe("P [AH] L");
    expect(say("strang")).toBe("S T R [EY] N JH");
    expect(say("I'm")).toBe("[AY] M");
    expect(say("ness,")).toBe("N [EH] S");
  });

  it("never fails: every sequence of letters gives a vowel to sing", () => {
    for (const text of ["", "n't", "st", "'", "xyz", "Qu", "rhythm", "Ph", "tsk", "ll", "mm"]) {
      const s = parseSyllable(text);
      expect(typeof s.vowel).toBe("string");
    }
  });
});

describe("voice: the synthesizer", () => {
  const midOf = (v: { data: Float32Array; lead: number }) => Math.floor((v.lead + 0.3) * rate);

  it("sings at the pitch asked for (within 25 cents), across a man's range", () => {
    for (const midi of [45, 50, 55, 60, 65]) {
      const v = voiceSamples({ text: "la", midi, seconds: 0.7, sampleRate: rate });
      const mid = midOf(v);
      const p = detectPitch(v.data.slice(mid, mid + 4096), rate);
      expect(p).not.toBeNull();
      expect(Math.abs(hzToMidi(p!.hz) - midi)).toBeLessThan(0.25);
    }
  });

  it("gives different vowels different colours", () => {
    const energy = (text: string, lo: number, hi: number) => {
      const v = voiceSamples({ text, midi: 50, seconds: 0.6, sampleRate: rate });
      const at = midOf(v);
      let total = 0;
      for (let f = lo; f <= hi; f += 50) {
        let re = 0;
        let im = 0;
        for (let i = 0; i < 2048; i++) {
          const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / 2048);
          const x = v.data[at + i]! * w;
          re += x * Math.cos((2 * Math.PI * f * i) / rate);
          im += x * Math.sin((2 * Math.PI * f * i) / rate);
        }
        total += re * re + im * im;
      }
      return total;
    };
    // "ee" has its second formant high (near 2300 Hz); "ah" near 1100 Hz.
    expect(energy("lee", 2000, 2600) / energy("lee", 800, 1300)).toBeGreaterThan(
      2 * (energy("lah", 2000, 2600) / energy("lah", 800, 1300)),
    );
  });

  it("starts its leading consonants early, so the vowel lands on the beat", () => {
    expect(
      voiceSamples({ text: "la", midi: 50, seconds: 0.5, sampleRate: rate }).lead,
    ).toBeGreaterThan(0.03);
    expect(
      voiceSamples({ text: "stra", midi: 50, seconds: 0.5, sampleRate: rate }).lead,
    ).toBeGreaterThan(voiceSamples({ text: "la", midi: 50, seconds: 0.5, sampleRate: rate }).lead);
    // A vowel with nothing in front, and a held note carrying on, start right at the beat.
    expect(voiceSamples({ text: "I", midi: 50, seconds: 0.5, sampleRate: rate }).lead).toBe(0);
    expect(
      voiceSamples({ text: "la", midi: 50, seconds: 0.5, legato: true, sampleRate: rate }).lead,
    ).toBe(0);
  });

  it("lasts as long as the note, then dies away", () => {
    const v = voiceSamples({ text: "go", midi: 50, seconds: 1, sampleRate: rate });
    const seconds = v.data.length / rate;
    expect(seconds).toBeGreaterThan(v.lead + 1);
    expect(seconds).toBeLessThan(v.lead + 1.3);
    const tail = v.data.slice(v.data.length - 1000);
    expect(Math.max(...tail.map(Math.abs))).toBeLessThan(0.01);
  });

  it("stays finite and within range for every sound, short notes and long ones", () => {
    for (const text of [
      "sa",
      "za",
      "sha",
      "fa",
      "tha",
      "ta",
      "ba",
      "cha",
      "ja",
      "ha",
      "ma",
      "la",
      "ya",
      "as",
      "ash",
      "te ous",
      "I",
    ]) {
      for (const seconds of [0.08, 0.3, 1.5]) {
        const v = voiceSamples({ text, midi: 48, seconds, sampleRate: rate });
        let peak = 0;
        let finite = true;
        for (const x of v.data) {
          if (!Number.isFinite(x)) finite = false;
          peak = Math.max(peak, Math.abs(x));
        }
        expect(finite).toBe(true);
        expect(peak).toBeLessThanOrEqual(0.95);
        expect(peak).toBeGreaterThan(0.01);
      }
    }
  });

  it("renders fast enough to do while playing (well under a slot's lookahead)", () => {
    voiceSamples({ text: "warm", midi: 50, seconds: 0.5, sampleRate: rate }); // warm up
    const t0 = performance.now();
    voiceSamples({ text: "strong", midi: 50, seconds: 1, sampleRate: rate });
    expect(performance.now() - t0).toBeLessThan(60);
  });
});

const HEADER = "X:1\nM:4/4\nL:1/8\nQ:1/4=120\nK:G\n";

describe("voice: the sung part", () => {
  const abc = `${HEADER}|:G2 A2 B4|c2 d2 e4:|\nw:Go a- long_|home to you\nw:Come with me_|now we run\n`;
  const idx = indexAbc(abc);
  const voice = (transpose = 0, octave = -1) =>
    generateEvents(idx, null, { transpose, voiceOctave: octave }).map((m) =>
      m.events.filter((e) => e.part === "voice"),
    );

  it("has each verse's syllables on the notes, an octave down by default", () => {
    const m1 = voice()[0]!;
    expect(m1.filter((e) => e.verse === 0).map((e) => e.text)).toEqual(["Go", "a", "long"]);
    expect(m1.filter((e) => e.verse === 1).map((e) => e.text)).toEqual(["Come", "with", "me"]);
    expect(m1[0]!.midi).toBe(67 - 12);
    expect(voice(0, 0)[0]![0]!.midi).toBe(67);
    expect(voice(2, -1)[0]![0]!.midi).toBe(67 - 12 + 2); // follows the practice key
  });

  it("makes no voice part unless asked, or when the song has no words", () => {
    expect(
      generateEvents(idx, null, { transpose: 0 })
        .flatMap((m) => m.events)
        .some((e) => e.part === "voice"),
    ).toBe(false);
    const plain = indexAbc(`${HEADER}G8|]`);
    expect(
      generateEvents(plain, null, { transpose: 0, voiceOctave: -1 }).flatMap((m) => m.events),
    ).not.toContainEqual(expect.objectContaining({ part: "voice" }));
  });

  it("carries a held word on the notes after it, without new consonants", () => {
    const held = indexAbc(`${HEADER}G4 A2 B2|c8|]\nw:long_ * *\n`);
    const events = generateEvents(held, null, { transpose: 0, voiceOctave: 0 })
      .flatMap((m) => m.events)
      .filter((e) => e.part === "voice");
    expect(events.map((e) => [e.text, e.legato])).toEqual([
      ["long", false],
      ["long", true],
      ["long", true],
      ["long", true],
    ]);
  });

  it("lets a verse with no words in a measure borrow the first verse that has some", () => {
    const chorus = indexAbc(`${HEADER}G4 A4|c4 d4|]\nw:one two\nw:*|three four\n`);
    const events = generateEvents(chorus, null, { transpose: 0, voiceOctave: 0 });
    const second = events[0]!.events.filter((e) => e.part === "voice" && e.verse === 1);
    expect(second.map((e) => e.text)).toEqual(["one", "two"]); // verse 2 has nothing here
  });
});

describe("voice: one verse at a time while playing", () => {
  const abc = `${HEADER}|:G8|A8:|\nw:one|two\nw:red|blue\n`;
  const song = indexAbc(abc);

  it("sings verse 1 the first time round and verse 2 the second", () => {
    const clock = createFakeClock(0);
    const played: ScheduledNote[] = [];
    const out: AudioOut = {
      now: () => clock.now() / 1000,
      play: (n) => played.push(n),
      stopAll: () => undefined,
    };
    const scheduler = new Scheduler(out, clock);
    scheduler.setPart("voice", true, 1);
    const order = playbackOrder(song); // G A G A
    const seen = new Map<number, number>();
    const verses = order.map((pos) => {
      const n = seen.get(pos) ?? 0;
      seen.set(pos, n + 1);
      return n % 2;
    });
    const program: Program = {
      measures: generateEvents(song, null, { transpose: 0, voiceOctave: 0 }),
      order,
      verses,
      slotSeconds: (bpm) => slotSeconds(song, bpm),
      countIn: null,
      repeat: false,
      gapSlots: 0,
    };
    scheduler.start(program, { bpm: 120 });
    for (let t = 0; t < 8000; t += 5) clock.advance(5);
    expect(played.filter((n) => n.part === "voice").map((n) => n.text)).toEqual([
      "one",
      "two",
      "red",
      "blue",
    ]);
  });

  it("is silent while the voice is off", () => {
    const clock = createFakeClock(0);
    const played: ScheduledNote[] = [];
    const scheduler = new Scheduler(
      { now: () => clock.now() / 1000, play: (n) => played.push(n), stopAll: () => undefined },
      clock,
    );
    scheduler.start(
      {
        measures: generateEvents(song, null, { transpose: 0, voiceOctave: 0 }),
        order: playbackOrder(song),
        slotSeconds: (bpm) => slotSeconds(song, bpm),
        countIn: null,
        repeat: false,
        gapSlots: 0,
      },
      { bpm: 120 },
    );
    for (let t = 0; t < 8000; t += 5) clock.advance(5);
    expect(played.some((n) => n.part === "voice")).toBe(false);
  });
});

describe("voice: the saved setting", () => {
  it("is off by default, in a man's register, and older saved songs still load", () => {
    expect(DEFAULT_PRACTICE.voice).toEqual({ on: false, volume: 0.8, octave: -1 });
    const older: Record<string, unknown> = { ...DEFAULT_PRACTICE, keyShift: 3 };
    delete older.voice;
    const read = readPractice(older);
    expect(read.voice.on).toBe(false);
    expect(read.keyShift).toBe(3);
  });

  it("keeps a valid setting and ignores an invalid one", () => {
    expect(
      readPractice({ ...DEFAULT_PRACTICE, voice: { on: true, volume: 0.5, octave: 0 } }).voice,
    ).toEqual({ on: true, volume: 0.5, octave: 0 });
    expect(
      readPractice({ ...DEFAULT_PRACTICE, voice: { on: true, volume: 9, octave: 3 } }).voice,
    ).toEqual(DEFAULT_PRACTICE.voice);
  });
});

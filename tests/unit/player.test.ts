// The transport against the iPad-modeled audio fake (CHAOS_TESTING.md §6.2, fake-verified).
import { describe, expect, it } from "vitest";
import { Player } from "../../src/app/player.ts";
import { AppStore } from "../../src/app/store.ts";
import { createDiagnostics } from "../../src/platform/diagnostics.ts";
import {
  createFakeAudio,
  createFakeClock,
  createFakeInput,
  createFakeSamples,
  createMemoryStore,
} from "../../src/platform/fakes.ts";
import type { Services } from "../../src/app/services.ts";
import { builtinSong } from "../../src/core/song/song.ts";

const SONG = builtinSong(
  "t",
  'X:1\nT:T\nM:4/4\nL:1/8\nQ:1/4=120\nK:G\n"G"G2 A2 B2 c2|"C"c8|"G"G8|"D"A8|]',
);

async function rig() {
  const audio = createFakeAudio();
  const clock = createFakeClock();
  const input = createFakeInput();
  const diagnostics = createDiagnostics("t", null);
  const services = {
    storage: createMemoryStore(),
    audio,
    clock,
    input,
    samples: createFakeSamples(),
    diagnostics,
  } as unknown as Services;
  const store = new AppStore(services, [SONG], null);
  await store.load();
  store.openSong("t");
  store.updatePractice({ metronome: "off" });
  const player = new Player(services, store);
  const samples = services.samples as ReturnType<typeof createFakeSamples>;
  /** Moves wall-clock and audio time together. */
  const run = async (ms: number) => {
    for (let t = 0; t < ms; t += 10) {
      audio.advance(0.01);
      clock.advance(10);
      await new Promise((r) => setTimeout(r, 0));
    }
  };
  return { audio, clock, input, store, player, run, samples };
}

describe("player on an iPad-like audio context", () => {
  // Regression: choosing the flute while a song played left the melody on the plucked
  // stand-in (it sounded like the mandolin) because the flute samples were never fetched.
  it("fetches the new instrument's sounds when it is changed during playback", async () => {
    const { audio, player, store, run, samples } = await rig();
    audio.tap();
    await player.play();
    await run(300);
    expect(samples.loads.some((l) => l.startsWith("violin/"))).toBe(true);
    expect(samples.loads.some((l) => l.startsWith("flute/"))).toBe(false);
    store.updateSettings({ melodyInstrument: "flute" });
    await run(300);
    expect(samples.loads.some((l) => l.startsWith("flute/"))).toBe(true);
    player.stop();
  });

  it("won't play before a tap, and says so instead of showing a silent 'playing'", async () => {
    const { player, store } = await rig();
    await player.play();
    expect(player.state.value).toBe("stopped");
    expect(store.notices.value.map((n) => n.text).join()).toMatch(/Tap Play/);
  });

  it("plays after a tap and follows the measures", async () => {
    const { audio, player, run } = await rig();
    audio.tap();
    await player.play();
    expect(player.state.value).toBe("playing");
    await run(200);
    expect(player.follow.value.measure).toBe(1);
    await run(2100);
    expect(player.follow.value.measure).toBe(2);
    player.stop();
    expect(player.follow.value.measure).toBeNull();
  });

  it("stops cleanly when interrupted, and one tap carries on from the same measure (I10)", async () => {
    const { audio, player, store, run } = await rig();
    audio.tap();
    await player.play();
    await run(2300);
    expect(player.follow.value.measure).toBe(2);
    audio.interrupt();
    expect(player.state.value).toBe("stopped");
    expect(store.notices.value.map((n) => n.text).join()).toMatch(/Paused by the iPad/);
    audio.tap();
    await player.play();
    await run(100);
    expect(player.follow.value.measure).toBe(2);
    player.stop();
  });

  it("recreates the audio context after a route change, never two at once (I13)", async () => {
    const { audio, player } = await rig();
    audio.tap();
    await player.play();
    player.stop();
    audio.routeChange();
    audio.tap();
    await player.play();
    expect(audio.created).toBe(2);
    expect(audio.liveContexts()).toBe(1);
    player.stop();
  });

  it("toggles with the pedal and restarts from the top (F13)", async () => {
    const { audio, input, player, run } = await rig();
    audio.tap();
    input.press("play-stop");
    await run(50);
    expect(player.state.value).toBe("playing");
    input.press("play-stop");
    expect(player.state.value).toBe("stopped");
  });

  it("stops when Dad opens another song", async () => {
    const other = builtinSong("u", "X:1\nT:U\nM:4/4\nL:1/8\nK:G\nG8|]");
    const { audio, player, store } = await rig();
    store.songList.value = [SONG, other];
    audio.tap();
    await player.play();
    store.openSong("u");
    expect(player.state.value).toBe("stopped");
  });
});

// Test builds only: the draft songs in tests/fixtures/songs, so the end-to-end and chaos
// suites have melodies with tabs to exercise. They were written from memory, not from a
// source, so they never ship (scripts/check-prod-bundle.mjs fails the build if they do).

import type { Song } from "../core/song/song.ts";
import { builtinSong } from "../core/song/song.ts";

const abcFiles = import.meta.glob("../../tests/fixtures/songs/*.abc", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const tabFiles = import.meta.glob("../../tests/fixtures/songs/*.tab", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const idOf = (path: string) => path.replace(/^.*\//, "").replace(/\.(abc|tab)$/, "");

export function fixtureSongs(): Song[] {
  const tabs = new Map(Object.entries(tabFiles).map(([p, text]) => [idOf(p), text]));
  return Object.entries(abcFiles)
    .map(([p, abc]) => builtinSong(idOf(p), abc, tabs.get(idOf(p))))
    .sort((a, b) => a.title.localeCompare(b.title));
}

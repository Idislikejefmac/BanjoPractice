// Built-in songs (F5), bundled from songs/*.abc and songs/*.tab at build time (DEVELOPMENT.md
// §8.1). IDs are the file names, so they stay stable.
//
// Only songs taken from a real source (Dad's sheet music, or a verified public-domain printing)
// go in songs/. Dad's own songs are loaded from a song pack instead (scripts/make-song-pack.ts).

import type { Song } from "../core/song/song.ts";
import { builtinSong } from "../core/song/song.ts";

const abcFiles = import.meta.glob("../../songs/*.abc", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const tabFiles = import.meta.glob("../../songs/*.tab", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const idOf = (path: string) => path.replace(/^.*\//, "").replace(/\.(abc|tab)$/, "");

export function builtinSongs(): Song[] {
  const tabs = new Map(Object.entries(tabFiles).map(([p, text]) => [idOf(p), text]));
  return Object.entries(abcFiles)
    .map(([p, abc]) => builtinSong(idOf(p), abc, tabs.get(idOf(p))))
    .sort((a, b) => a.title.localeCompare(b.title));
}

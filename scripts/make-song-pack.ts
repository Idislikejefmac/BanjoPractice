// Bundles Dad's private songs into a backup file he can load on his iPad
// (Settings → Restore from a backup). The songs never go into the public repository.
//
//   sheet-music/songs/<id>.abc   the transcription (melody, chords, words) from his sheet music
//   sheet-music/songs/<id>.tab   optional hand-written tab (otherwise the app arranges one)
//
//   node scripts/make-song-pack.ts      → sheet-music/dads-songs-YYYY-MM-DD.json
//
// Each song is checked first (ABC reads cleanly; a tab matches the notation and passes the
// banjo rules). Song ids are fixed per file, so loading a newer pack updates the same songs.

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { makeBackup } from "../src/app/backup.ts";
import { DEFAULT_SETTINGS } from "../src/app/model.ts";
import type { Song } from "../src/core/song/song.ts";
import { builtinSong, loadSong } from "../src/core/song/song.ts";

const dir = new URL("../sheet-music/songs/", import.meta.url);
if (!existsSync(dir)) {
  console.error("No sheet-music/songs/ folder yet: nothing to pack.");
  process.exit(1);
}

/** A stable uuid from the file name, so a newer pack replaces the same song. */
function idFor(name: string): string {
  const h = createHash("sha256").update(`banjo-practice:${name}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const songs: Song[] = [];
let problems = 0;
for (const file of readdirSync(dir)
  .filter((f) => f.endsWith(".abc"))
  .sort()) {
  const name = file.replace(/\.abc$/, "");
  const abc = readFileSync(new URL(file, dir), "utf8");
  const tabUrl = new URL(`${name}.tab`, dir);
  const tab = existsSync(tabUrl) ? readFileSync(tabUrl, "utf8") : undefined;
  const song: Song = { ...builtinSong(idFor(name), abc, tab), source: "user" };
  const loaded = loadSong(song);
  const errors = [
    ...loaded.problems.filter((p) => p.severity === "error").map((p) => p.message),
    ...loaded.violations
      .filter((v) => v.severity === "error")
      .map((v) => `${v.rule}: ${v.message}`),
  ];
  if (loaded.index.measures.length === 0) errors.push("no music found");
  console.log(
    `${errors.length ? "✗" : "✓"} ${song.title} (${loaded.index.measures.length} measures${tab ? ", tab" : ""})`,
  );
  for (const e of errors) console.log(`    ${e}`);
  problems += errors.length;
  songs.push(song);
}
if (problems > 0) {
  console.error("Fix the problems above first; no pack written.");
  process.exit(1);
}

const backup = makeBackup({
  appVersion: "song-pack",
  songs,
  songPrefs: [],
  settings: DEFAULT_SETTINGS,
  practiceLog: [],
});
// Songs only: loading a pack must not change Dad's settings.
const pack = { ...backup, settings: null };
const d = new Date();
const out = new URL(
  `../sheet-music/dads-songs-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}.json`,
  import.meta.url,
);
writeFileSync(out, JSON.stringify(pack, null, 1));
console.log(
  `Wrote ${out.pathname} with ${songs.length} song(s). Send it to the iPad and use Settings → Restore from a backup.`,
);

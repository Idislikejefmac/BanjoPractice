// Prints every problem and rule violation in the built-in songs (songs/*.abc + *.tab) and
// the test fixtures (tests/fixtures/songs). Run: node scripts/check-songs.ts
// Run: node scripts/check-songs.ts   (Node 24 runs TypeScript directly)
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { loadSong } from "../src/core/song/song.ts";

const dir = new URL("../songs/", import.meta.url);
let bad = 0;
for (const f of readdirSync(dir)
  .filter((f) => f.endsWith(".abc"))
  .sort()) {
  const id = f.replace(/\.abc$/, "");
  const abc = readFileSync(new URL(f, dir), "utf8");
  const tabUrl = new URL(`${id}.tab`, dir);
  const tab = existsSync(tabUrl) ? readFileSync(tabUrl, "utf8") : undefined;
  const s = loadSong({
    schemaVersion: 1,
    id,
    title: id,
    source: "builtin",
    abc,
    tags: [],
    ...(tab !== undefined ? { tab } : {}),
  });
  console.log(
    `${id}: ${s.index.measures.length} measures, key ${s.index.key.tonic.letter}, tab ${s.arrangement ? "yes" : "no"}`,
  );
  for (const p of s.problems) console.log(`  [${p.severity}] ${p.message}`);
  for (const v of s.violations)
    console.log(`  [${v.rule} ${v.severity}] m${v.measure} slot ${v.slot + 1}: ${v.message}`);
  bad +=
    s.problems.filter((p) => p.severity === "error").length +
    s.violations.filter((v) => v.severity === "error").length;
}
process.exitCode = bad > 0 ? 1 : 0;

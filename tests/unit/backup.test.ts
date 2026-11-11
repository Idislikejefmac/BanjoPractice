// F18 export/import (phase-5 exit: "Export → clear storage → import restores everything
// exactly (automated). Fuzzed import files never corrupt existing data.")
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  BACKUP_FORMAT,
  importOps,
  makeBackup,
  parseBackup,
  previewImport,
} from "../../src/app/backup.ts";
import { DEFAULT_SETTINGS, MODEL_SCHEMA_VERSION } from "../../src/app/model.ts";
import type { Song } from "../../src/core/song/song.ts";
import { SONG_SCHEMA_VERSION } from "../../src/core/song/song.ts";
import { EMPTY_PROGRESS, mergeProgress, rateRoll } from "../../src/core/learning/progress.ts";
import { createMemoryStore } from "../../src/platform/fakes.ts";

let n = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const userSong = (title: string, abc = `X:1\nT:${title}\nM:4/4\nL:1/8\nK:G\nG8|]`): Song => ({
  schemaVersion: SONG_SCHEMA_VERSION,
  id: uuid(),
  title,
  source: "user",
  abc,
  tags: [],
});

describe("F18 backup", () => {
  it("export → clear storage → import restores everything exactly", async () => {
    const songs = [userSong("Shady Grove"), userSong("John Hardy")];
    const prefs = [
      { schemaVersion: MODEL_SCHEMA_VERSION, songId: songs[0]!.id, favorite: true },
      { schemaVersion: MODEL_SCHEMA_VERSION, songId: "cripple-creek", favorite: true },
    ];
    const settings = { ...DEFAULT_SETTINGS, size: 3, spikes: [7, 9, 10] };
    const file = JSON.stringify(
      makeBackup({ appVersion: "1", songs, songPrefs: prefs, settings, practiceLog: [] }),
    );

    const fresh = createMemoryStore(); // storage cleared
    const parsed = parseBackup(file);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const ops = importOps(parsed.backup, previewImport(parsed.backup, new Map()), "keep-both", {
      newId: uuid,
      importSettings: true,
      now: new Date("2026-11-08T12:00:00Z"),
    });
    await fresh.writeAll(ops);
    const dump = fresh.dump();
    for (const s of songs) {
      const { updatedAt, ...restored } = dump.songs![s.id] as Song;
      expect(restored).toEqual(s);
      expect(updatedAt).toBe("2026-11-08T12:00:00.000Z");
    }
    expect(dump.songPrefs).toEqual(Object.fromEntries(prefs.map((p) => [p.songId, p])));
    expect(dump.settings!.settings).toEqual(settings);
  });

  it("previews new, identical and changed songs, and handles each choice", () => {
    const same = userSong("Same");
    const changed = userSong("Changed");
    const fresh = userSong("New");
    const existing = new Map([
      [same.id, same],
      [changed.id, { ...changed, abc: changed.abc.replace("G8", "A8") }],
    ]);
    const backup = makeBackup({
      appVersion: "1",
      songs: [same, changed, fresh],
      songPrefs: [],
      settings: DEFAULT_SETTINGS,
      practiceLog: [],
    });
    const preview = previewImport(backup, existing);
    expect(preview.newSongs.map((s) => s.title)).toEqual(["New"]);
    expect(preview.identical).toBe(1);
    expect(preview.conflicts.map((c) => c.incoming.title)).toEqual(["Changed"]);

    const opts = { newId: uuid, importSettings: false };
    const replace = importOps(backup, preview, "replace", opts);
    expect(replace.some((o) => o.store === "trash")).toBe(true); // old version kept in trash
    expect(replace.filter((o) => o.store === "songs").map((o) => o.key)).toContain(changed.id);
    const both = importOps(backup, preview, "keep-both", opts);
    const copy = both.find(
      (o) => o.op === "put" && o.store === "songs" && o.key !== fresh.id && o.key !== changed.id,
    );
    expect(copy?.op === "put" && (copy.value as Song).title).toBe("Changed (imported)");
    const skip = importOps(backup, preview, "skip", opts);
    expect(skip.filter((o) => o.store === "songs").map((o) => o.key)).toEqual([fresh.id]);
  });

  it("refuses files that aren't backups, and newer versions, with a plain message", () => {
    expect(parseBackup("not json")).toMatchObject({ ok: false });
    expect(parseBackup("[]")).toMatchObject({ ok: false });
    expect(parseBackup(JSON.stringify({ format: "something-else" }))).toMatchObject({ ok: false });
    const newer = parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 99 }));
    expect(newer.ok).toBe(false);
    if (!newer.ok) expect(newer.error).toMatch(/newer version/);
  });

  it("skips damaged songs but restores the rest", () => {
    const good = userSong("Good");
    const file = JSON.stringify({
      format: BACKUP_FORMAT,
      version: 1,
      songs: [good, { id: "x", title: "Broken", abc: 42 }, null],
      songPrefs: [{ songId: 1 }],
      settings: { size: "huge" },
    });
    const parsed = parseBackup(file);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.backup.songs.map((s) => s.title)).toEqual(["Good"]);
    expect(parsed.skipped).toHaveLength(2);
    expect(parsed.backup.songPrefs).toEqual([]);
    expect(parsed.backup.settings?.size).toBe(DEFAULT_SETTINGS.size); // repaired field by field
  });

  it("fuzzed import files never corrupt existing data (property)", async () => {
    const existing = userSong("Mine");
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.string(),
          fc.json(),
          fc
            .record({
              format: fc.constant(BACKUP_FORMAT),
              version: fc.oneof(fc.constant(1), fc.integer()),
              songs: fc.array(
                fc.oneof(
                  fc.anything(),
                  fc.record({
                    id: fc.string(),
                    title: fc.string(),
                    abc: fc.string(),
                    schemaVersion: fc.constant(1),
                    source: fc.constant("user"),
                    tags: fc.constant([]),
                  }),
                ),
              ),
              songPrefs: fc.anything(),
              settings: fc.anything(),
            })
            .map((r) => JSON.stringify(r)),
        ),
        async (text) => {
          const store = createMemoryStore();
          await store.put("songs", existing.id, existing);
          const parsed = parseBackup(text);
          if (parsed.ok) {
            const preview = previewImport(parsed.backup, new Map([[existing.id, existing]]));
            await store.writeAll(
              importOps(parsed.backup, preview, "skip", { newId: uuid, importSettings: true }),
            );
          }
          // The existing song is untouched, and everything stored is valid.
          expect(await store.get("songs", existing.id)).toEqual(existing);
          const { songProblems } = await import("../../src/core/song/song.ts");
          for (const v of Object.values(store.dump().songs ?? {}))
            expect(songProblems(v)).toEqual([]);
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe("F37 learning progress in backups", () => {
  const progress = rateRoll(
    rateRoll(rateRoll(EMPTY_PROGRESS, "forward", "got-it"), "forward", "got-it"),
    "forward",
    "got-it",
  );

  it("is exported, read back, and restored into the meta store", () => {
    const backup = makeBackup({
      appVersion: "1",
      songs: [],
      songPrefs: [],
      settings: DEFAULT_SETTINGS,
      practiceLog: [],
      learning: progress,
    });
    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed.ok && parsed.backup.learning).toEqual(progress);
    if (!parsed.ok) return;
    const ops = importOps(parsed.backup, previewImport(parsed.backup, new Map()), "skip", {
      newId: uuid,
      importSettings: false,
    });
    const put = ops.find((o) => o.op === "put" && o.store === "meta" && o.key === "learning");
    expect(put && put.op === "put" && (put.value as typeof progress).rolls.forward?.level).toBe(2);
  });

  it("an older backup with no progress restores nothing and changes nothing", () => {
    const old = JSON.parse(
      JSON.stringify(
        makeBackup({
          appVersion: "1",
          songs: [],
          songPrefs: [],
          settings: DEFAULT_SETTINGS,
          practiceLog: [],
        }),
      ),
    );
    delete old.learning;
    const parsed = parseBackup(JSON.stringify(old));
    expect(parsed.ok && parsed.backup.learning).toEqual(EMPTY_PROGRESS);
    if (!parsed.ok) return;
    const ops = importOps(parsed.backup, previewImport(parsed.backup, new Map()), "skip", {
      newId: uuid,
      importSettings: false,
      currentLearning: progress,
    });
    expect(ops.some((o) => o.store === "meta")).toBe(false);
  });

  it("restoring an old backup never takes away progress already made", () => {
    const behind = rateRoll(EMPTY_PROGRESS, "forward", "got-it");
    const backup = makeBackup({
      appVersion: "1",
      songs: [],
      songPrefs: [],
      settings: DEFAULT_SETTINGS,
      practiceLog: [],
      learning: behind,
    });
    const ops = importOps(backup, previewImport(backup, new Map()), "skip", {
      newId: uuid,
      importSettings: false,
      currentLearning: progress,
    });
    const put = ops.find((o) => o.op === "put" && o.store === "meta");
    expect(put && put.op === "put" && (put.value as typeof progress).rolls.forward?.level).toBe(2);
    expect(mergeProgress(behind, progress).rolls.forward?.level).toBe(2);
  });

  it("damaged progress in a backup is dropped, not fatal", () => {
    const text = JSON.stringify({
      ...makeBackup({
        appVersion: "1",
        songs: [],
        songPrefs: [],
        settings: DEFAULT_SETTINGS,
        practiceLog: [],
      }),
      learning: { version: 1, rolls: { forward: 5 } },
    });
    const parsed = parseBackup(text);
    expect(parsed.ok && parsed.backup.learning).toEqual(EMPTY_PROGRESS);
  });
});

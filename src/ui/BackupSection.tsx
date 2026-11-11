// F18 export / import in Settings: one file with Dad's songs, settings, favorites and practice
// state, through the share sheet; restore with a preview and an all-or-nothing write.

import { useState } from "preact/hooks";
import type { Services } from "../app/services.ts";
import type { AppStore } from "../app/store.ts";
import type { Backup, ConflictChoice, ImportPreview } from "../app/backup.ts";
import {
  backupFileName,
  importOps,
  makeBackup,
  parseBackup,
  previewImport,
} from "../app/backup.ts";
import type { Song } from "../core/song/song.ts";

export function daysAgo(iso: string | null, now = Date.now()): string {
  if (!iso) return "never";
  const days = Math.floor((now - Date.parse(iso)) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

export function BackupSection({ store, services }: { store: AppStore; services: Services }) {
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState<{
    backup: Backup;
    preview: ImportPreview;
    skipped: readonly string[];
  } | null>(null);
  const [choice, setChoice] = useState<ConflictChoice>("keep-both");

  const exportNow = async () => {
    const backup = makeBackup({
      appVersion: __APP_VERSION__,
      songs: store.songs,
      songPrefs: [...store.prefs.value.values()],
      settings: store.settings.value,
      practiceLog: [],
      learning: store.learning.value,
    });
    const blob = new Blob([JSON.stringify(backup, null, 1)], { type: "application/json" });
    const result = await services.share.shareFile(backupFileName(), blob);
    if (result === "shared" || result === "downloaded") {
      store.markBackedUp();
      setStatus(result === "shared" ? "Backup shared." : "Backup saved to your downloads.");
    } else if (result === "failed") {
      setStatus("Couldn't make the backup file. Try again.");
    }
  };

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    const parsed = parseBackup(await file.text());
    if (!parsed.ok) {
      setStatus(parsed.error);
      return;
    }
    const existing = new Map<string, Song>(
      store.songs.filter((s) => s.source === "user").map((s) => [s.id, s]),
    );
    setPending({
      backup: parsed.backup,
      preview: previewImport(parsed.backup, existing),
      skipped: parsed.skipped,
    });
  };

  const applyImport = async () => {
    if (!pending) return;
    // Everything is prepared before the transaction; then one all-or-nothing write.
    const ops = importOps(pending.backup, pending.preview, choice, {
      newId: () => crypto.randomUUID(),
      importSettings: true,
      currentLearning: store.learning.value,
    });
    try {
      await services.storage.writeAll(ops);
    } catch (e) {
      services.diagnostics.log(
        "error",
        `Import failed: ${e instanceof Error ? e.message : String(e)}`,
      );
      setStatus("The restore didn't work, and nothing was changed. Try again.");
      return;
    }
    await store.reload();
    const n = ops.filter((o) => o.store === "songs").length;
    setStatus(`Restored ${n} song${n === 1 ? "" : "s"}.`);
    setPending(null);
  };

  const userSongs = store.songs.filter((s) => s.source === "user").length;
  return (
    <section>
      <h3>Back up my songs</h3>
      <p>
        Safari can clear a website's saved data, so keep a copy of your songs somewhere else. Last
        backup: <strong data-testid="last-backup">{daysAgo(store.lastBackupAt.value)}</strong>.
        {userSongs > 0
          ? ` You have ${userSongs} song${userSongs === 1 ? "" : "s"} of your own.`
          : ""}
      </p>
      <p class="setting-help">Recordings aren't included, because they're too big.</p>
      <div class="button-row">
        <button class="plain-button" data-action="export" onClick={() => void exportNow()}>
          Back up my songs
        </button>
        <label class="plain-button file-button">
          Restore from a backup
          <input
            type="file"
            name="import"
            accept=".json,application/json"
            onChange={(e) => void pickFile((e.target as HTMLInputElement).files?.[0])}
          />
        </label>
      </div>
      {pending && (
        <div class="import-preview" data-testid="import-preview">
          <p>
            {pending.backup.songs.length} song{pending.backup.songs.length === 1 ? "" : "s"} in this
            backup: {pending.preview.newSongs.length} new, {pending.preview.identical} already here
            {pending.preview.conflicts.length > 0
              ? `, ${pending.preview.conflicts.length} changed`
              : ""}
            .
            {pending.skipped.length > 0
              ? ` ${pending.skipped.length} couldn't be read and will be skipped.`
              : ""}
          </p>
          {pending.preview.conflicts.length > 0 && (
            <fieldset class="setting-row choice">
              <legend>Songs that are different here</legend>
              <div class="segmented">
                {(
                  [
                    ["keep-both", "Keep both"],
                    ["replace", "Use the backup"],
                    ["skip", "Keep mine"],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    name="conflict"
                    class={choice === v ? "on" : ""}
                    aria-pressed={choice === v}
                    onClick={() => setChoice(v)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <div class="button-row">
            <button
              class="big-button"
              data-action="confirm-import"
              onClick={() => void applyImport()}
            >
              Restore
            </button>
            <button class="plain-button" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {status && <p role="status">{status}</p>}
    </section>
  );
}

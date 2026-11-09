// F20 settings (basic), F22 display options and F25 diagnostics.

import { useState } from "preact/hooks";
import type { AppStore } from "../app/store.ts";
import type { Services } from "../app/services.ts";
import { SIZE_STEPS } from "../app/model.ts";
import { DEERING_SPIKES } from "../core/banjo/tuning.ts";
import { BackupSection } from "./BackupSection.tsx";

function Toggle({
  label,
  checked,
  onChange,
  name,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  name: string;
}) {
  return (
    <label class="setting-row">
      <span>{label}</span>
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(e) => onChange((e.target as HTMLInputElement).checked)}
      />
    </label>
  );
}

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
  name,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
  name: string;
}) {
  return (
    <fieldset class="setting-row choice">
      <legend>{label}</legend>
      <div class="segmented">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            name={name}
            aria-pressed={o.value === value}
            class={o.value === value ? "on" : ""}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function SettingsPage({ store, services }: { store: AppStore; services: Services }) {
  const s = store.settings.value;
  const [shareResult, setShareResult] = useState("");
  const [updateText, setUpdateText] = useState("");
  const entries = services.diagnostics.entries();
  const spikesKey = s.spikes.length === 0 ? "none" : "deering";

  return (
    <div class="settings-page" role="dialog" aria-modal="true" aria-label="Settings">
      <header class="settings-head">
        <h2>Settings</h2>
        <button class="big-button" onClick={() => (store.settingsOpen.value = false)}>
          Done
        </button>
      </header>

      <section>
        <h3>Display</h3>
        <Choice
          label="Size"
          name="size"
          value={String(s.size)}
          options={SIZE_STEPS.map((_, i) => ({
            value: String(i),
            label: ["Small", "Normal", "Large", "Largest"][i]!,
          }))}
          onChange={(v) => store.updateSettings({ size: Number(v) })}
        />
        <Choice
          label="Show"
          name="defaultView"
          value={s.defaultView}
          options={[
            { value: "both", label: "Notes and tab" },
            { value: "tab", label: "Tab only" },
          ]}
          onChange={(v) => store.updateSettings({ defaultView: v })}
        />
        <Toggle
          name="showRollNames"
          label="Roll names above the tab"
          checked={s.showRollNames}
          onChange={(v) => store.updateSettings({ showRollNames: v })}
        />
        <Toggle
          name="showAccents"
          label="Accent marks (>)"
          checked={s.showAccents}
          onChange={(v) => store.updateSettings({ showAccents: v })}
        />
        <Toggle
          name="showLyrics"
          label="Song words under the notes"
          checked={s.showLyrics}
          onChange={(v) => store.updateSettings({ showLyrics: v })}
        />
        <Toggle
          name="showFingerStrip"
          label="Big finger letters while playing"
          checked={s.showFingerStrip}
          onChange={(v) => store.updateSettings({ showFingerStrip: v })}
        />
        <Toggle
          name="visualMetronome"
          label="Flashing beat light"
          checked={s.visualMetronome}
          onChange={(v) => store.updateSettings({ visualMetronome: v })}
        />
        <Toggle
          name="colorBadges"
          label="Colored finger badges"
          checked={s.colorBadges}
          onChange={(v) => store.updateSettings({ colorBadges: v })}
        />
      </section>

      <section>
        <h3>Banjo</h3>
        <Choice
          label="Fret numbers when using a capo"
          name="fretNumbering"
          value={s.fretNumbering}
          options={[
            { value: "actual", label: "Actual frets" },
            { value: "capo-relative", label: "Count from the capo" },
          ]}
          onChange={(v) => store.updateSettings({ fretNumbering: v })}
        />
        <Choice
          label="5th-string spikes"
          name="spikes"
          value={spikesKey}
          options={[
            { value: "none", label: "None" },
            { value: "deering", label: "At frets 7, 9 and 10" },
          ]}
          onChange={(v) =>
            store.updateSettings({ spikes: v === "none" ? [] : [...DEERING_SPIKES] })
          }
        />
        <p class="setting-help">
          Spikes are small hooks beside the 5th string. Without them, the app tells you to tune the
          5th string up instead.
        </p>
        <Toggle
          name="keepAwake"
          label="Keep the screen on while a song is open"
          checked={s.keepAwake}
          onChange={(v) => store.updateSettings({ keepAwake: v })}
        />
      </section>

      <BackupSection store={store} services={services} />

      <section>
        <h3>About</h3>
        <p>
          Version {__APP_VERSION__} ({__BUILD_SHA__}
          {__BUILD_CHANNEL__ !== "production" ? `, ${__BUILD_CHANNEL__}` : ""})
        </p>
        <p>
          {services.offline.offlineReady
            ? "Works without Wi-Fi."
            : "Not ready to work without Wi-Fi yet."}
        </p>
        <div class="button-row">
          <button
            class="plain-button"
            onClick={() => {
              setUpdateText("Checking…");
              void services.offline
                .checkForUpdate()
                .then((waiting) =>
                  setUpdateText(
                    waiting
                      ? "A new version is ready. It loads next time you open the app."
                      : "You have the latest version.",
                  ),
                );
            }}
          >
            Check for update
          </button>
          <button class="plain-button" onClick={() => location.reload()}>
            Reload the app
          </button>
        </div>
        {updateText && <p role="status">{updateText}</p>}
        <p class="setting-help">
          Instrument sounds: the FluidR3_GM soundfont by Frank Wen (CC BY 3.0), via
          midi-js-soundfonts by Benjamin Gleitzman. The mandolin sound is generated by the app.
          Notation drawn with abcjs. Every song chart and tab here was written fresh for this app.
        </p>
      </section>

      <section>
        <h3>Diagnostics</h3>
        <p>
          {entries.length === 0
            ? "No problems recorded."
            : `${entries.length} entr${entries.length === 1 ? "y" : "ies"} recorded. Send them to Jeff if something went wrong.`}
        </p>
        <div class="button-row">
          <button
            class="plain-button"
            onClick={() => {
              void services.share
                .shareText("Banjo Practice diagnostics", services.diagnostics.report())
                .then((r) =>
                  setShareResult(
                    r === "copied"
                      ? "Copied. Paste it into a message to Jeff."
                      : r === "failed"
                        ? "Couldn't share. Try again."
                        : "",
                  ),
                );
            }}
          >
            Share diagnostics
          </button>
        </div>
        {shareResult && <p role="status">{shareResult}</p>}
        {entries.length > 0 && (
          <ol class="diagnostics-list">
            {entries
              .slice(-20)
              .reverse()
              .map((e, i) => (
                <li key={i} class={`diag-${e.level}`}>
                  <time>{e.time.replace("T", " ").slice(0, 19)}</time> {e.message}
                </li>
              ))}
          </ol>
        )}
      </section>
    </div>
  );
}

# Banjo Practice App: Chaos Testing Specification

Nov 8, 2026 · Jeff (drafted with Claude) · **Rev 2**, after an independent review by Fable (changes in §11)

This is the stability test plan for the app in [`DEVELOPMENT.md`](DEVELOPMENT.md). Its premise: **Dad will tap things in an order nobody planned, while the iPad does things nobody controls** (phone calls, low battery, Safari clearing storage, Bluetooth dropping, iPadOS quietly reloading the app). The app must never lose his songs, never freeze, never get stuck silent, and never forget where he was.

IDs such as `C4`, `P2`, `F17` refer to [`DEVELOPMENT.md`](DEVELOPMENT.md).

---

## 1. What "stable" means: the invariants

Every chaos run checks these after **every** action. A run fails the first time any of them breaks. The "Engines" column says where an invariant can actually be checked: **C** = Chromium, **W** = WebKit (subject to spike S0), **iPad** = manual checklist only.

| ID | Invariant | How it's checked | Engines |
| --- | --- | --- | --- |
| I1 | **No uncaught errors**: no uncaught exception or unhandled promise rejection | `onerror` / `unhandledrejection` hooks + Playwright console listener | C, W |
| I2 | **Responsive**: main thread never blocked > 200 ms; any tap gets visible feedback within 300 ms | Chromium: Long Tasks observer. WebKit: rAF-gap heuristic (no Long Tasks API). Both: action-to-DOM-change timer | C, W |
| I3 | **Toolbar always reachable**: Play/Stop visible, enabled, on screen and clear of the safe-area inset | DOM query | C, W |
| I4 | **Transport consistent**: if the UI says stopped, no events are scheduled after `now + 50 ms`, and output RMS is below threshold within 500 ms of Stop (no stuck notes) | Test hook vs UI; audio probe | C, (W) |
| I5 | **Highlight valid**: while playing, exactly one measure is highlighted, and it equals the scheduler's own current measure (within 50 ms). During count-in and loop pause, zero or the next measure per spec; within a loop, always inside it | DOM + scheduler hook | C, W |
| I6 | **No data loss**: every song that existed (or that the UI confirmed as saved) still exists and is byte-identical, unless the user deleted it, in which case it's in `trash` | Shadow model (§4.3) vs P1 dump | C, W |
| I7 | **Storage integrity**: every record in P1 parses against its schema at the current `schemaVersion` | Schema validation of a full dump | C, W |
| I8 | **Banjo legality**: every arrangement shown or played passes C4's hard rules **in written order** (repeat/ending joins may warn; loop restarts are exempt), or the measure is visibly flagged "can't place" | C4 on the current arrangement | C, W |
| I9 | **Context agreement**: displayed notation key, tab capo instruction, audio pitch offset and tuner targets all derive from the same `PracticeContext` | Compare derived values via hooks | C, W |
| I10 | **Recoverable audio**: after any interruption, one tap on Play produces sound within 1 s | Audio probe (§3.2) | C, (W), iPad |
| I11 | **Bounded resources**: across 10 identical play/stop loops after warm-up, JS heap grows < 20% (Chromium only), **live `AudioBuffer`s and audio nodes return to baseline** (all engines, via hook; decoded audio lives outside the JS heap) | `performance.memory` / CDP; resource-count hook | C (heap), C, W (counts) |
| I12 | **No blank screen**: the app root always has rendered content. An error-boundary screen passes I12 but fails I1 | DOM | C, W |
| I13 | **One audio context**: never more than one live `AudioContext` | Hook counting created minus closed | C, W |
| I14 | **No clipping**: output peak stays below 0 dBFS (after the master limiter) | Audio probe | C, (W) |
| I15 | **Wake lock correct**: wake lock is held if and only if a song is open, the setting is on and the app is visible | P5 hook | C, W (fake) |
| I16 | **Session restorable**: after any step, a hard reload returns to the same song, key, tempo, loop and practice mode (stopped), and to the same scroll position within one line | Snapshot before reload vs after (§6.5) | C, W |

(W) means it's checked on WebKit in Linux CI, where Playwright WebKit has Web Audio. It doesn't on Windows, so local runs check (W) audio rows in Chromium only (§9).

---

## 2. Test tiers

| Tier | What | Runs where | When |
| --- | --- | --- | --- |
| T1 | Property and fuzz tests of the pure core | Vitest + fast-check (Node) | Every commit |
| T2 | UI monkey: random user actions with invariant checks | Playwright, Chromium (+ WebKit per S0) | Every PR (5 min), nightly (60 min per engine) |
| T3 | Fault injection: scripted platform failures, alone and combined with the monkey | Playwright + chaos layer | Every PR (core scenarios), nightly (all) |
| T4 | Soak: long sessions | Playwright, Chromium | Nightly (2 h), before release (8 h) |
| T5 | Manual iPad chaos checklist | Dad's iPad (or a spare), installed Home Screen app | Before every promote to Dad's URL |
| T6 | Production smoke: the promoted artifact, DOM-only invariants (I1, I3, I6 via export, I12, I16) | Playwright, Chromium + WebKit | After every promote |

T6 exists because the chaos-instrumented test build is not byte-identical to what Dad runs.

---

## 3. Architecture of the harness

### 3.1 The chaos layer

All platform services P1–P8 are interfaces (DEVELOPMENT.md §5). Test builds swap in **chaos wrappers** around the real implementations.

```ts
interface ChaosController {
  seed(n: number): void;
  arm(fault: FaultSpec): FaultHandle;   // e.g. { service: "storage", op: "put", kind: "QuotaExceeded", nth: 3 } or { probability: 0.2 }
  disarm(h: FaultHandle): void;
  disarmAll(): void;
  log(): FaultEvent[];                  // every fault actually fired, for the repro trace
}
```

- Exposed as `window.__banjoChaos` and `window.__banjoTest` **only in test builds**. A build check fails if `/src/chaos` code or these globals appear in the production bundle.
- **Fakes model observed iPad behavior, not ideal behavior** (from spike S3). For example, the fake `interrupted` context's `resume()` rejects until the next simulated tap, and the fake route change flips `sampleRate`. Rows in §6 marked **(fake-verified)** are only as good as these models, so they're re-checked by hand in T5.

### 3.2 Two kinds of run: deterministic and real-time

A real-time audio app can't be replayed bit for bit: how many storage operations happen depends on timing, so "fault on the 3rd put" fires at different moments in different runs. The harness therefore has two modes:

| Mode | Clock | Audio | Replay guarantee | Used for |
| --- | --- | --- | --- | --- |
| **Deterministic** | Fake P8 clock, advanced by the harness | `OfflineAudioContext`, rendered and analysed | Same seed + same actions = same faults, same result. **Any flake here is a bug** | T1, most of T2 and T3, all audio sync and onset tests |
| **Real-time** | Real clock | Real `AudioContext` | Statistical: failures saved with full artifacts, rerun ×20 to estimate a rate | Timing and jank scenarios, soak, unlock path, T6 |

**Audio probe.** In test builds the scheduler's output also feeds an `AnalyserNode`.
- `__banjoTest.audio.rmsLast(ms)`, `peak()`, `scheduledEvents(from, to)`, `lateEvents()` and resource counts back I4, I10, I11, I13 and I14.
- Sync tests render with `OfflineAudioContext` and run onset detection: they're exact and CI-safe.
- The unlock path is tested in a separate real-time run **without** `--autoplay-policy=no-user-gesture-required`.

### 3.3 Seeds, reproduction and shrinking

- Every run prints `CHAOS_SEED=<n>` and its mode. `npm run chaos -- --seed <n>` replays it.
- On failure the harness saves: seed, action trace (JSON), fault log, screenshot, console, storage dump and the last 200 diagnostics entries.
- **Shrinking** (deterministic mode): delta debugging on the action trace (drop halves, then single actions) to find a minimal failing sequence, saved alongside.
- Every fixed bug gets its minimal trace committed under `tests/chaos/regressions/` as a permanent test.

---

## 4. T2: the UI monkey

### 4.1 Action catalog

The monkey picks weighted random actions that are valid in the current state (it reads the DOM for enabled controls). About 15% of the time it deliberately picks a **hostile** variant. Groups are enabled phase by phase (§10).

| Group | Actions | Hostile variants |
| --- | --- | --- |
| Navigation | Open song, toggle sidebar, settings, chord finder, editor, back | Open another song **while playing**; rapid toggle × 20 |
| Lifecycle | Background/foreground, **hard reload**, rotate, resize, device-pixel-ratio change, text-size change | Reload during count-in, mid-save, mid-import, with the editor open; resize every 100 ms during playback |
| Transport | Play, Stop, Restart, auto-repeat | Play/Stop storm (50 taps in 2 s); Play or Stop during count-in or loop pause |
| Tempo | Slider, −/+, long-press, tap tempo, presets | Slam to min/max; change on every beat; tap tempo with 1 tap or 30 erratic taps |
| Key | Pick a key, toggle notation sounding/shape key | Change key mid-play 12 times; during count-in; to a key that needs re-arranging |
| Parts | Toggle parts, volumes, melody instrument | All parts off while playing; change instrument while its samples load |
| Loop | Section a–b, A/B part loops, loop pause, clear | a > b; a = b; across a repeat sign and an ending; on a pickup; set a loop then change song; part loop on a song with no repeats |
| Practice modes | Echo mode, step mode (next/previous), speed builder | Switch mode mid-phrase; step past the last note; speed builder with step 0, start > target, target > max |
| Display | Size, tab-only, roll labels, finger strip, visual metronome, print tab | Print during playback; print a 64-measure song |
| Chord finder | Pick a chord, step voicings, play, change capo | Exotic chords (C♯m7♭5, B♭sus4); capo 12; play a voicing while the song plays |
| Editor | Add, delete and change notes, durations, chords, roll override; save; cancel | Overfill a measure; delete every note; illegal roll override; navigate away mid-edit; save twice fast |
| Data | Favorite; export, import (fixture library §5.3), delete song, undo from trash | Import during playback; delete the song that's playing; import the same file twice |
| Pedal | PageDown, PageUp, arrows, Space, Enter | Key repeat at 30 Hz; unknown keys; pedal events while a dialog or text field is focused |
| Practice | Tuner, recording, play take | Record without mic permission; record during playback; play a take while recording |

Default weights favor what Dad really does (open song, play, stop, tempo, loops ≈ 60%).

### 4.2 Run shape

- Steps: 500 per PR run, 5,000 per nightly run per engine.
- Random waits between actions (0–1,500 ms, skewed short; fake-clock advances in deterministic mode).
- Every 100 steps, a **checkpoint**: I6 and I7 (full storage compare), I11 resource counts, and an I16 reload check.

### 4.3 Shadow model (for I6)

The harness keeps its own model of what should be in storage: confirmed saves, deletes (→ trash), imports, favorites and session state. At each checkpoint the model is compared with a P1 dump. A difference fails I6, unless an armed storage fault caused it *and* the UI showed an error saying the save failed. **A silent loss is always a failure.**

---

## 5. T1: property and fuzz tests (pure core)

### 5.1 Banjo core properties

| Target | Property |
| --- | --- |
| C3 roll and lick library | Every roll, every legal half-roll pair and every lick template passes C4, including the wrap-around join |
| C4 validator | For each hard rule, a generator builds random violations of that rule and C4 reports *that* rule. Random legal measures built from templates (including pinches, holds, rests and slurs) report nothing. The DEVELOPMENT.md C5 fixture lines report nothing. Never throws on any input |
| C6 arranger | For random melodies (key from the C8 table with all 4 modes, meter 4/4, 2/2 or 2/4 with `rollUnit` 1/8 or 1/16, 4–64 measures, chords from the key, pickups, repeats, endings): output passes C4 hard rules in written order, or the measure is marked "can't place" with a reason. Finishes within budget. **Deterministic** (exact DP: same input, same output). Kept melody notes sit on their slots with `isMelody` |
| C6 overrides | Pinning a legal roll on any measure still gives a fully legal arrangement; pinning an illegal one is rejected with a message, never silently changed |
| C7 voicings | Pitch classes ⊆ chord tones. Triads include root and third; 7th chords include root and 7th. Reach ≤ 4 frets. Finds every guide §8 shape, **including D7 `0 2 1 0`**. Never throws for any parsable chord |
| C8 position plan | For all 12 tonics × 4 modes × spike sets: capo ≤ 5 unless offered as an alternative, instruction text non-empty, 5th-string target correct. **Every tab note's sounding pitch equals the notation pitch** (via C2) |
| C2 fretboard | `pitchAt` ↔ `positionsFor` round-trip; 5th string never fretted below 6; capo-relative ↔ actual fret conversion round-trips for spike and retune |
| C1 theory | Transpose +n then −n is the identity (pitch and spelling); chord symbol parse → format round-trip; no ♯ spellings in flat keys; mode is preserved |

### 5.2 Format fuzzing

- **Tab text format (C5)**:
  - Random valid tab round-trips exactly.
  - Byte-level mutations of valid files give errors with line and column, never an uncaught exception or a hang (timeout 100 ms per input).
  - Token-count mismatches (≠ slots) are reported clearly.
- **ABC input (C9)**:
  - Mutated ABC from the built-in songs (dropped bars, bad meters, missing `K:`/`L:`, nested tuplets, huge note counts, unicode) parses to a song or gives a clear error.
  - Renderer and generators never crash on a song that parsed.

### 5.3 Import file fuzzing (F18)

A fixture library of hostile backup files:
- Empty file, non-JSON, JSON with a wrong top-level type, valid JSON with missing fields.
- Future `schemaVersion`, every past schema version, 10,000 songs, a 50 MB file.
- Duplicate IDs, ID collisions with built-ins, `__proto__` keys, script tags in titles, emoji titles.
- Truncated mid-file.

**Properties**:
- Import fully succeeds or changes nothing (dump before and after).
- **A 10,000-song import stays atomic** (catches a transaction auto-committed by a stray `await`).
- Titles always render as text.
- Every past schema version migrates and round-trips.

A lint rule also flags `await` of non-IDB promises inside transaction callbacks.

---

## 6. T3: fault-injection scenarios

Each scenario runs alone (scripted), then again with the monkey running.

### 6.1 Storage (P1)

| Scenario | Expected behavior |
| --- | --- |
| `QuotaExceeded` on save | Visible failure ("Couldn't save, storage full"). The draft is kept in memory and retried. Nothing existing is damaged |
| Tiny quota: Cache API precache fails too | The app still runs online. A clear "offline mode unavailable, storage full" notice. No install loop |
| IndexedDB open hangs or throws `UnknownError` | Open times out and retries. After repeated failure: read-only mode with built-ins and a banner. Diagnostics (localStorage mirror) still records it |
| IndexedDB unavailable at startup | Read-only with built-in songs, banner, no crash |
| IndexedDB blocked by another tab | Message, retry, no hang |
| **Database newer than this build** (rollback, or a staging leak) | Database never modified. Read-only with "Please update the app". No `VersionError` crash |
| Staging and production in the same browser | Separate databases and service-worker scopes: actions in one never change the other |
| Storage cleared mid-session | On the next read: "Your saved songs were cleared by Safari. Import your backup?" No crash |
| **All origin storage gone** (IDB + Cache + service worker), then online relaunch | Clean fresh-install path, offline cache rebuilt, backup-import prompt shown |
| Corrupt record in `songs` | That song is quarantined (listed in diagnostics with "export raw"). All others load |
| Failure mid-transaction during import | Rollback; storage identical to before |
| Slow storage (500 ms per op) | UI stays responsive (I2); saves show progress; slider drags don't queue hundreds of writes |

### 6.2 Audio (P2, P3, A1)

| Scenario | Expected behavior |
| --- | --- |
| Context starts `suspended` | First tap on Play unlocks and plays. Never a silent "playing" state |
| Context goes `interrupted` mid-play **(fake-verified)** | Transport → paused. One tap on Play resumes (I10). `resume()` rejecting before the tap is handled |
| **Sample-rate change** on route change or mic open **(fake-verified)** | Context recreated, old one closed (I13). Playback resumes at the correct pitch |
| App backgrounded mid-play, returns after 30 s | No burst of overdue notes. Position consistent. Wake lock re-acquired (I15) |
| Output device change | Playback continues or pauses cleanly |
| Sample fetch fails (offline before first cache) | That part shows "sound not downloaded yet"; other parts play; retried online |
| Sample decode fails or partial file | As above, plus a diagnostics entry |
| Decoded buffers dropped (simulated iOS memory pressure) | Next Play reloads them from cache transparently |
| Slow sample load (5 s) while hitting Play | Loading indicator, or start loaded parts with a notice. No double-start |
| Main-thread jank (200 ms stalls every 2 s) — real-time mode | No late events (look-ahead covers it); highlight catches up |
| CPU throttled 4× (Chromium) — real-time mode | No late events at default tempo; late-event rate reported at max tempo |
| Clock jump (`currentTime` +10 s) | Scheduler resyncs without a flood of missed notes |

### 6.3 Offline and updates (P4)

| Scenario | Expected behavior |
| --- | --- |
| Offline after first load, then reload | Fully works with cached songs and sounds |
| New version deployed mid-practice | **Nothing visible changes** and playback is uninterrupted. The new version applies on the next cold launch. "Check for update" in Settings finds it |
| Update with unsaved editor changes | The draft survives the update and reload |
| **Mid-deploy fetch**: precache install fails partway (some new assets 404) | Old version keeps serving, never a mix of old and new assets |
| Broken new service worker (throws on activate) | Old version keeps working; the kill-switch path recovers |
| Cache partially evicted | Missing assets refetched online; clear message offline |

### 6.4 Device, permissions and environment (P5–P8)

| Scenario | Expected behavior |
| --- | --- |
| Wake lock rejected or unsupported | Fallback or notice. No error loop |
| Wake lock released by the system mid-song | Re-acquired on the next visibility change (I15) |
| Mic permission denied (tuner, recording) | Friendly explanation pointing to iPad Settings. No crash, no repeated prompts |
| Mic revoked mid-recording | The recording so far is saved; clear message |
| Pedal key repeat at 30 Hz for 5 s | At most one transport change per debounce window; page never scrolls |
| **Pedal paired while a text field is focused** | Text field shows the "Pedal connected" hint; pedal keys still don't type into the field or trigger transport |
| Rotation, resize, device-pixel-ratio or text-size change during playback | Re-layout keeps the highlight on the right measure; no scroll loop |
| rAF throttled to 30 fps (Low Power Mode) | Highlight and finger strip stay within I5 tolerance |
| **Wall clock or timezone jump** | Practice-log sessions not split or merged wrongly; no negative durations |

### 6.5 Lifecycle: the page disappears

iPadOS discards backgrounded Home Screen apps and reloads them cold. Simulated by a hard reload (`page.reload()` with no `beforeunload`; only `pagehide` fires):

| Scenario | Expected behavior |
| --- | --- |
| Reload at a random monkey step (runs constantly in T2) | I16: same song, key, tempo, loop, mode and scroll, stopped |
| Reload mid-save | Either the old or the new record, never a corrupt one (I7) |
| Reload with the editor open and unsaved | Draft restored, with "Restored your unsaved changes" |
| Reload mid-import | Import either fully done or not at all |
| Reload during recording | Partial recording either saved and playable or discarded with a notice; never a corrupt take that crashes playback |

### 6.6 Combined ("bad day") scenarios

Nightly, with the monkey running:
1. **Phone call during a speed-builder loop**: interrupt at a random repeat, background 60 s, page discarded and reloaded. The song, tempo progress and loop are restored, and the log records the highest tempo.
2. **Storage full while editing, then an app update**: draft survives; save succeeds once space is freed.
3. **Offline + full eviction + import**: everything cleared, offline relaunch (app can't load: expected), back online, fresh install, import from Files. All songs restored.
4. **Pedal storm during a key change during count-in**, with Bluetooth headphones connecting (sample-rate change).
5. **Low memory**: all decoded buffers dropped while backgrounded, then Play.
6. **Rollback**: production rolled back one version after a schema migration. Read-only with an update prompt, no data touched; re-promote the newer build and all data is intact.

---

## 7. T5: manual iPad chaos checklist

These can't be automated. Run on the iPad **in the installed Home Screen app** (not in a Safari tab: it has separate storage and permissions) before every promote.

- [ ] Silent switch on / Silent mode on: songs still play (or the hint appears if S3 found no fix).
- [ ] FaceTime or phone call mid-song, decline, return: one tap resumes.
- [ ] Siri mid-song.
- [ ] Lock the screen mid-song, unlock.
- [ ] Open 8–10 heavy apps, then return: if iPadOS reloaded the app, it's back at the same song and place.
- [ ] Low Power Mode on: playback smooth, highlight acceptable, wake lock behavior noted.
- [ ] Connect, then disconnect Bluetooth headphones mid-song: **pitch still correct** (no sample-rate distortion).
- [ ] Open the tuner while a song was playing, then return to the song: pitch still correct.
- [ ] Bluetooth pedal: pair, use, turn it off mid-song, back on. With the pedal paired, tap the search box: the hint shows.
- [ ] Rotate repeatedly during playback. Split View or Stage Manager if supported.
- [ ] Airplane mode, then cold-launch from the Home Screen.
- [ ] Tuner on a real banjo, every string; 5th string with a spike and with a retune.
- [ ] Record with and without headphones; play back with the backing.
- [ ] Print tab to PDF and open it in Files.
- [ ] Export a backup to Files, delete a song, import, check it's back.
- [ ] "Dad mode": tap around fast and carelessly for 2 minutes. Nothing freezes or goes blank.
- [ ] Settings → Diagnostics: empty, or every entry explained.
- [ ] Re-check every **(fake-verified)** row in §6 that changed since the last release.

Record the iPad model, iPadOS version, app version and result in `tests/manual/ipad-log.md`.

---

## 8. T4: soak tests

| Soak | Duration | Pass criteria |
| --- | --- | --- |
| Loop one song, all parts, speed builder on | 2 h nightly / 8 h release | I11 (heap trend and resource counts flat), zero late events, I13 |
| Monkey at low intensity (1 action / 10 s), reloads included | 2 h | All invariants |
| Echo and step modes alternating | 1 h | I4, I5, I11 |
| Record/playback every 2 min | 1 h | Recording storage grows as expected, then flat at the 20-take cap; live buffer count flat |

---

## 9. CI and reporting

- **Phase 0 gate (spike S0)**: verify Web Audio, service workers and `setOffline` in Playwright WebKit on Windows. Rows marked (W) and WebKit runs of §6.2–6.3 are enabled only where it works. Otherwise those run in Chromium, with the iPad checklist covering WebKit.
  - **S0 result, Windows (Nov 8, 2026; Playwright WebKit 27.2, Chromium 158):** WebKit has **no Web Audio** (`AudioContext`, `webkitAudioContext` and `OfflineAudioContext` are all undefined). Service worker, offline reload and IndexedDB **work** in WebKit. Chromium passes all four. So on Windows, (W) audio rows run in Chromium only, with the iPad checklist covering Safari audio. WebKit still runs the storage, offline and DOM invariants.
  - **S0 result, Linux CI (ubuntu-latest, same day):** WebKit **has** Web Audio (context runs, time advances, output measurable, `OfflineAudioContext` renders) as well as service worker, offline and IndexedDB. **Decision: (W) rows, including audio, run in Linux CI. Local Windows runs use Chromium for audio.** The iPad checklist still covers real Safari behavior (silent switch, interruptions, route changes).
- **On every PR**: T1 in full, T2 for 5 min per engine (deterministic mode), and the T3 core scenarios (quota on save, suspended/interrupted, update mid-practice, reload at random step, newer database). **Any failure blocks the merge.**
- **Nightly**: T2 for 60 min per engine, all of T3 (both modes), T4 for 2 h. Failures open a GitHub issue automatically with the seed, minimal trace and artifacts.
- **Promote to Dad's URL**: nightly green on the commit, the T5 checklist, then T6 against the promoted artifact.
- **Flakes**: a flake in deterministic mode is a bug in the app or harness, fixed, never retried away. Real-time mode failures are tracked by rate. A rate increase between nightlies is treated as a regression.

---

## 10. Build order for the harness (matches DEVELOPMENT.md phases)

| Phase | Harness work |
| --- | --- |
| 0 | Chaos controller, P* fakes (modeled on S3 findings as they arrive), fake clock, seed/repro plumbing, T1 for C1–C5, production-strip build check, **S0 gate** |
| 1 | T2 monkey with navigation, lifecycle (incl. hard reload), display and favorites; I1–I3, I6, I7, I12, I16; storage faults (6.1), lifecycle faults (6.5); T6 production smoke |
| 2 | Audio probe and `OfflineAudioContext` tests; transport, tempo, key, parts, loop and pedal groups; I4, I5, I9–I11, I13–I15; audio and offline faults (6.2, 6.3); device faults (6.4); first soak |
| 2b | Practice-mode actions (part loops, loop pause, echo, step, tap tempo, notation toggle, finger strip, visual metronome); echo/step soak |
| 3 | Arranger and lick property tests (§5.1); I8; print-tab actions |
| 4 | Chord-finder actions and C7 properties |
| 5 | Editor and full data actions (export, import, delete, trash); import fuzz library (§5.3); bad-day scenarios 2, 3 and 6 |
| 6 | Tuner and recording actions; mic faults; recording soak |

---

## 11. Rev 2 changes (from the Fable review)

- **Invariants**:
  - Engines stated for each invariant. I2 uses a rAF-gap check on WebKit, since WebKit has no Long Tasks API.
  - I4 adds a silence-after-Stop check. I5 compares against the scheduler's own position. I8 excludes loop restarts. I11 counts audio buffers and nodes.
  - New: one audio context (I13), no clipping (I14), wake-lock correctness (I15) and session restore (I16).
- **Determinism**: split into deterministic (fake clock + `OfflineAudioContext`) and statistical real-time modes. The "flaky tests are bugs" rule now applies to deterministic mode only.
- **New fault classes**:
  - Lifecycle: page discarded and reloaded.
  - Storage and deploys: database newer than the build (rollback), staging/production isolation, full-origin eviction, mid-deploy partial precache, IndexedDB open hang, Cache API quota, transaction auto-commit.
  - Device: sample-rate change on route change, pedal-as-keyboard while typing, wall-clock/timezone jump, device-pixel-ratio and text-size change, rAF at 30 fps.
- **Realism**: fakes are modeled on observed iPad behavior and marked **(fake-verified)**. WebKit coverage depends on S0. Production artifact smoke tier T6 added.
- **Phase alignment**: phase-1 monkey data actions limited to favorites. New practice-mode actions in phase 2b. Update banner removed, so §6.3 now expects updates to be silent.

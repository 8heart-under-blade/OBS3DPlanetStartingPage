# P0 baseline and qualification record

## What this baseline establishes

The active `source-baseline.json` records 44 runtime files for the P3 browser
candidate, deliberately adding an editor-only preview document-navigation marker.
Accepted P2 is saved at `1d28784`, with its prior 44-file hashes retained in
`source-baseline-p2-complete.json`. The user reported editor/OBS acceptance;
scoped local Chrome automation is recorded in P3_BROWSER.md, not full qualification.
P1 is saved at commit `36d66c6`; its 36-file manifest is retained in
`source-baseline-p1-complete.json`. The pre-P1 licensed-asset manifest (31 files)
is retained in `source-baseline-assets.json`; the first P1 bootstrap manifest is
retained in `source-baseline-p1-boot.json`, and the pre-audio extraction manifest
in `source-baseline-p1-overlay.json`. The three scene scripts now call shared
typography/clock/audio helpers; tests reconstruct the original extracted scene files and match their pre-P1 hashes after undoing explicit
integration adapters and restoring archived helper definitions. Default tuned
numerical config, scene styles/assets, audio meter processing, legacy audio protocol,
shaders and scene math remain unchanged; lifecycle and failure behavior intentionally
differ. P2 adds a local-only session setup UI and meter-only subscription for new
audio sessions, without changing legacy subscription behavior. See [P1_RUNTIME.md](P1_RUNTIME.md). The asset migration itself was
performed on 2026-11-08. Original P0 hashes at commit
`ea5fb4c866e48b9c8ba4981191437d1ff61780c6` are retained unchanged in
`source-baseline-p0.json`. The root code license and Markdown notices are outside
the runtime source manifest but included in the build manifest.

This migration replaces Oracles/Twigs with Cinzel Decorative/Macondo, replaces
Earth day/night/specular and Moon maps, removes the unused 1k cloud map, verifies
the SSS 2k clouds, switches fallback map URLs to local files, and adds visible
texture credit plus a credits page. Scene numerical tuning is unchanged.
Typography and texture appearance are intentionally different; no visual parity
has been claimed or measured. See [asset audit](ASSET_AUDIT.md).

## Checks performed for the licensed-asset migration (pre-P1)

- Windows, Node v24.22.2: dependency installation, syntax/local references, all
  31 active runtime hashes, 19 asset hashes and license evidence hashes, build
  and static redistribution gate pass.
- All five replacement textures decode as 2048×1024 images. Specular PNG and
  upstream TIFF match at every decoded pixel (0 differences); ocean is white.
- Tests report Windows symlink privilege limitations as explicit skips. GNU tar
  archive tests require Linux/CI. Do not infer archive or symlink qualification
  from these skips.
- User accepted the local preview visually ("LGTM") and subsequently confirmed
  testing in OBS with working audio interaction. See the manual smoke record below.
  No browser/OBS captures, GPU measurements or lifecycle results were collected.
- Historical P0 review reports Linux tooling validation, but browser capture
  there was blocked by missing Playwright system libraries. It is not evidence
  that the current replacement set renders correctly.

A source-byte baseline does **not** establish visual parity, compatibility,
asset permissions, security or performance. Never regenerate it merely to make
an unexpected difference pass.

## User-reported manual smoke check — 2026-11-08 (pre-P1)

This acceptance predates the shared-bootstrap extraction; see the subsequent P1
feedback below. It is not qualification of later runtime changes.

- Build: uncommitted licensed-asset replacement based on `7cd2c22`.
- Local preview served on this Windows PC at `http://127.0.0.1:8080/`;
  supplied scene URLs selected `assets=offline`.
- User feedback: "LGTM", followed by "i also check with OBS, audio interaction
  is also working".
- Result: visual acceptance and OBS/audio-reactivity smoke check reported passing.
- Exact scenes exercised, actual asset-mode/source settings, resolution, OBS/CEF
  version, GPU/driver, duration and performance metrics were not supplied.
- This is user-reported evidence, not an assistant-observed or recorded test.
  It does not establish network-blocked offline operation, authentication failure/
  reconnect handling, repeated source transitions, context restoration or soak stability.

## P1 slice 1 user feedback — 2026-11-08

After the shared-bootstrap implementation and a request to refresh/recheck the
scenes in OBS, the user responded "LGTM lets continue". Record this as user
acceptance of slice 1, without inferring exact scene coverage, new audio results,
versions, performance measurements or a completed lifecycle test.

## P1 slice 2 user feedback — 2026-11-08

After the typography/clock extraction and a request to refresh all three OBS
sources and check fonts/clock updates, the user confirmed "all pages is ok".
Record user acceptance of all three pages for slice 2. No new measurements,
audio-specific retest, test duration or lifecycle qualification was reported.

## P1 slice 3 — audio extraction qualification

Dependency-free fake-WebSocket/crypto/timer tests cover the extracted controller.
After the slice 3 OBS refresh/recheck request, the user confirmed "audio reactivity
still works". Record user-reported audio smoke acceptance of the extracted
controller. No assistant-observed recording, new environment details or measured
network/authentication failure, reconnect or sustained lifecycle result was supplied.
Those qualification gates remain separate from the deterministic controller tests.

## Integrated P1 slices 4–6 — validation, not live qualification

- Windows / Node v24.22.2: checks, 36 runtime hashes, 19 asset hashes, build and
  static release eligibility pass. Tests: 149 total, 145 pass, four explicit
  platform-related skips, zero failures.
- Fake adapters exercise lifecycle generations, stale auth/reconnect callbacks,
  quality validation, lost/restored context events, cancelled RAFs/listeners,
  resource/late-texture disposal and safe failure diagnostics.
- These simulations do not qualify actual WebGL drivers, CEF context recovery,
  hosted-to-loopback policies or production OBS source lifecycle behavior.
- After the final all-page OBS visual/audio recheck request, the user confirmed
  "all is good". Record user-reported smoke acceptance of the integrated six slices.
  No specific quality-preset, context-loss/restoration or reconnect exercise was
  reported. The deferred soak and transition tests remain NOT TESTED.

## P2 candidate — automated validation and user-reported OBS smoke acceptance

- Static/source/asset/build/release gates pass: 44 runtime files, 19 third-party assets.
- Node tests: 207 total, 203 pass, four explicit platform skips, zero failures.
- Fake DOM/storage/file/clipboard and script-wrapper tests exercise editor changes,
  validated JSON/fragment URLs, Unicode/limits/migrations, credential-field rejection,
  initially disabled snapshot boot, retained legacy audio and reduced-motion clocks.
- Fresh drafts now use local-only Auto audio, with session-only OBS Interact entry
  when authentication is enabled; unauthenticated local OBS requires no password.
  Public-hosted copies and embedded previews stay silent. Dedicated synthetic tests
  cover protocol, isolation, cleanup, timeout and stale callbacks.
- After the local-only session audio handoff, the user confirmed "OBS testing is ok".
  Record P2 user-reported OBS smoke acceptance. Exact scenes, authentication modes,
  Interact steps, versions and test duration were not separately reported; do not
  infer coverage of both auth/no-auth paths or full production qualification.
- The user subsequently confirmed "tested the editor ok for me" and approved P3.
  Record editor acceptance without inferring exact feature/browser coverage.
  First-time nontechnical workflow, detailed coverage, keyboard and screen-reader
  qualification remain pending.
- No public hosting/deployment or production release is claimed. See P2_EDITOR.md.

## Candidate support matrix — NOT yet qualified

Record the precise OBS version, embedded Chromium/CEF version where available, OS, GPU/driver, display scaling, source size and browser version for each completed run. Do not label an OS/browser supported based solely on a syntax check.

| Candidate environment | Required checks | Current result |
| --- | --- | --- |
| Windows + current supported OBS | All scenes, offline assets, authentication, lifecycle, GPU soak | User reports visual/OBS/audio smoke pass on this PC; versions and full qualification pending |
| macOS + current supported OBS | Same; platform fonts and graphics behavior | Not run |
| Linux + current supported OBS | Same; graphics driver and sandbox behavior | Not run |
| Desktop Chromium, Firefox, Safari | Scene boot, local assets, resize, safe failures | Not run |
| Static host at repository subpath | Relative routes/assets, fragment preservation, no unintended root URLs | Not run |

Choose and publish actual supported versions only after these runs. An installer/local companion is not part of P0 and no clean-machine launcher is promised.

## Runtime baseline procedure

Use a trusted local HTTP server bound to loopback for developer testing (not a promised end-user installer). Run `index.html`, `brb.html`, and `thanks.html` at 1920×1080 and 1280×720; add a small editor viewport only after an editor exists.

For each scene:

1. Capture an initial frame and a short reference recording after textures finish loading. Record load timing, console output and network failures. Preserve the tuned default config. Procedural randomness and moving clocks make exact pixel equality inappropriate until a controlled clock/random seed is introduced for test fixtures.
2. Test direct page URLs and `?scene=starting|brb|thanks` aliases. Confirm query and fragment preservation across redirects.
3. Repeat with `?assets=offline`, blocking external network traffic while keeping the local server available. Confirm every font, texture and transitive ESM dependency loads locally. Then test `auto` and `cdn` separately, noting the distinction between external dependency availability and offline operation.
4. Test BRB replacement enabled/disabled and bloom enabled/disabled. Two graphics contexts may be active; measure before deciding to merge them. The current module loads its runtime before checking `enabled`; P1 should improve this without altering default appearance.
5. Disconnect OBS WebSocket; use an incorrect password; reconnect. Confirm the visuals remain usable. Keep credentials out of screenshots, reports and exported artifacts. Do not expose a real password in tracked `config.js`.
6. Resize, change display scaling, reload, and test context loss/restoration. Record actual behavior, not presumed cleanup. In OBS, test both shutdown-when-hidden and refresh-on-activation options. Browser `visibilitychange` is not necessarily equivalent to an inactive OBS source.
7. Run at least 20 activate/deactivate or reload transitions and a sustained playback session. Record frame-time distribution, CPU, memory and GPU use on identified hardware. Do not equate software-rendered headless Chrome with real OBS GPU qualification.
8. Exercise missing assets and WebGL-unavailable behavior. Document current limitations; P1/P2 will add user-safe fallbacks and a separate diagnostic view.

## Release evidence template

```text
Source commit / build version:
Tester / date:
OS / OBS / browser / CEF:
GPU / driver / display scaling:
Scene / source dimensions / quality / asset mode:
Network policy and OBS source lifecycle settings:
Pass/fail steps and reproduction:
Screenshots/video locations (no credentials):
Measured load time / frame time / CPU / memory:
Known exceptions and follow-up issue:
```

Store large videos/screenshots as CI artifacts or external test evidence rather than silently adding them to the production bundle. The source-byte baseline and user-reported smoke check above are the evidence available so far; no visual reference recordings have been captured.

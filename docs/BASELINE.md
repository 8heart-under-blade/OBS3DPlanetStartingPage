# P0 baseline and qualification record

## What this baseline establishes

The active `source-baseline.json` records 31 runtime files after the deliberate
2026-11-08 openly licensed asset migration. Original P0 hashes at commit
`ea5fb4c866e48b9c8ba4981191437d1ff61780c6` are retained unchanged in
`source-baseline-p0.json`. The root code license and Markdown notices are outside
the runtime source manifest but included in the build manifest.

This migration replaces Oracles/Twigs with Cinzel Decorative/Macondo, replaces
Earth day/night/specular and Moon maps, removes the unused 1k cloud map, verifies
the SSS 2k clouds, switches fallback map URLs to local files, and adds visible
texture credit plus a credits page. Scene numerical tuning is unchanged.
Typography and texture appearance are intentionally different; no visual parity
has been claimed or measured. See [asset audit](ASSET_AUDIT.md).

## Checks performed for this migration

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

## User-reported manual smoke check — 2026-11-08

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

# P0 baseline and qualification record

## What this baseline establishes

`source-baseline.json` records SHA-256 hashes and sizes for all 31 tracked runtime files at commit `ea5fb4c866e48b9c8ba4981191437d1ff61780c6`. It excludes the root code license and Markdown documents. It preserves the current tuned `config.js` alongside scenes, fonts, textures and vendor modules. A byte-identical source baseline does **not** establish visual parity, runtime compatibility, asset permissions, security or performance.

The production-foundation change must not alter these files. Future scene changes should first establish visual references, then deliberately update this manifest in the same reviewed change. Do not regenerate it merely to make an unexpected difference pass.

## Checks actually performed

- Node v22.22.1 parsed the five first-party JavaScript files with `node --check` before implementation.
- The classic vendor bundle declares revision `160`; the BRB overlay uses vendored ESM `0.181.0`. Do not infer the classic revision from its deprecation banner.
- The configured classic CDN URL returned HTTP 200 during the planning pass. Availability at one point is not an offline or rendering test.
- P0 contributor validation passed: first-party and inline-script syntax/local references; all 31 source-baseline hashes; all 20 asset-inventory hashes; 26 Node contract/regression tests; deterministic preview build and GNU tar archive packaging. Tests cover stale output, credential rejection, exact archive members, symlink handling and reproducibility. These are static/tooling tests, not browser tests.
- Asset eligibility remains blocked: six textures and two fonts have unresolved redistribution rights. CI does not publish downloadable previews while that gate fails.
- Browser baseline capture is **blocked in this environment**: installed Playwright Chromium is missing `libatk-1.0.so.0`, `libatk-bridge-2.0.so.0`, `libXdamage.so.1`, `libasound.so.2` and `libatspi.so.0`. No screenshots, WebGL results, OBS results, accessibility results or performance measurements have been obtained. No system libraries were installed by this task.

## Candidate support matrix — NOT yet qualified

Record the precise OBS version, embedded Chromium/CEF version where available, OS, GPU/driver, display scaling, source size and browser version for each completed run. Do not label an OS/browser supported based solely on a syntax check.

| Candidate environment | Required checks | Current result |
| --- | --- | --- |
| Windows + current supported OBS | All scenes, offline assets, authentication, lifecycle, GPU soak | Not run |
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

Store large videos/screenshots as CI artifacts or external test evidence rather than silently adding them to the production bundle. The source baseline is the only captured baseline in P0 so far.

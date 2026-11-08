# P1 shared runtime — implementation checkpoint

Base: pre-P1 checkpoint `703dbc6`. All six planned implementation slices are
integrated, and the user confirmed "all is good" after the final all-page OBS
visual/audio recheck request. All six slices have user-reported smoke acceptance.
**Full P1 production qualification is not complete.**

## Modules and load order

Each scene loads config.js, then runtime/settings.js, overlay.js, audio.js,
recovery.js, and finally boot.js with its fixed data-scene identifier.
These remain ordinary static scripts; no framework or end-user Node runtime.

- **StreamSettings**: trusted-JavaScript configuration checks and quality caps.
- **StreamOverlay**: typography and local clock, extracted without helper changes.
- **StreamAudio**: OBS controller, with generation-bound lifecycle hardening.
- **StreamRecovery**: disposable frames/listeners/resources and safe diagnostics.
- **StreamBoot**: routing, asset selection, script loading, optional BRB mounting.

CommonJS exports environment factories for dependency-free Node tests; classic
browser scripts install the corresponding window API. Test adapters do not
establish real WebGL or OBS compatibility.

## Slices 1–3: shared boot, overlay and audio

Scene aliases, relative routes, query/fragment preservation, explicit asset-mode
precedence and local-first auto fallback are preserved. Existing asset globals
remain available. The BRB ESM import is relative to runtime/boot.js, so it uses
../brb-blackhole/blackholeOverlay.module.js, not an HTML-relative path.

Typography and clock helper bodies are identical to the original copies. Their
CSS unit handling, font sources, Intl/time-zone fallbacks, one-second interval
and stop semantics are unchanged. Render-mode selection stays local to each scene.

The initial audio extraction preserved protocol and meter helpers. Subsequent
slice 4 intentionally changes controller lifecycle internals, not meter formulas.

User feedback:
- Slice 1: "LGTM lets continue".
- Slice 2: "all pages is ok".
- Slice 3: "audio reactivity still works".

These are user-reported smoke checks, not recorded/assistant-observed performance,
authentication-failure, reconnect, context-recovery or lifecycle qualification.

## Slice 4: audio lifecycle hardening

Connection/run generations guard socket callbacks, pending reconnect timers and
asynchronous authentication. Old callbacks cannot operate on a newer socket.
Start is idempotent while active; fresh starts reset meter/backoff state. Stop
detaches handlers, cancels timers, closes once and zeroes the shared feature
snapshot. Identify send failures use safe diagnostics and close only their socket.

Parent integration also fixes a stale cancelled timer that could otherwise clear
tracking for a newer reconnect timer. Deterministic tests capture and invoke old
callbacks and defer authentication completion to exercise these races.

Subscription mask, obswebsocket.json subprotocol, double-SHA256/base64 auth,
meter extraction, shaping, smoothing and decay remain unchanged. Tests compare
all non-lifecycle helper bodies and the complete update/ingest function bodies
with the archived pre-hardening module.

## Slice 5: config validation and opt-in quality

StreamSettings.resolve(source, search) returns {config, quality, warnings}.
It copies known sections without mutating source, rejects malformed known types,
nonfinite/out-of-range audio values and unsafe script/texture URL schemes, and
excludes prototype-pollution property names. Unknown trusted fields are retained.

Warnings are fixed codes, never supplied values, passwords or URLs. The normalized
runtime config is held in STREAM_RUNTIME_CONFIG; the original STREAM_CONFIG and
legacy STREAM_OVERLAY override remain intact. This is **not** a sandbox or a
safe parser for untrusted presets. No preset transport/editor/credential setup
path is introduced by P1.

Quality is selected by ?quality=, then config.quality, default tuned:
- tuned: no rendering-setting changes.
- low: pixel-ratio cap 1, fabric-segment cap 80, star-count scale 0.5.
- medium: caps 1.3 / 120, star-count scale 0.75.
- high: caps 2 / 176, star-count scale 1; never raises existing tuned settings.

Starting/BRB hardcoded star counts and the optional BRB renderer pixel ratio use
the same caps. No exposure, camera, orbital, shader or audio tuning changes.
Lower profiles intentionally alter geometry/density; no FPS claims are made.

## Slice 6: resource and failure recovery

Each base scene has a disposable scope for RAFs, resize/unload listeners, clock,
audio and reachable graphics resources. Nonpersisted pagehide also disposes;
visibilitychange is not treated as the sole OBS source-visibility signal.

Context loss prevents default, pauses the affected frame loop and stops base
audio/clock. Restoration reloads the same URL to rebuild safely, once per observer.
This preserves query/fragment settings. Disposal blocks later frames/events and
restoration reloads. Frame/listener/render exceptions dispose and report fixed
actionable messages rather than continuing a broken loop.

The BRB overlay has its own guarded scope, tracks async mounting, cancels frames,
disconnects ResizeObserver and disposes controls, bloom/composer and GPU resources.
Unload while its runtime is loading cannot create a late renderer. Disabled or
missing overlays do not import optional runtime dependencies.

Thanks tracks original procedural and in-flight/replacement textures, keeps
procedural fallbacks on failed maps, rejects late loads after disposal and uses
a loading manager whose diagnostic never echoes the failed URL. Resource disposal
deduplicates shared geometry/material/texture references, including shader uniforms.
Arbitrary userData is not traversed and contexts are not deliberately force-lost.

Boot checks required APIs and exposes ready/redirected/failed outcomes through
StreamBoot.ready. Ready means load/mount completion, not every pixel/font/audio
path has been verified. External script loads have a 15-second timeout. Auto mode
falls back on ordinary local load errors, but **fails closed on timeout** rather
than starting a competing runtime that a late script could overwrite.

## Preservation evidence

Historical source manifests: source-baseline-p0.json, source-baseline-assets.json,
source-baseline-p1-boot.json, source-baseline-p1-overlay.json and
source-baseline-p1-audio.json. Active source-baseline.json records the integrated set.

The approved slice-3 audio module is archived in tests/fixtures/audio-before-lifecycle.js;
its hash must match the saved manifest. Explicit integration edit recipes allow tests
to undo only declared lifecycle/quality adaptations, restore extracted helper bodies,
and match complete original scene hashes. This constrains unchanged shaders and
scene math while allowing the documented lifecycle changes. It is not pixel evidence.

## Validation and assistance

Windows / Node v24.22.2:
- check, baseline:verify (36 runtime files), assets:check (19 assets) pass.
- 149 tests: 145 pass, zero failures, four explicit platform skips.
- build (44 allowlisted inputs plus manifest), release:check, diff whitespace check pass.
- Skips: three Windows file-symlink privilege cases and one GNU tar archive test.
  Remote Linux/Windows CI and packaging were not run by this checkpoint.

OpenCode non-Flash free models assisted: Beam (compatibility/clock/audio lifecycle),
Flint 40B (earlier routing tests) and Crouton Alpha (recovery utilities/tests).
Flint hit its free usage limit on the settings task; it was dropped without retry.
The parent implemented settings/quality, scene integration and additional regressions.
This assistance is not a separate independent review of the complete final tree.

## Qualification still required

The user accepted the integrated pages after the OBS visual/audio recheck request.
This does not establish testing of specific quality presets, induced context
loss/restoration, network-blocked offline behavior, authentication/disconnect/reconnect,
identified hardware metrics or the explicitly deferred sustained-playback/repeated
transition checks. Those remain unqualified. No production-ready release is claimed.

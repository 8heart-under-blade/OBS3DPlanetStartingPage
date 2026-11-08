# Project progress and checkpoints

The saved pre-P1 checkpoint is commit `703dbc6`. P1 slice 1 subsequently started;
see the progress sections below, P1_RUNTIME.md and P2_EDITOR.md.
P1 is now saved at `36d66c6`; P2 is on `feature/no-code-editor`.

Date: 2026-11-08
Base: 7cd2c22 (production foundation)

## Completed

- Replaced Oracles/Twigs with unmodified, pinned Cinzel Decorative/Macondo OFL fonts.
- Replaced unverified Earth/Moon maps with Solar System Scope CC BY 4.0 assets;
  verified the existing 2k cloud map and removed the unused 1k cloud map.
- Converted the freshly downloaded specular TIFF to PNG; all decoded pixels match.
- Added visible texture credit, credits.html, bundled terms and provenance/hash evidence.
- Preserved historical P0 source hashes and recorded the intentional asset migration.
- Added license-evidence checks, migration regressions, LF checkout rules and Windows CI.
- OpenCode free models assisted with texture sourcing and independent read-only review.
  Review reported no blocking findings. Minor documentation findings were addressed;
  the Macondo notice's upstream encoding defect is documented with readable copyright
  from the unmodified font metadata. No second independent review is claimed.
- User accepted the local preview visually and reported OBS playback with working
  audio interaction. See BASELINE.md for the scope and missing environment details.

## Validation at checkpoint

- npm ci
- npm run check
- npm run baseline:verify
- npm run assets:check — 19 bundled third-party assets, zero unresolved rights
- npm test — 31 tests: 27 passed, 4 explicit platform-related skips, zero failures
- npm run build — 39 allowlisted inputs plus build manifest, preview only
- npm run release:check — static redistribution eligibility passes
- git diff --check

Windows skips: three file-symlink tests require Developer Mode/elevated privileges;
GNU tar packaging is not qualified on this host. Linux/Windows CI has been configured,
not run remotely as part of this checkpoint.

## Deferred explicitly by user

The user chose to proceed to P1 without the suggested 60-minute playback soak and
20-cycle scene-transition tests. These remain NOT TESTED, not passed or waived for
production release. Network-blocked offline playback, authentication failure/reconnect,
context restoration, recorded visual references, performance metrics and a fully
identified support matrix also remain unqualified.

This is an explicit exception to the roadmap's preferred baseline-before-refactoring
sequence. P0 is not fully qualified. P1 changes must remain incremental and must not
claim measured visual parity or production certification from this smoke check.

## P1 progress — slice 1

- Shared routing/asset bootstrap added in runtime/boot.js and wired into all three HTML shells.
- BRB skips optional ESM imports when disabled or its layer is absent.
- Numerical config, scene renderers, styles and all licensed assets remain byte-identical
  to the pre-P1 checkpoint; source-baseline-assets.json retains that manifest.
- OpenCode Beam Free audited compatibility; Flint 40B Free contributed routing tests.
  No Flash models used for this P1 work.
- Asset-mode, failure-path, browser-wrapper simulation and preservation regressions added.
- P1 is partial; audio/text/lifecycle extraction and quality/failure recovery remain.
- Validation: check, baseline:verify (32 runtime files), assets:check (19 assets),
  test (51 total: 47 pass, 4 platform-related skips, zero failures), build
  (40 allowlisted inputs plus manifest), release:check and git diff --check pass.
- User subsequently accepted slice 1 with "LGTM lets continue" after the refresh/recheck
  request. Exact scene coverage and new audio results were not separately reported.
- Previously deferred production qualification remains not tested.

## P1 progress — slice 2

- Extracted byte-identical typography and clock helpers into runtime/overlay.js.
- All HTML shells load config, overlay helpers, then bootstrap; missing helpers
  fail visibly before renderer initialization.
- Three scene files replace only two helper call sites and remove the extracted
  definitions. Reconstruction tests restore original files and match their
  pre-P1 hashes, including all original audio/rendering/cleanup code.
- Beam Free contributed fake-clock tests. No Flash models used.
- Validation: check, baseline:verify (33 runtime files), assets:check (19 assets),
  test (70 total: 66 pass, 4 explicit skips, zero failures), build
  (41 allowlisted inputs plus manifest), release:check and git diff --check pass.
- User subsequently confirmed "all pages is ok" after the slice 2 refresh/font/clock
  check request. Record all-page user acceptance, not a new measured performance,
  lifecycle or audio-authentication result.
- Audio/lifecycle extraction, quality presets and resource/context recovery remain.

## P1 progress — slice 3

- Extracted 13 identical controller/meter/auth helpers into runtime/audio.js.
- Scene files call StreamAudio.createController; render-mode selection stays local.
- The helper bodies, subscription mask, WebSocket subprotocol, meter math, reconnect
  behavior and existing start/stop/unload call sites are preserved.
- HTML loads config, overlay helpers, audio helpers, then bootstrap; missing audio
  helpers fail visibly before renderer initialization.
- Fake WebSocket/crypto/timer tests cover gates, Hello/Identify/auth, backoff/reset,
  stop, filtering/fallback, linear/dB meters, smoothing/decay and malformed inputs.
- Reconstruction tests match both the pre-audio slice and original pre-P1 scene
  hashes, constraining extraction rather than broadly exempting changed renderers.
- Beam Free provided a read-only compatibility audit; no Flash models used.
- Validation: check, baseline:verify (34 runtime files), assets:check (19 assets),
  test (85 total: 81 pass, 4 platform-related skips, zero failures), build
  (42 allowlisted inputs plus manifest), release:check and git diff --check pass.
- User subsequently confirmed "audio reactivity still works" after the slice 3
  OBS refresh/recheck request. This is user-reported audio smoke acceptance, not
  a measured authentication/reconnect, performance or lifecycle qualification.
- Broader lifecycle hardening, quality presets and context/resource recovery remain.
  At this slice, controller restart/auth-race behavior was not redesigned; slice 4 below addresses it.

## P1 progress — slices 4–6 integrated

All planned implementation slices are integrated; P1 acceptance/production
qualification is still pending. See P1_RUNTIME.md for the current architecture.

- Slice 4: generation-bound audio callbacks/reconnect/auth, clean start/stop and
  zeroed meter state. Beam Free implemented the module and tests. Parent fixed
  stale timer tracking and safe failed-Identify handling.
- Slice 5: shared trusted-JS config checks, normalized runtime config, safe warning
  codes, and opt-in tuned/low/medium/high quality caps. The tuned default leaves
  rendering values unchanged. Flint hit its free usage limit; it was dropped,
  with no retry. Parent completed this slice.
- Slice 6: Crouton Alpha supplied recovery utilities/tests. Parent integrated
  scopes into all scenes and the BRB overlay, including async mount cancellation,
  context loss/reload, GPU/texture disposal, safe errors and script timeouts.
- No Flash models were used. All delegated runs are terminal; no live child work remains.
- Validation: check, baseline:verify (36 runtime files), assets:check (19 assets),
  test (149 total: 145 pass, 4 platform-related skips, zero failures), build
  (44 allowlisted inputs plus manifest), release:check and git diff --check pass.
- After the final all-page OBS visual/audio recheck request, the user confirmed
  "all is good". All six slices now have user-reported smoke acceptance. No specific
  low/medium/high preset, induced context-loss or reconnect experiment was reported;
  deferred live qualification has not been marked passed.
- P1 is saved locally in the pre-P2 checkpoint commit containing this record.
  Nothing has been pushed; production qualification remains outstanding.

## P2 progress — local MVP candidate

- P1 was saved as commit 36d66c6 before creating feature/no-code-editor.
- Six implementation slices are integrated: versioned strict snapshot schema,
  accessible editor controls, same-URL iframe preview, presets/drafts/import/export,
  personalized OBS fragment URLs and guided setup/diagnostics.
- Crouton Alpha Free supplied editor.html/editor.css; Beam Free supplied validated
  draft storage/tests. Parent implemented protocol/controller/render integration.
  No Flash models or capped-Flint retries.
- Snapshot fields are allowlisted and nonsecret; payloads are bounded to 8 KiB UTF-8
  JSON and complete URLs to 12 KiB. Schema-0 prototype migration is documented/tested.
- Original local scene URLs retain working audio. Fresh editor drafts now use
  Auto local-only session audio; older drafts/links without audioMode remain Off.
  Local unauthenticated OBS needs no password; authenticated OBS prompts separately
  using Interact. Credentials never enter presets/links/storage. Hosted pages and
  embedded previews stay silent. Manual local port/input setup and Off are available.
  Copied links do not update with draft edits, and OBS does not share editor storage.
- Validation: check, baseline:verify (44 runtime files), assets:check (19 assets),
  test (207 total: 203 pass, 4 explicit platform skips, zero failures), build
  (52 allowlisted inputs plus manifest), release:check and git diff --check pass.
- A read-only contract review reported no blockers. Parent fixed two minor preview
  status/last-valid-state observations and added regression coverage; no delegated
  re-review or security certification is claimed.
- Subsequent read-only review of local session audio reported no blockers; parent
  added real-controller/fake-WebSocket tests for no-auth/auth, origin/frame isolation,
  memory-only credentials, strict endpoints, cleanup, timeout and stale callbacks.
- After the local session audio handoff, the user confirmed "OBS testing is ok".
  Record P2 user-reported OBS smoke acceptance without inferring exact scene,
  authentication/no-auth, Interact, version or duration coverage.
  Detailed browser/editor, accessibility and public-deployment qualification remain
  pending. Deferred soak/scene-transition checks are not marked passed.
- The user subsequently confirmed "tested the editor ok for me" and approved
  proceeding to P3. Record editor acceptance without inferring exact feature or
  browser coverage. Local P2 checkpoint authorized; nothing pushed.
  Deferred P1 production tests remain open.
- Local editor: http://127.0.0.1:8080/editor.html (existing loopback server).

## Original P1 handoff (at checkpoint)

1. Inspect duplicated configuration and asset boot loading across the three scenes.
2. Extract shared runtime helpers incrementally, preserving existing entry points,
   query/fragment routing, asset modes, credential safeguards and numerical scene tuning.
3. Extend regression tests and deliberately update the active source manifest with
   each runtime change; retain the historical P0 manifest.
4. Re-run static/tooling gates and obtain user browser/OBS smoke checks after changes.
5. Keep deferred qualification visible until completed before production release.

## Local testing setup

A loopback-only Node server was started from ../local-preview-server.cjs, outside the
repository. It serves this working tree, not a snapshot of dist/. Its process is not
part of the committed project and may stop when this PC/session restarts.

- http://127.0.0.1:8080/?assets=offline
- http://127.0.0.1:8080/brb.html?assets=offline
- http://127.0.0.1:8080/thanks.html?assets=offline

No credentials, server logs or generated dist/ files should be committed.
Nothing has been pushed or deployed as part of this checkpoint.

# Project progress and checkpoints

## Production preparation and user smoke qualification — 2026-11-09

See [PRODUCTION_QUALIFICATION.md](PRODUCTION_QUALIFICATION.md) for the identified
OBS 32.2.2 / Iris Xe / Linux setup, supplied resource recording, limitations and
local cumulative candidate pin. The user reports 60+ minutes of playback with
recording, all three scenes and more than 20 transitions/tests per scene, with no
observed blank frames or audio loss. Those previously deferred exercises now have
setup-specific user-reported smoke acceptance, not universal qualification.
OBS lag counters and CEF version were not recorded; I/O stalls and modest summed
RSS growth remain explicit limitations. Main CI 42550325111 passed all jobs.

A fresh local restore-before-build preparation preserves all three namespaces and
the tested accepted current; an additional fresh restore and 169-file live preview
comparison pass. New archive pin and paths are in the qualification record.
Public backup, download/restore verification, production upload and production URL
checks are still pending; no Cloudflare mutation or publishing approval is inferred.

## PR #3 browser failure correction — 2026-11-09, JMB-HP

- PR run 42544632971 failed the invalid-controls Copy-enabled assertion.
  Trace inspection on magi-1 found recovered links/enabled buttons in the final
  DOM, consistent with assertion polling starved by continuous full-HD SwiftShader
  rendering; this is not proof of an OBS/GPU performance defect.
- Three editor-only interaction tests now use the existing test-only controlled
  RAF queue. Real bootstrap and preview loading remain; audio/session tests keep
  frame-driven monitoring, and visual comparisons/reference.json are unchanged.
- Strengthened unchanged-value recovery/error clearing/manual-copy coverage and
  changed-value recovery through decoded URL and actual preview snapshot. Added
  a Node regression for restored links without redundant autosave.
- JMB-HP, Node 26.13.0, Playwright 1.65.0 / Chromium 158.0.8127.18:
  editor Node tests 19/19; full Node suite 238/238; failing browser test five
  consecutive passes (2.9 minutes); complete browser suite 9/9 (3.6 minutes).
  Static, 44-file baseline, 19-asset, release, restored site/Cloudflare validators
  and diff checks pass. No runtime bytes, timeouts, retries or visual pins changed.
- Restored the pinned migration archive locally before any site build: SHA-256
  b30048e3b7e081ae5e5da29c1cd53c88edddc038fbca89c38dd86cb1140360fa,
  341 records / three namespaces; Cloudflare accepted current remains unchanged.
- Remote CI for this correction is pending at commit time. No merge, upload or
  Cloudflare mutation; deferred soak/transitions and OBS/GPU qualification remain
  NOT TESTED. Local browser evidence does not replace those gates.

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

## P3 slice 1 — candidate namespace foundation

- P2 saved locally at `1d28784` after user-reported editor/OBS smoke acceptance;
  started `feature/qualified-release`. Nothing pushed or deployed.
- Candidate site tooling copies the unchanged accepted runtime into full-manifest
  SHA-256 namespaces; byte changes get a new identity even without a version bump.
- Versioned editor links stay inside their renderer/asset namespace. Mutable root
  aliases retain legacy scene query/hash routing. Existing namespaces are verified,
  never overwritten or deleted; local selection supports candidate rollback.
- Input/credential/rights gates run before publication into candidate output.
  Integrity verification refuses missing/extra/tampered files, noncanonical metadata,
  symlinks/nonregular output, traversal and unrelated output ownership.
- Added deterministic/retention/rollback/failure tests plus root/subpath alias and
  HTTP asset resolution tests. These are not real-browser/CEF graphics tests.
- CI configuration builds/verifies/uploads candidate sites only; no deploy/write
  permissions. A clean CI artifact has no prior history; real deployment must
  restore/retain old namespaces, verify the complete tree and qualify hosting.
- Read-only review found verifier self-consistency did not enforce the approved
  file set. Parent fixed exact PACKAGE_FILES verification, tested recomputed-ID
  crafted payload/missing-notice manifests and preserved order-independent checks.
  No delegated re-review is claimed.
- Local validation: 217 tests / 213 passed / four explicit platform skips / zero
  failures. Static, 44-file runtime baseline, 19 assets, build, redistribution,
  candidate build/verification and diff checks pass; candidate editor alias HTTP 200.
  No browser/OBS render or real deployment result is inferred.
- See P3_RELEASE.md. P3 is not passed; sustained playback/scene transitions remain
  deferred, and P4 (supported signed local/offline edition) is still separate.

## P3 slice 2 — local browser regression

- Added pinned contributor-only Playwright/pngjs/pixelmatch and a separate browser
  command/isolated loopback fixture. Runtime/public packaging remains dependency-free.
- Nine local Chrome 156.0.8078.49 tests pass: editor edits/drafts/JSON/clipboard,
  invalid inputs/fallback, mobile/keyboard basics, hosted/iframe audio isolation,
  synthetic no-auth/auth session UI and accepted-P2 scene comparisons.
- Visual state fixes Date/RNG and two RAF steps with reduced motion. Starting and
  Thanks are 1920×1080; BRB is a 480×270 software-rendered shader sample, not
  full-resolution OBS/GPU qualification. Comparison has a deliberate layout-shift
  negative control. Browser contexts never connect to actual OBS.
- Browser tests found hash-only iframe edits could keep the previous document.
  Parent added a preview-only revision query marker and actual frame-title/unit
  coverage. Copied links remain canonical; no credentials enter URLs.
- Archived P2 source hashes; active 44-file baseline records editor-only change.
  Renderer/shader/style/asset bytes are unchanged.
- CI configuration adds Chromium/Ubuntu browser tests and report artifacts; remote
  execution, hosted deployment, other engines/OS and deferred soak remain pending.
- Full browser suite passed together twice, including after clean npm ci.
  Node tests: 217 total / 213 pass / four explicit platform skips. Static/asset/
  44-file baseline/build/redistribution/site-integrity/diff checks pass.
- Read-only Crouton Alpha Free review of this browser slice reported no blockers
  (static inspection only, not an independent browser/OBS run or certification).
- See P3_BROWSER.md for exact evidence, fixture isolation and limitations.
  This work was awaiting a local checkpoint; P2 checkpoint is 1d28784.
  See the subsequent checkpoint/rollout record.

## P3 Cloudflare hosting preparation

- User selected Cloudflare Pages. No account access, project creation, publication
  or push has occurred. First preview destination/account still need confirmation.
- build:cloudflare prepares a sealed cf-dist from the cumulative site tree; verify
  enforces copied release seals, explicit non-SPA 404 and generated cache/safety
  headers. Prior prepared history cannot be dropped during replacement.
- Immutable cache rules apply only to verified existing IDs; unknown future IDs
  do not get year-long negative caching. Mutable root aliases/manifests revalidate.
  Header/file/size limits fail closed instead of pruning old namespaces.
- Added a credential-free, read-only pages.dev audit for bytes, cache/MIME,
  same-origin/namespace canonical redirects, query/fragment safety and 404 behavior.
  Tests use synthetic fetch fixtures; no real Cloudflare URL was contacted.
- CI only uploads preparation artifacts. Direct Upload is proposed for controlled
  preview publishing; project mode implications, credentials and history restoration
  requirements are explicit in P3_CLOUDFLARE.md. No auto-deploy exists.

## Cloudflare publisher readiness after pause

- Resumed after the no-blocker Cloudflare review. No configured Cloudflare token,
  account environment or standard Wrangler login file was found in this session.
- Pinned contributor-only Wrangler 4.158.0 (Node >=22); version/deploy-help work.
  No npm install-script permissions were relaxed. esbuild/workerd postinstalls
  remain blocked by the existing policy; actual static upload is still untested.
- User approved Pages project name cosmic-stream-scenes; availability has not
  been checked. Secure API-token/account-ID prompts timed out without submission.
  Account authorization is still pending. No login, project creation, upload or
  push has occurred; no credentials were received.

## First Cloudflare preview upload

- User retried secure authorization and supplied the intended account ID/token.
  Values were consumed only in the publisher command, not project files/artifacts.
- Verified source/asset/password/site/CF gates, created Direct Upload project
  cosmic-stream-scenes (production branch main), confirmed no prior deployments,
  and uploaded only branch p3-preview with pinned Wrangler 4.158.0. The static
  upload worked without relaxing blocked npm install-script permissions.
- Confirmed API deployment environment preview, branch p3-preview. URLs:
  https://a36c7c4a.cosmic-stream-scenes.pages.dev/editor
  https://p3-preview.cosmic-stream-scenes.pages.dev/editor
- Retained two namespaces. Public HTTP audit passed on both origins: 115 files
  each, two releases, byte/cache/MIME/redirect/query/404 checks. Initial TLS probes
  failed; subsequent default-TLS checks succeeded without disabling verification.
- User subsequently confirmed "3 links is all working in OBS". Record all-three
  hosted scene URL transfer/playback smoke acceptance; no exact OBS/CEF versions,
  resolution, duration or exhaustive settings coverage was provided.
- No production upload or git push requested. Rollout/rollback and deferred
  hardware/soak qualification remain pending. The user authorized a local P3
  checkpoint followed by preview-only rollout/rollback validation; nothing pushed.

## P3 checkpoint and preview rollback preparation

- Saved accepted P3 source locally as 6a4e284 after all gates, 224 Node tests
  (220 pass/four skips) and nine local Chrome tests passed again. Nothing pushed.
- Verified separate local site/cf-dist backup under ../checkpoints/p3-6a4e284/,
  retaining both published namespaces. This is not off-machine disaster recovery.
- Added explicit existing-release selection to Cloudflare preparation and a
  regression test covering rollback while retaining the newer pin. Invalid,
  duplicate, missing and verify-only selection arguments fail closed.
- Prerelease version 0.1.0-p3.1 distinguishes the nonvisual rollout candidate.
  Preview-only publish/restore validation needs fresh secure authorization;
  no subsequent upload or production promotion has happened yet.

## Live preview rollout/accepted-current restoration passed

- Initial unsupported API pagination request stopped safely before uploads; using
  the provider default fixed the preflight. Account/project/history checks passed.
- Uploaded nonvisual 0.1.0-p3.1 only to p3-preview:
  https://feb46cda.cosmic-stream-scenes.pages.dev
- Then uploaded the complete cumulative tree selecting the prior accepted current:
  https://f3c8b40d.cosmic-stream-scenes.pages.dev
- Both specific deployments and the stable alias passed live HTTP audits, 169 files
  and three namespaces each. The alias ends on the user-accepted renderer; the
  new pin and both prior pins remain available. Original a36c7c4a deployment
  separately re-audited successfully after the drill (115 files/two namespaces).
- Public proof is recorded in docs/p3-preview-rollout.json without account/token
  values. No production upload or git push. OBS refresh-after-drill, sustained
  playback and GPU/CEF qualification are not inferred from HTTP checks.
- Updated local gates: 225 Node tests / 221 pass / four skips, nine Chrome tests;
  static/source/asset/build/redistribution/CF preparation and integrity checks pass.

## User acceptance after preview rollback

- After being asked to refresh the original three OBS sources following the live
  rollout/rollback drill, the user confirmed "its working". Record user-reported
  post-rollback OBS playback smoke acceptance. Do not infer exact refresh steps,
  versions, duration, exhaustive settings or sustained-playback coverage.
- Source checkpoint 62b2ae1 and the verified local three-namespace artifact backup
  remain available. Remote CI, durable off-machine history and production promotion
  are still pending. Deferred soak/GPU/transition qualification remains open.

## Production readiness — audio authentication test synchronization

- Replaced the audio-session authentication test's fixed eight-setImmediate flush
  with a listener registered before Hello that resolves on the fake WebSocket's
  actual send. A five-second deadline fails on missing completion; listener and
  timer cleanup runs on success or timeout. No runtime behavior was changed.
- Added regression coverage with explicitly gated real Web Crypto and a missing-send
  timeout/cleanup test. No retry-on-failure mechanism was added.
- Local Linux / Node v22.22.1 validation: 100 consecutive audio-session suite runs
  passed (1,200 tests); the full Node suite passed all 227 tests with no skips.
  Static checks, all 44 runtime baseline hashes, 19 asset hashes, site/Cloudflare
  history validators and git diff --check passed.
- All three restored namespaces and the accepted-current selection remain unchanged.
  No browser-reference updates, builds, publication or pushes were performed.
  Remote CI for this change has not run. Durable restore-before-deploy integration,
  deferred OBS/soak/GPU qualification and authorized production upload remain open.

## Production readiness — cumulative history recovery/preparation

- Added dependency-free offline snapshot/verify/restore commands and isolated
  `prepare:cloudflare`: pinned history is authenticated and restored before any
  build, current selection is mandatory, and every retained namespace remains
  byte-identical. Existing differing history and reused backup/output names refuse.
- Every snapshot is catalog-sealed and freshly restore-tested, including a re-read
  of the written archive. Preparation creates a cumulative history.tar.gz plus
  nonsecret input/output pins and selection proof, without changing source outputs.
- Added strict ustar parsing, safe paths/types, size limits and symlink-ancestor
  checks. Ten regression tests cover integrity, malicious archives, conflicting
  history, cleanup, full retention and old-current/source selection.
- Recorded the original published migration backup's out-of-band pin/341 records/
  three IDs in history-bootstrap.json. DEPLOYMENT_HISTORY.md documents immutable
  off-machine retention, download-back verification and separate publishing gates.
- On magi-1 / Node v22.22.1, the original archive passed the new verifier, and an
  isolated end-to-end preparation retained all three IDs, all 341 records and the
  accepted current. Workspace site/cf-dist validators still pass unchanged.
- Full local Node suite: 237 passed, no failures/skips. Static checks, 44 runtime
  baseline hashes, 19 asset hashes and diff checks pass. No browser reference or
  runtime changes, public mutations, credential access, pruning, commits or pushes.
- This is local integration/rehearsal, not a new durable off-machine upload or
  remote CI result. Future candidate storage/download checks, deferred OBS/soak/GPU
  qualification and explicitly approved production publication remain outstanding.

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

# Production roadmap and architecture decisions

Status: P2 implementation and user-reported editor/OBS smoke acceptance complete;
P3 release/deployment work is starting. Not a production-ready release. This roadmap consolidates two review rounds by Space Bunny Free, Nemotron 3 Ultra Free, Big Pickle, Muse Spark 1.3 Contributor Free and GitHub Copilot Auto. Raw discussion is maintained outside this repository. Recommendations are adjudicated, not unanimous.

Update 2026-11-08: the asset-rights gate now passes for the replacement set;
see ASSET_AUDIT.md. Runtime visual/OBS qualification is still outstanding.
This does not complete P0 or authorize a production release.

Checkpoint: the user accepted the preview and confirmed OBS/audio interaction.
They explicitly deferred sustained playback and repeated scene-transition tests
and authorized proceeding to P1. This is an exception to the preferred sequence
below, not a passed qualification gate. See [PROGRESS.md](PROGRESS.md) for the
saved state, validation results and P1 handoff.

## Product goal

A nontechnical user opens a website, picks a Starting/BRB/Thanks template, customizes and previews it, then copies three personalized OBS Browser Source URLs. No account, terminal, source editing, Node or Python requirement. Retain the existing hand-tuned visuals and existing entry points.

## Decisions

- **Static published app, contributor-only tooling.** A build system can assist maintainers while shipping ordinary HTML/CSS/JS. Do not require end users to build. P0 checks/package tooling does not yet introduce a renderer/framework migration.
- **Incremental extraction, not a rewrite.** Shared config/loader/audio/lifecycle come first. Current isolated classic r160 and ESM r181 runtimes are a maintenance risk, not proof of failure; baseline visuals before convergence. Preserve tuned config.
- **Editor drafts are not OBS transport.** Browser and OBS CEF profiles do not share storage. P2 will generate per-scene URL fragments carrying only validated nonsecret settings. A fragment is readable by page JavaScript and stored by OBS; it is not a secret vault.
- **Versioned snapshot semantics.** Include `schemaVersion`, allowlisted keys, migrations and visible errors. Proposed bounds are 8 KiB decoded UTF-8 JSON and 12 KiB complete URL, subject to actual OBS/browser testing. Bound nesting/arrays/strings and any decompression. Oversize fallback is preset re-import or a complete static export, not silent truncation. Copied URLs do not update when a draft changes.
- **Three render pages initially.** Keep current URLs/aliases; one source does not automatically switch OBS scenes. Editor preview may use an iframe with origin/source-checked nonsecret messages. No arbitrary scripts/styles/font URLs in the MVP.
- **Secrets stay separate.** No OBS password/token in tracked runtime config, public artifacts, URLs, presets, exports or logs. Current password is blank, not a demonstrated leak. Hosted audio off by default in the future product. Session-only entry or an optional helper with OS-keychain persistence; no plaintext public-origin browser persistence as the default credential strategy.
- **Hosted default, local option separately qualified.** Publish the static editor/render views on one tested target initially. A ZIP is not a cross-platform local launcher. Later provide a no-interpreter signed launcher for offline/audio use, with stable loopback URLs, port conflict handling, preserved settings and upgrade migrations.
- **Least-privilege audio.** Prefer normalized meter data rather than exposing arbitrary OBS commands. Hosted-to-loopback behavior is browser/CEF-policy dependent. A helper needs exact Host/Origin handling, pairing/token authentication, CSRF/DNS-rebinding protection, minimal API and safe updates. Do not assume a common self-signed WSS certificate is a safe universal deployment strategy.
- **Trust before redistribution.** Verify each font/texture/vendor license and attribution. Root MIT does not automatically cover third-party assets. Preserve existing assets for baseline purposes, but block a public release while rights are unresolved.
- **Measured gates.** No invented 60% risk reduction, guaranteed FPS, exact delivery dates or assumed GPU leaks. Accessibility work focuses on the editor and reduced motion; decorative aria-hidden canvas and a non-announcing clock are reasonable choices.

## Phases and acceptance gates

### P0 — Baseline and trust (current)

- Source hashes preserving current runtime; document missing visual/OBS evidence.
- Asset-rights inventory with unresolved items clearly recorded.
- Contributor checks/tests, explicit runtime build allowlist and deterministic hashes.
- Prevent public artifact creation with a nonblank OBS password.
- CI validates preview artifacts only; no automatic public deployment.

Gate: static checks/tests pass, preview artifacts contain only intended files, runtime source bytes unchanged, release blockers explicit. This does not qualify rendering or clear asset rights.

### P1 — Shared runtime

Implementation slices 1–6 are integrated: shared boot/overlay/audio, audio lifecycle
hardening, config validation/opt-in quality caps and failure/resource recovery.
Default tuned settings and shaders are preserved; lifecycle behavior deliberately
changes. The user accepted the integrated pages after the final OBS visual/audio
recheck request; all six slices have user-reported smoke acceptance. Full P1 runtime
qualification and the deferred soak/transition checks remain outstanding. See [P1_RUNTIME.md](P1_RUNTIME.md).
This is implementation completion, **not** a passed P1 acceptance gate.

Extract boot/config/audio/text/lifecycle incrementally. Lazy-load optional BRB modules, handle failed assets/context loss, add quality presets. Preserve current look and routes.

Gate: real browser and OBS smoke tests, network-blocked offline test, repeated mounts/source transitions, recorded visual comparison and measured memory/CPU. Do not use visibilitychange as the sole source-visibility signal.

### P2 — No-code hosted MVP

All six local implementation slices are integrated on feature/no-code-editor,
based on P1 checkpoint 36d66c6: strict snapshot schema, editor, iframe preview,
drafts/presets/JSON files, per-scene URLs and setup guidance. This is a candidate,
not a passed P2 gate or a deployed hosted product. Fresh drafts default to local-only
Auto audio; hosted/embedded pages stay silent. Authenticated local OBS uses separate
session-only Interact entry; no-auth is supported. Older preset links remain Off;
legacy local URLs preserve P1 behavior. The user reported OBS testing passed,
then accepted the editor and approved moving to P3. This is user smoke acceptance,
not full per-mode, accessibility or production qualification. See [P2_EDITOR.md](P2_EDITOR.md).

Editor, presets, accessible controls, preview, autosaved drafts, validated snapshot URLs, preset/static export, guided OBS setup and diagnostics separated from clean stream views.

Gate: first-time nontechnical testers produce all three personalized OBS sources without file edits/terminal; Unicode/long titles, malformed/oversize imports, old-schema migrations, URL transfer into actual OBS and secret-exclusion tests pass.

### P3 — Qualified release/deployment

Started on feature/qualified-release from accepted local P2 checkpoint `1d28784`.
Slice 1 adds candidate content-addressed namespaces, retained local history,
verified current aliases and local selection/rollback tooling. No push/deploy,
remote CI result or runtime qualification is implied. A clean CI candidate does
not contain deployed history; retention/real hosting remain work to do.
Cloudflare Pages is selected; prepared output/headers/404 and read-only live-audit
commands are implemented. Project cosmic-stream-scenes now has a p3-preview
upload; public HTTP audits passed for 115 files and two retained namespaces on
the specific deployment and preview alias. The user confirmed all three hosted
links work in OBS (transfer/playback smoke acceptance). Detailed hosted workflow,
A preview-only nonvisual rollout and accepted-current restoration now pass live
HTTP verification, preserving three namespaces. Native OBS recheck after the drill,
durable deployment history, production deployment and full qualification remain
pending. See [P3_CLOUDFLARE.md](P3_CLOUDFLARE.md).
See [P3_RELEASE.md](P3_RELEASE.md) for slices, commands and limitations.

Unit tests for config/audio/math; browser/visual regression; immutable/versioned asset paths; tested hosting at repository subpaths; artifacts/checksums/changelog/rollback and user support guide.

Gate: tagged artifacts pass licensing and credentials gates, clean hosted deployment works, previous releases stay usable, identified GPU/OBS machines pass sustained playback tests. HTML `?v=` alone is not asset cache busting.

### P4 — Supported local audio/offline edition

Signed no-interpreter launcher, guided pairing, optional keychain storage, meter-only adapter, secure updates/migration and platform-specific installation tests.

Gate: clean machine needs no developer runtime, external-network-blocked playback works, auth/disconnect behavior is actionable, credentials absent from exports/logs, upgrades preserve settings/URLs.

## Deferred until measured demand

Accounts/cloud sync/database, public galleries, marketplaces, automatic OBS scene creation/control, GPU compute rewrites and microphone permissions. Do not solve these before the hosted MVP is useful.

## Next implementation step

P2 is saved locally as `1d28784`. Complete review/validation of the P3 candidate
namespace foundation, then add browser/visual regression, release artifact/support
procedures and verified history-preserving hosting/subpath deployment.
Keep unperformed P0/P1 production qualification visible; asset rights and static
checks do not replace it. P3 still needs real deployment and measured sustained
playback before its gate passes. P4 is the supported local/offline product phase.

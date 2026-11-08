# P2 no-code editor — local MVP candidate

Base checkpoint: `36d66c6` (P1). Branch: `feature/no-code-editor`.
All six proposed P2 implementation slices are integrated. **The user reports P2
OBS smoke testing and editor testing passed, and approved moving to P3.** Detailed
coverage, accessibility, deployment and production qualification remain pending. No production release or qualified
installer is claimed.

## Try it

Open `http://127.0.0.1:8080/editor.html` while the existing local preview server
is running. A hosted deployment can serve the same static files under a repository
subpath; no end-user build or account is needed. Hosting has not been deployed here.

1. Select Starting, BRB or Thanks; edit its text, bundled fonts, top offset and spacing.
2. Choose global quality and reduced motion. A new draft honors the system reduced
   motion preference; restored drafts preserve the saved choice.
3. Preview the actual 1920×1080 scene URL in the scaled iframe. Open it separately
   if a scene reports a problem. Browser and OBS rendering can differ.
4. Copy each of the three URLs into its own OBS Browser Source at 1920×1080.
5. Re-copy links after editing. Previously copied URLs remain independent snapshots.
6. Export a preset JSON backup; import it to restore settings in another browser.

Reset restores only the selected scene. Applying Original/Minimal/Quiet replaces
all three scenes after confirmation. Clear saved draft removes only the editor's
stored copy, without changing previously copied URLs. Pending autosave is cancelled.

## Slice 1 — versioned nonsecret schema

runtime/snapshots.js owns the strict protocol:
- schemaVersion: 1.
- quality: tuned/low/medium/high; reducedMotion: boolean.
- audioMode: off/auto/setup (nonsecret intent only). Fresh editor drafts choose auto;
  schema defaults and older schema-1 snapshots without this field remain off.
- scenes: starting/brb/thanks, each with title, subtitle, titleFont, subtitleFont,
  topVh, titleSpacing and subtitleSpacing.
- Titles: at most 120 Unicode code points; subtitles: 240.
- Fonts: cinzel/macondo/system only. No custom CSS, script, font or asset URLs.
- Top offset: finite 0–40 vh. Spacing: finite 0–0.4 em.
- Unknown fields, credential-shaped additions, prototype keys, invalid types/enums
  and unsupported versions are rejected rather than silently copied.

Canonicalization creates fresh allowlisted objects. Validation traverses only
the fixed schema, so arrays/deeper objects cannot expand the expected structure.
Literal HTML-like text remains text, not markup. Scene titles still use their
existing uppercase heading style.

Documented prototype migration: schemaVersion 0 accepts only title/subtitle and
optional quality; it migrates those text fields into Starting and fills all other
fields from current defaults. Unknown prototype keys still fail.

## Slices 2–3 — accessible editor and live preview

editor.html/editor.css provide labelled controls, fieldsets, keyboard focus styles,
status/error regions, responsive layout and guided setup. editor.js handles the
controller. It does not load config.js or accept an arbitrary iframe URL.

Changes are validated and debounced before generating URLs/reloading the fixed
scene iframe. No postMessage transport is used. Preview uses the same snapshot URL
as OBS, not browser storage shared with OBS. Invalid controls disable stale link
copy/export; invalid imports leave the previous valid state unchanged. Async file
imports cannot overwrite newer user edits.

The preview is pointer-inert; its separate Open preview link permits inspection.
Automated DOM tests do not establish real keyboard, screen-reader or visual results.

## Slice 4 — drafts, presets and JSON files

runtime/drafts.js stores canonical JSON under obs3dplanet.editor.draft.v1 through
the snapshot parser/serializer. Storage denial, corruption, size overflow and
quota failures produce fixed codes mapped to actionable UI messages. Other
storage keys are never cleared. Corrupt saved data is not automatically erased.

Only the snapshot schema is saved/exported. No OBS password/token, raw config,
font URLs or arbitrary extra fields are accepted. Users must still keep secrets
out of overlay text: titles/subtitles are intentionally visible and shareable.

JSON import is bounded before file reading, then again by decoded UTF-8 size and
schema validation. Export is a preset JSON file, not a complete static ZIP or an
end-user launcher. Blob URLs and pending UI work are disposed.

## Slice 5 — personalized OBS URL snapshots

The transport is an uncompressed UTF-8 JSON/base64url fragment:
`#preset=<canonical-base64url>`. Decode rejects malformed/noncanonical base64,
invalid UTF-8, ambiguous preset fragments and unsupported/oversize data.

Limits: 8 KiB decoded UTF-8 JSON; 12 KiB complete URL. No silent truncation or
decompression. If a site path makes a URL too long, export/re-import the preset
from a shorter site URL. These limits still require actual OBS/CEF qualification.

Generated URLs use fixed relative scene pages under the editor's HTTP/HTTPS site,
strip unrelated base query/hash data and request local bundled assets. Each link
contains the complete three-scene settings snapshot. The fragment is readable by
page JavaScript and stored by OBS; it is not a secret vault or a rendering-version
pin. P3 immutable/versioned asset paths remain future work.

runtime/boot.js validates the fragment before any rendering/audio initialization,
then maps only safe settings onto the trusted scene tuning. Malformed preset links
fail visibly, not by falling back to legacy config.

## Audio and reduced-motion boundaries

Fresh editor drafts use **Auto — local only**. This is an origin policy, not
physical-PC/process detection: only HTTP(S) pages served from localhost,
127.0.0.1 or [::1] can start session audio. Public-hosted copies and embedded
iframe previews neither connect nor collect credentials, even with an Auto/setup
preset. Off is always available. Older saved presets without audioMode remain Off;
choose Auto explicitly and re-copy their URLs.

Auto attempts ws://127.0.0.1:4455 using only InputVolumeMeters subscriptions.
If OBS authentication is disabled, it connects without a password. If OBS sends
an authentication challenge, it sends no empty-password authentication and opens
the session setup panel. Authentication is recommended, not mandatory.
Manual local setup shows the panel immediately and supports another loopback
port/input names. Remote endpoints, URL userinfo/query/fragment and non-root paths
are rejected.

In each OBS Browser Source, use **Interact** to enter the password separately if
needed, or change the port/input names. Passwords stay only in that page's memory
for the active connection/reconnects: no storage, preset/URL/export, postMessage or
logging transport. The input is cleared immediately on submit/close; disabling,
stopping or reloading clears the active session connection. Re-enter after refresh.
The render adapter still blanks trusted base passwords and starts disabled until
the session binding explicitly enables a connection. Legacy no-preset URLs retain
their original config.js audio path; no real password belongs in tracked config.

Configure before going live: an initial authentication/manual setup panel is
visible until connected or closed. Successful identification hides it without a
permanent control on the stream. Ctrl+Alt+A (Command+Option+A on macOS), inside
Interact, reopens setup; refresh also resets setup. Initial failures/timeouts do
not force diagnostics onto the stream; reopen setup to inspect/retry.
A 10-second initial timeout stops endless failed attempts. Once connected,
the existing bounded-backoff reconnect behavior remains. Session scope disposal
removes the form/hotkey/timer and closes the socket.

Only use a trusted local copy to enter credentials. This is not an OS-keychain
helper or signed local launcher, and does not qualify browser/CEF policy or OBS
Interact usability. The user subsequently reported OBS smoke testing passed;
separate authenticated/unauthenticated-path coverage was not specified.

The editor itself does not load config.js; the preview scene still loads the
trusted project config for renderer tuning, then applies the validated snapshot.
Never put a real password into tracked/shared config.js.

Reduced motion freezes scene time/deltas and disables decorative CSS animation.
Rendering continues so asynchronously loaded textures can appear, and the clock
can update. It is not a GPU-power/FPS guarantee. Legacy URLs retain normal motion.

## Slice 6 — guidance and diagnostics

Setup instructions explain the three Browser Sources, sizing, snapshot semantics,
storage separation, local-only audio/session credentials and attribution. Clipboard failure selects
the readonly URL for manual copying. Safe errors are shown for invalid fields/
imports, unavailable storage, unsupported origins/URL length and renderer failures.

No public deployment, persistent credential workflow, complete static export or
automatic OBS scene creation is included.

## Validation obtained

Windows / Node v24.22.2:
- check, baseline:verify (44 runtime files), assets:check (19 third-party assets).
- 207 Node tests: 203 passed, zero failures, four platform-related skips.
- build (52 allowlisted inputs plus manifest), release:check and diff checks pass.
- Tests include fake DOM, real script-wrapper simulation, fake storage/clipboard/
  file APIs, malformed/Unicode/oversize data, migration, snapshot boot isolation,
  unchanged legacy audio, reduced-motion clock behavior and existing P1 regressions.
- Skips: three Windows file-symlink privilege cases and one GNU tar archive test.

Crouton Alpha Free contributed the editor shell; Beam Free contributed validated
draft storage/tests. The parent implemented the protocol, controller and integration.
Only non-Flash OpenCode free models were used; the capped Flint model was not retried.

## Read-only review and follow-up

Crouton Alpha Free reviewed the parent-authored snapshot/controller/boot boundary
and Beam-authored storage adapter, reporting no blocking findings. It reproduced
the then-current full suite. The reviewer previously authored the HTML/CSS shell,
so this is not claimed as a wholly independent review of every P2 file or a
security certification.

Two non-blocking preview UI observations were addressed by the parent: invalid
controls now explicitly label the last valid preview, and iframe readiness is
checked against expected URL, preset, scene and generation. A regression test
covers stale load/promise results. The updated full suite has 193 tests / 189 pass /
four skips at that point. A subsequent read-only review of the new local-only
session audio code by Crouton Alpha Free also reported no blockers (synthetic
checks only). Parent then added dedicated real-controller/fake-WebSocket regression
tests; the current suite has 207 tests / 203 pass / four skips. No browser/OBS
qualification or security certification is inferred.

## User-reported OBS smoke acceptance

After the local session audio handoff, the user confirmed "OBS testing is ok".
Record this as P2 OBS smoke acceptance, not assistant-observed testing or a full
qualification result. Exact scenes, auth/no-auth modes, Interact steps, versions,
URL lengths and duration were not separately reported.

The user subsequently confirmed "tested the editor ok for me" and approved P3.
Record user-reported editor acceptance, without inferring individual feature,
browser, accessibility or first-time-tester coverage.

## Acceptance still required

Detailed coverage of controls, previews, copy fallback, export/import and reload;
first-time nontechnical workflow; detailed coverage of all three personalized
URLs, both authentication modes, Unicode/long text, URL-size support, reduced-motion behavior and keyboard/
screen-reader checks. P1's deferred soak/lifecycle qualification also remains open.

The P1 manifest is preserved as source-baseline-p1-complete.json. The active
manifest records P2 deliberately; it is source-byte evidence, not visual parity.
The user authorized a local P2 checkpoint and proceeding to P3. Nothing is pushed.

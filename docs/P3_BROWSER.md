# P3 slice 2 — browser regression candidate

## What ran locally

Nine Playwright tests passed together twice on Windows / Node 24.22.2 / installed
Chrome 156.0.8078.49 (the final run followed a clean npm ci). The runner requests ANGLE SwiftShader software rendering, DPR 1,
en-US/UTC and one worker. This is real browser automation, not OBS/CEF or GPU
production qualification. No real OBS server was contacted.

Coverage:
- Actual versioned editor redirects, three-scene edits, live preview text, draft
  reload, JSON download/import, unsafe-import rejection and pinned clipboard URL.
- Invalid controls disable stale copying; unavailable clipboard provides selection.
- Mobile 390×844 has no horizontal overflow, uniform Copy link buttons and a
  working keyboard skip link/labelled title control. Not a full accessibility audit.
- A simulated public HTTP hostname and local embedded preview neither attempt
  a WebSocket connection nor show password fields, including manual setup intent.
- Real DOM local Auto no-auth handshake and auth challenge/real Web Crypto flow
  against an in-page synthetic OBS socket. Password field clearing, absent storage/
  URL plaintext, disable and renewed prompt after refresh are asserted.
- Starting/BRB/Thanks frames compared against the **committed accepted P2**
  implementation, not auto-approved screenshot goldens.

## Run (contributors only)

```sh
npm ci
npx playwright install chromium
npm run test:browser
```

An already installed supported browser can be selected explicitly. For the local
Windows run:

```powershell
$env:OBS3DSP_BROWSER_CHANNEL = 'chrome'
npm run test:browser
```

OBS3DSP_BROWSER_PORT optionally selects a dedicated 1000–65535 port (default
4173). The runner refuses to reuse an existing server. It does not modify or use
the user's normal browser profile or existing port-8080 preview server.

Playwright, pngjs and pixelmatch are pinned **devDependencies** with a lockfile;
none is shipped to the static app or required by hosted users. Static/Node tests
remain a separate `npm test` command. Browser installation is explicit, not an
end-user requirement.

## Reference provenance and rendering scope

tests/browser/reference.json pins P2 commit
1d28784928846cf58d75230c26fec09807ea5c0b. The fixture extracts its allowlisted
runtime/notices using git show, verifies committed runtime hashes and builds the
current gated candidate. Keep the accepted commit reachable when publishing;
shallow/squashed history without that object must fail rather than silently
approve the current implementation. CI requests full reachable history.

Each comparison renders reference and candidate **sequentially in one foreground
tab in the same browser**, with identical nonsecret snapshot settings. Date is
fixed, randomness seeded, reduced motion on and exactly two queued RAF steps
executed after app/font/request readiness. Fixed frame count matters because the
waterfall mesh history advances per frame even with reduced-motion delta zero.
These controls exist only in the test context, not the production renderer.

Starting and Thanks use 1920×1080; the costly ray-marched BRB shader is sampled
at **480×270** on software WebGL. Quality remains tuned. Full-resolution BRB GPU/
CEF playback is not established by that sample. Uncontrolled full-HD software
BRB runs were stopped after test timeouts; this is not a measured production
performance result and no performance claim is made.

PNG pixels are compared with pixelmatch threshold 0.1 and **zero differing pixels**
allowed (normal antialias classification still applies). A deliberate 40px overlay
movement is the negative control: it must produce a visible-sized pixel difference.
Reference/candidate/difference images and environment metadata are attached, and
failure traces/screenshots retained. No automatic baseline update is used.
Screenshot equivalence does not certify animation timing, audio reactivity or all
possible settings. Dynamic performance and hardware behavior need separate tests.

## Browser-found preview fix

Real browser tests caught that assigning only a different #preset fragment to an
iframe can perform same-document navigation without rerunning scene bootstrap.
The editor now gives each iframe revision a short nonsecret preview query marker.
Copied OBS URLs and the separate Open preview link stay canonical; no credentials
or settings channel was added. Both unit tests and the actual frame-title check
cover this behavior. Stale readiness/generation guards remain in place.

P2 source hashes are retained in docs/source-baseline-p2-complete.json. The active
44-file manifest deliberately records this editor-only adapter change. Scene
renderer/shader/style/asset bytes remain accepted P2 bytes.

## Review and other validation

A read-only Crouton Alpha Free review of the preview fix, browser fixtures,
reference provenance, comparison controls and CI wiring reported no blockers.
It performed static inspection, not a separate browser/OBS run or security
certification. All static/asset/baseline/build/redistribution/site-integrity checks
pass; Node tests remain 217 total / 213 pass / four explicit platform skips.

## Isolation, CI and limitations

The test server binds loopback, checks exact test Host headers, serves only the
candidate/reference roots, refuses traversal/escaping symlinks and sends explicit
HTML/JS/CSS/font/image MIME types plus no-store/nosniff headers. It is a disposable
fixture, **not** the signed P4 local server/launcher or a production hosting target.

Every page/frame replaces WebSocket before app code, records attempts and either
blocks them or handles a synthetic protocol. Browser request routing restricts
HTTP access to the two test hostnames on the fixture port. Test passwords are
fixed synthetic strings; never enter real credentials or point these tests at OBS.
Traces are development artifacts, excluded from public runtime/site allowlists.

CI configuration adds Chromium/Ubuntu automation and report upload, with read-only
permissions and no deployment. It has not run remotely for these unpushed changes.
Local Chrome success is not evidence that the bundled CI Chromium or another OS
passed. Firefox/WebKit, full screen-reader review, native OBS Interact, actual
hosted TLS/cache/retention/rollback and deferred soak/scene transitions remain
unqualified. P3 is still in progress.

References:
- https://playwright.dev/docs/test-webserver
- https://playwright.dev/docs/test-snapshots
- https://playwright.dev/docs/clock

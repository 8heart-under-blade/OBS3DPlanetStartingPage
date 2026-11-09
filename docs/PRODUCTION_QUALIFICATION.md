# Production preparation — JMB-HP, 2026-11-09

Status: **production uploaded with explicit user approval**, after durable backup
upload/download/restore verification. The user subsequently confirmed fresh-link
production OBS visuals and audio work as expected; individual scenes retested
were not separately enumerated.
No broad platform, frame-rate or audio-mode certification.
This record supersedes the historical NOT TESTED status for the specific soak and
transition exercises below; older checkpoint records remain historical evidence.

## User-observed playback/recording and transitions

The user reports more than 60 minutes of playback while recording, all three
scenes (Starting, BRB, Thanks), and more than 20 transitions/tests per scene during
that session. No blank frames or audio loss were observed. This is user-reported
smoke acceptance, not assistant-reviewed recording/frame-by-frame analysis.
Exact time spent in each scene and transition settings were not recorded.

Screenshots supplied by the user establish:

- HP EliteBook 850 G8, Intel Core i7-1165G7 (8 logical CPUs), Intel Iris Xe
  Tiger Lake-LP GT2; 15.30 GiB RAM shown by the system summary.
- Omarchy 4.5.0-3, Linux 7.2.15-1-omarchy, Hyprland 0.56.2 / Wayland.
- OBS Studio 32.2.2, 64-bit.
- Canvas 1920x1080; scaled output 1280x720, 30 FPS, Bicubic (16 samples).
  Browser-source dimensions were not separately shown.
- Active kernel graphics driver i915; mesa and vulkan-intel 1:26.2.5-1,
  intel-media-driver 26.3.5-1, linux-firmware 20260916-1.

CEF version, actual OBS graphics renderer/encoder, rendering/encoding-lag counters,
audio mode/authentication coverage and GPU telemetry were **not recorded**.
Do not infer 1080p output, 60 FPS, zero dropped frames, zero leaks, every audio
mode, or support for other machines/OSes from this run.

## Resource recording analysis

User-supplied performance.atop SHA-256:
`d1a0dc6a66e655e83edb427a4424e5b32270e9c66d771e86d32b11843e59129d`.
Raw evidence and derived reports are retained locally outside Git in the
cosmic-stream-scenes backup directory, qualification-20261109. Raw atop data can
contain unrelated process details and must not be included in public app/backup
release assets. It is not a supplied OBS video/log.

Analysis with atop 2.13.0:

- 2026-11-09 10:26:43–11:28:58 UTC: 62 minutes 15 seconds.
- 747 regular five-second intervals after excluding the initial since-boot sample.
- Same OBS PID and nine browser helper PIDs observed throughout; no observed exits
  or restarts. Presence does not prove continuous rendered frames/audio.
- OBS/helper aggregate CPU: median 1.706 logical cores, peak 4.332 of 8.
- Summed OBS/helper RSS first/last five-minute medians: 1937.9 / 2030.7 MiB
  (+92.8 MiB, approximately 4.8%). Shared pages can be double-counted; this is not
  unique physical memory or proof of a leak/no leak.
- Available system RAM minimum 6.51 GiB, no swap use, full memory-pressure
  ten-second averages zero in the sampled data.
- Intermittent system-wide I/O pressure: full I/O PSI ten-second average peaks
  at 32.6%; attribution/root cause not established. Recording occurred concurrently.
- No GPU samples; no OBS rendering/encoding-lag counters in this evidence.

Conclusion: encouraging process/resource continuity plus user-observed smoke pass
on this setup, with modest memory growth and I/O stalls explicitly retained as
limitations. Not an exhaustive production performance certification.

## Source, renderer selection and local candidate

Merged main: `031241a8a296024b3060404c9aef724eb794cc64`.
Main CI passed Linux, Windows and browser regression:
https://github.com/8heart-under-blade/OBS3DPlanetStartingPage/actions/runs/42550325111
Local merged-main checks, 238 Node tests, 44 runtime hashes, 19 asset hashes,
release and restored-history validators also passed.

The candidate explicitly preserves the already tested stable-preview renderer:
`v0.1.0-6613f9a2f7269ed867f21986aa2dc412dadc3c55803c27286292f4a7fcf97fc1`.
It does not silently promote the newer p3.1 renderer. Accepted P2 commit
`1d28784928846cf58d75230c26fec09807ea5c0b` remains reachable.

Local preparation: `production-prepared-20261109T114506Z`, outside the checkout.
Input is the pinned durable bootstrap archive described in history-bootstrap.json.
Restore-before-build preparation and an additional fresh local restore both pass:
341 records, all three existing namespaces retained, accepted current unchanged.
New history.tar.gz SHA-256:
`f4002b053d27f26b9876656fe6da41bf6b080f17b63c076b5f02054a5e54c72e`.
Old backups remain untouched. Initially local-only, this exact archive is now
published and download/restore-verified as recorded below. Its selected site current
is intentionally consistent with the selected Cloudflare current.

A fresh read-only live audit compared this prepared cf-dist against
https://p3-preview.cosmic-stream-scenes.pages.dev/ and passed all 169 files / three
namespaces, cache/MIME/canonical query redirects and missing-path 404 checks.
This binds the local upload bytes to the current public preview, not to a new
production deployment. No account access or public changes were needed.

## Authorized production upload and results

The user explicitly approved the public backup, production upload and HTTP audit.
The backup prerelease is recovery storage, not latest/production software:
https://github.com/8heart-under-blade/OBS3DPlanetStartingPage/releases/tag/site-history-20261109T114506Z

The stored archive was downloaded to a new path, authenticated against the
independently recorded f4002b05...e54c72e pin, and restored into a fresh root.
Both site/ and cf-dist/ compare byte-identical to the prepared trees; 341 records,
all three IDs and selected current match. Only archive and nonsecret recovery
metadata were uploaded; raw atop/screenshots and credentials were excluded.

Cloudflare confirmed the expected Direct Upload project, production branch main.
Two credential attempts were rejected before upload; a replacement scoped token
and explicit account ID enabled destination verification and publishing. Credentials
were read only by publisher commands, not committed or included in artifacts.

Production deployment: https://20ef03a5.cosmic-stream-scenes.pages.dev/
Production editor: https://cosmic-stream-scenes.pages.dev/editor
Cloudflare reports environment production and successful deployment at
2026-11-09T12:09:48.288826Z. The complete upload was made from the independently
downloaded/restored cf-dist, explicitly retaining the tested current and all IDs.

Both specific deployment and production alias completed full successful audits:
169 files / three namespaces, byte hashes, cache/MIME/safety headers, canonical
query redirects and missing-asset/release 404 behavior. Other audit attempts hit
intermittent 15-second request/body timeouts; one identified texture received HTTP
200 then timed out reading. Independent curl fetched that asset in 1.26 seconds
with the expected hash. No integrity/header mismatch was observed; root cause of
the intermittent timeouts is unconfirmed. Do not describe every audit attempt as
successful or infer universal availability/performance from the passing runs.

Latest deployed recovery state and exact full pin: [deployed-history.json](deployed-history.json).
Use that record for the next cumulative preparation; retain history-bootstrap.json
and the original backup as historical recovery inputs, never prune them.

**Production OBS feedback:** after the request to generate fresh links from the
production editor, the user reported: "Test fresh link in OBS, visual and audio is
working as expected". Record a user-reported fresh-link production OBS smoke pass.
The user did not separately enumerate which scenes were retested or the duration;
do not infer all-three production retest coverage or all audio/authentication modes.
The earlier all-three soak/transition evidence remains separately scoped.

## Publishing checklist (backup, upload, HTTP and user fresh-link OBS smoke completed)

1. Confirm permission to create a uniquely named GitHub backup prerelease (not
   latest/production); upload only the cumulative history archive and nonsecret
   recovery metadata, never raw atop/screenshots or publisher/OBS credentials.
2. Download that uploaded archive to a new path and verify the independent pin,
   restore to a fresh root and compare selected current, all IDs and record count.
3. Confirm the intended Cloudflare account/project and authorize production upload
   of this complete cf-dist to cosmic-stream-scenes, production branch main.
   Use secure credential delivery only if needed; never chat/file credentials.
4. After uploading, audit both the specific deployment and production alias,
   including all retained links. Ask the user to check the production editor and
   all three OBS URLs. Record URLs, backup pin and results without secrets.

Do not merge/deploy automatically from this record, prune backups/history, replace
cumulative output with a clean single-release CI artifact, or mark production URL
checks passed before a deployment exists.

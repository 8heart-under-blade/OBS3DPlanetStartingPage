# P3 Cloudflare Pages — preview history and first production upload

## Current production status — 2026-11-09

The first production upload was explicitly approved and completed after a new
GitHub backup prerelease was uploaded, downloaded and restore-verified. Production
editor: https://cosmic-stream-scenes.pages.dev/editor . The tested current and all
three namespaces are retained. Both production origins passed full HTTP audits;
intermittent timeout attempts remain documented. The user subsequently confirmed
expected visuals/audio for a fresh production link in OBS; scene-by-scene retest
coverage was not separately enumerated. See [PRODUCTION_QUALIFICATION.md](PRODUCTION_QUALIFICATION.md) and
[deployed-history.json](deployed-history.json). Earlier preview-only/no-approval
statements below describe their historical checkpoints, not current public state.
Setup-specific user soak/transition smoke acceptance is not universal qualification.

The user selected **Cloudflare Pages** and approved project name
**cosmic-stream-scenes**. The intended account was authorized through secure inputs;
a new Direct Upload project was created with production branch main and an initial
p3-preview deployment uploaded. No production upload or git push was requested.
This is a static app: no Functions, Worker, database, R2 bucket or paid backend is
required by this preparation.

## First preview and live HTTP evidence

- Preview alias: https://p3-preview.cosmic-stream-scenes.pages.dev/editor
- Specific deployment: https://a36c7c4a.cosmic-stream-scenes.pages.dev/editor
- Two sealed renderer namespaces are present, including the accepted P2 namespace.
- Public read-only audits passed on both origins: 115 files checked per origin,
  two retained releases; bytes, cache/MIME safety headers, canonical query redirects
  and missing-release/file 404 behavior passed.
- Initial probes failed with a TLS handshake alert; subsequent default-TLS Node
  audits succeeded. Certificate verification was never disabled; no root cause is
  claimed from this observation alone.
- User subsequently confirmed "3 links is all working in OBS". Record hosted
  Starting/BRB/Thanks link-transfer and OBS playback smoke acceptance, not measured
  soak, exhaustive settings/accessibility or hardware qualification. Exact OBS/CEF
  versions, resolution and duration were not separately reported.
- Long-term cache/rollback, GPU matrix and deferred soak/transition qualification
  remain open. This is a testing preview, not the final production hostname.

Publisher secrets were read only inside the authorized publisher command and were
not written into project files, URLs or artifacts. Secure one-use delivery does
not revoke the Cloudflare token itself; revoke it in Cloudflare when no longer
needed. Future publishing still requires authorization and retained history.

## Commands and folder

For a future upload candidate, use the cumulative **restore-before-build** procedure
in [DEPLOYMENT_HISTORY.md](DEPLOYMENT_HISTORY.md), not a fresh single-release CI
artifact. `npm run prepare:cloudflare` authenticates a pinned backup, restores it
in isolation, builds with explicit current selection, checks retention and creates
and restore-checks a new snapshot. Off-machine retention/download verification and
publishing approval remain separate gates; the command never uploads anything.
The commands below are lower-level local tools, not a complete deployment workflow.

```sh
npm run build:cloudflare
npm run cloudflare:verify
# Prepare a retained older release as current without deleting newer namespaces:
npm run build:cloudflare -- --release <existing-release-id>
# Only after a preview actually exists:
npm run cloudflare:check-live -- --url https://<preview>.<project>.pages.dev/
```

Serve/upload **cf-dist/**, not the repository or bare dist/. Preparation first runs
all existing gated site builds, retains namespaces and adds only:
- _headers: explicit caching and nosniff/no-referrer response policy.
- 404.html: prevents the default Pages SPA fallback from replacing a missing pinned
  renderer with the current root page.
- cloudflare-manifest.json: complete prepared-file hashes, current/retained IDs and
  preview-only status. It is public metadata, not a credential/config vault.

There are no _worker.js or functions/ files in the approved output. All approved
runtime/license bytes and root compatibility aliases remain byte-identical copies.
Output inspection is exact; tampering, unowned root entries, symlinks and missing
history are refused. A previously prepared cf-dist cannot be replaced by a new
build that drops any of its namespaces. Source site/ history must be restored first.

Both site/ and cf-dist/ are ignored by git and intentionally retained by npm clean.
Back up the trusted cumulative tree before publishing. Preparation stages and
verifies a replacement folder; failed installation restores the prior prepared
folder where possible. A filesystem failure during restoration preserves its
.cf-stage-* backup for operator recovery rather than deleting it.

## Caching and clean URLs

Only **already verified full namespace IDs** receive one-year immutable browser
caching. Do not replace this with a blanket /releases/* rule: a probe for a future,
not-yet-published ID could otherwise acquire a year-long negative browser cache.
A missing file under an existing sealed namespace cannot later be added under that
same ID; fix it through a new namespace.

Mutable root HTML aliases (both .html and clean names) and current/deployment
manifests use no-cache. The global rule adds safety headers only, so overlapping
Cloudflare rules cannot concatenate contradictory Cache-Control values.

The adapter checks current documented Pages limits: 100 _headers rules,
2,000 characters per header line, 20,000 files and 25 MiB per file. Per-namespace
rules can hit the header-rule limit before the file limit; it fails closed rather
than pruning history. Plan a separately tested cache/history policy before that
limit. Dashboard drag/drop has a lower 1,000-file limit; Wrangler uploads support
the documented 20,000-file limit.

Pages canonicalizes /editor.html to /editor and /index.html to its containing
directory. Relative release paths still resolve inside the same namespace.
Do not add an SPA redirect/fallback. Actual Pages canonical redirects, query/hash
transfer, MIME, TLS, headers and old-release usability must be checked on the
approved real preview, not inferred from local simulation.

## Recommended first preview: Direct Upload

Use a **Direct Upload** Pages project for controlled prebuilt uploads, with its
production branch set intentionally (for example main). Do not configure a
clean-checkout native Git build to deploy a single new namespace automatically.

Important platform choice: a Direct Upload project cannot later switch to native
Git integration without creating another project. CI can still publish prebuilt
Direct Upload artifacts with Wrangler. This proposal is not a project-creation
action or authorization to publish.

1. Confirm the Cloudflare account and a unique project name.
2. Create the Direct Upload project in Workers & Pages (or with authenticated
   Wrangler). Do not enter any OBS password or other application secret.
3. Restore trusted prior cumulative history, build/verify cf-dist/, and use a
   preview branch first. For an authenticated publisher with Wrangler:
   `wrangler pages deploy cf-dist --project-name <project> --branch p3-preview`.
   Wrangler 4.158.0 is now pinned as a contributor-only devDependency (Node >=22).
   Its local version and pages deploy help were checked; no login or deployment
   was performed. Use the pinned local CLI, not a newly downloaded unpinned one.
   npm blocked esbuild/workerd postinstall scripts under the existing allowScripts
   policy; no script permissions were changed. The authorized initial static
   preview upload subsequently succeeded without relaxing that policy.
   Dashboard folder upload is also possible for this small first candidate within
   its lower file limit.
4. Run cloudflare:check-live against the actual preview pages.dev URL and exercise
   editor, all three copied scene URLs and canonical redirects in browser/OBS.
5. Only approve a production deployment after the remaining P3 qualification and
   rollback/history checks; previously deferred soak tests remain NOT TESTED.

Publisher authentication is separate from OBS audio. If assistant/CI upload is
chosen, authorize through a secure secret prompt or GitHub Actions secrets, never
chat, source files, command-line literals, presets or public artifacts. Cloudflare
documents a token scoped to the intended account with Account / Cloudflare Pages /
Edit. Account ID and project destination must be confirmed separately.
No secret/account values are needed by build or public read-only audit commands.

## Preview rollout/rollback drill preparation

Accepted P3 source is saved locally at 6a4e284. A verified backup of both site/
and cf-dist/ (two namespaces) is stored outside the repository under
../checkpoints/p3-6a4e284/. It is a local backup, not an off-machine history store.

The drill uses version 0.1.0-p3.1 to create a distinct content-addressed candidate
without changing scene code/visuals. build:cloudflare --release selects only an
already verified retained namespace, after building/retaining the source candidate.
Invalid/missing selections fail before source aliases are changed. The prepared
folder may point to an older current renderer while retaining every newer pin.

This is NOT Cloudflare's platform rollback-to-an-old-deployment operation: it is
a fresh preview upload of the full cumulative tree with the accepted renderer
selected as current. That distinction preserves links issued during the rollout.
The actual preview results are recorded below; no production approval or deferred
soak result is implied. A plain build:cloudflare selects the current source version
again; use --release explicitly when preparing an accepted-current restoration.

### Live preview drill results

The drill completed on p3-preview only:
- Rollout deployment: https://feb46cda.cosmic-stream-scenes.pages.dev
- Accepted-current restoration: https://f3c8b40d.cosmic-stream-scenes.pages.dev
- Each specific deployment and the stable preview alias passed public audits:
  169 files, three retained renderer namespaces, correct current selection,
  checksums/cache/MIME/canonical query redirects and missing-path 404 behavior.
- The stable alias finishes on the previously user-accepted renderer. The newer
  0.1.0-p3.1 pin remains available, as do both older pins.
- Original a36c7c4a deployment was re-audited after the drill: all its 115 expected
  files and two namespaces still pass. This is HTTP integrity/availability proof,
  not a native OBS refresh or sustained-playback result.
- Source/static/asset/build/retention gates pass, with 225 Node tests (221 pass,
  four platform skips) and nine local Chrome tests after the selection change.
- A first preflight rejected an unsupported API pagination setting before uploads;
  using Cloudflare's default pagination succeeded. No credentials were logged.

Machine-readable nonsecret evidence: docs/p3-preview-rollout.json. After the
request to refresh the original three OBS sources, the user confirmed "its working".
Record user-reported post-rollback OBS playback smoke acceptance, without inferring
exact refresh steps, versions, duration or sustained-playback coverage. No production
upload, remote CI run, git push or full production qualification is implied.

## History must survive clean deploys

Cloudflare replaces a deployment's entire file set. A clean CI candidate does not
magically include old deployed namespaces. Restore the trusted full site/ history
before building; preserve all approved namespace IDs on the SAME production
hostname. A Cloudflare platform rollback of one deployment is not, by itself, a
guarantee that every previously issued newer pinned URL remains available.

There is deliberately no automatic deployment workflow yet. CI only prepares and
uploads a candidate artifact with read-only repository permissions; no token is
read and no external project is changed. Storage/retention and a reviewed publish
workflow must be decided before ongoing automatic deployments.

## Read-only live audit and limitations

The audit requires a locally verified cf-dist and a root HTTPS pages.dev URL.
It requests expected public files without account credentials, bounds response
sizes/timeouts/redirects and refuses off-origin/cross-namespace redirects, changed
queries or fragment overrides. It checks prepared file bytes, cache/MIME safety
headers, current/retained namespaces, canonical entrypoint query transfer, and
404 responses for a missing release/file. It never evaluates page JavaScript.

Cloudflare consumes _headers; 404.html and .nojekyll are host control files, so
those are not presented as fetchable runtime assets in the audit. Their local
contents are sealed, and live behavior is probed. It is not a signed provenance,
browser-render or OBS/GPU/soak certification. Synthetic fetch regression tests remain in place, and the first real preview
passed the public HTTP audits recorded above. These checks do not execute the
editor or transfer a fragment through a native browser/OBS session.

New hosted snapshot links remain audio-silent under existing local-only policy.
Legacy no-preset routes retain their original compatibility behavior. Public links
contain only validated nonsecret settings, never OBS or publisher credentials.

## Official platform references checked for this slice

- https://developers.cloudflare.com/pages/configuration/headers/
- https://developers.cloudflare.com/pages/configuration/serving-pages/
- https://developers.cloudflare.com/pages/get-started/direct-upload/
- https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/

Cloudflare-specific local tests cover deterministic output/retention, header rule
overlap and limits, unknown-ID negative caching, credential/tamper failures, missing
history, canonical redirects, MIME/content/cache checks and SPA fallback rejection.
Mock HTTP tests are not a deployed Cloudflare result.

# P3 release/deployment — implementation in progress

P2 checkpoint: `1d28784`, saved locally after user-reported editor and OBS smoke
acceptance. P3 branch: `feature/qualified-release`. Nothing pushed or deployed.

P3 is **not the final phase**: P4 is the supported local/offline edition (signed
no-interpreter launcher, guided pairing, optional keychain, secure updates and
installation/upgrade tests). P2 session audio is not a substitute for that product.

## Proposed implementation slices

1. **Candidate namespaces and retention tooling** — implemented below; review and
   local checks do not constitute release qualification.
2. **Browser/visual regression** — nine local Chrome tests now pass, including
   editor journeys, public-origin isolation and same-browser accepted-P2 comparisons.
   BRB is a smaller software-rendered sample; real OBS/GPU/multi-platform coverage
   is still pending. See [P3_BROWSER.md](P3_BROWSER.md).
3. Tested hosting/subpath deployment, retained history, caching and clean-URL
   transfer into OBS. Hosting target and publication require an explicit decision;
   no automatic deployment or push is enabled here.
4. Approved artifact/checksum provenance, changelog and support/rollback procedures.
   Existing GNU-tar preview packaging remains separate from the candidate site.
5. Recorded hardware/OBS matrix and sustained-playback/scene-transition results.
   Previously deferred checks remain **NOT TESTED**, not waived or passed.
6. Tagged release/deployment acceptance with a verified prior-version rollback.

No P3 gate is passed yet. Local browser coverage is scoped in P3_BROWSER.md;
HTTP simulations and Chrome screenshots are not a native OBS/CEF or production
hosting result.

## Slice 1 — content-addressed candidate site

Contributor commands (Node built-ins only; no end-user build requirement):

```sh
npm run build:site
npm run site:verify
npm run site:select -- --release v0.1.0-<full-64-character-digest>
```

`build:site` runs static/password checks, the asset-rights gate and the exact
allowlisted preview build. Its output is:

```text
site/
  editor.html, index.html, brb.html, thanks.html, credits.html
  current-release.json
  .nojekyll
  releases/
    v<package-version>-<SHA256-of-build-manifest>/
      <all allowlisted runtime files and required notices>
      build-manifest.json
      release-manifest.json
```

The manifest includes hashes and byte lengths of every packaged input, including
CSS, JavaScript, fonts, textures, vendor modules and license notices. Any changed
input changes the namespace even without a package-version bump. Release metadata
is canonical and derived from that identity. No timestamps or machine paths enter
the output. This is integrity evidence, not a signature or supply-chain attestation.

Every scene/runtime/vendor path remains relative and its bytes are unchanged.
The versioned editor therefore generates OBS snapshot URLs inside its own release
namespace; the same runtime and transitive relative assets remain available there.
This is not HTML-only `?v=` cache busting. Slice 1 changed only tooling, not renderer source. Slice 2 deliberately adds an
editor-only preview navigation marker; accepted P2 hashes are archived separately.
Scene renderer/shader/style/asset bytes remain unchanged.

The five mutable root HTML aliases preserve query strings and exact fragments,
including legacy scene routing, and redirect into the current complete namespace.
No arbitrary alias target is accepted. No permanent UI is added to stream views.
Root legacy URLs are compatibility aliases, **not immutable release pins**.

## History, selection and safe deployment boundaries

Building reuses an existing namespace only if its contents/metadata still verify.
It refuses missing/extra/modified files and symlink/nonregular output. Verification
also requires the exact approved PACKAGE_FILES set, not just agreement with an
arbitrary manifest: recomputing a namespace digest cannot legitimize an extra
payload or a removed license/notice. Manifest file order is not significant.
Future changes to the packaged file set need an explicitly versioned historical
allowlist/migration policy and retained-release tests; do not weaken this gate to
self-consistency or silently discard older namespaces. A changed
build adds a namespace without deleting or overwriting prior namespaces. Root
aliases are staged and replaced individually; the current pointer is written
last. A process crash can leave mixed root aliases; `site:verify` detects this.
If no staging debris remains, re-run a gated build to repair aliases. A hard kill
can also leave a .select- or .incoming- staging directory; inspect/back up the tree
and remove only that confirmed interrupted staging directory before retrying.
Unknown entries are deliberately not auto-deleted. This is not an atomic hosted
deployment.

`site:select` verifies the existing complete site and selected namespace before
changing only mutable aliases/current pointer. It supports local candidate rollback
without changing either pinned release. It cannot recover a deleted/corrupted old
namespace. Published release retirement/security incidents need a separate policy.

**A clean CI checkout has no old site history.** Its candidate artifact is NOT a
drop-in production replacement. A real deployment must restore/preserve all
approved older namespaces, verify the combined site, then publish it atomically
where the host supports that. Do not upload a freshly built single-release site
over an existing deployment and claim old URLs remain supported. History storage,
retention, deployment and rollback on the chosen host are still P3 work.

The site directory is ignored by git and intentionally **not deleted by npm clean**.
Back it up if using it as local candidate history. No script publishes, tags, pushes,
writes outside fixed `site/`/`dist/`, or treats the result as production-ready.
The existing preview archive contains `dist/`, not cumulative `site/`.

Future hosting must revalidate mutable aliases/current pointer and can cache
content-addressed namespace files as immutable. Actual headers, directory redirects,
MIME behavior and stale-cache/rollback behavior must be tested on the chosen host.
A host must not SPA-fallback a missing pinned namespace to the current renderer.

## Local tests and remaining qualification

Dedicated tests cover deterministic exact input copies, changed-content identities,
retention, rollback, query/fragment-compatible aliases, credential/rights gate
failures, corrupted output, metadata, path traversal, symlinks and repository-subpath
HTTP resolution (including BRB ESM files). A fake location executes only the fixed
alias script; this is not browser/graphics automation. No actual OBS socket is used.

Local validation: **217 tests, 213 passed, four explicit platform skips, zero
failures**. Static checks, the unchanged 44-file runtime baseline, 19 asset hashes,
build, redistribution gate, candidate build/verification and diff checks pass.
The local server returned HTTP 200 for /site/editor.html. None of these results is
a browser/OBS rendering or hosted-deployment certification.

Read-only Crouton Alpha Free review identified a missing verifier allowlist gate:
self-consistent crafted manifests could add files or remove notices. Parent added
exact file-set verification and regression cases with recomputed namespace IDs
(extra payload and four missing-license/notice variants), plus order-independent
manifest verification. No delegated re-review is claimed.

CI now builds/verifies and uploads a **candidate** site after redistribution checks.
The workflow has read-only permissions and no publish/deploy step. Remote CI has not
run for these unpushed changes. Local Chrome browser comparisons are now recorded
in P3_BROWSER.md. Actual hosted deployment, archive qualification on Linux and
hardware soak/transition qualification remain unperformed.

Never put secrets in source, presets, URLs or public artifacts. Existing local-only
session audio rules remain: new hosted snapshot pages and embedded previews stay
silent; local unauthenticated OBS needs no password; authentication, if enabled,
uses a separately entered memory-only password. Legacy no-preset behavior is retained.

# Progress checkpoint — before P1

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

## Next step — P1 (not started at this checkpoint)

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

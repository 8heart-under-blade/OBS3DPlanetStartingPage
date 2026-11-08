# Contributor guide (P0 foundation)

The runtime remains a static site. **Node is required only for these contributor checks and preview packaging**, not for opening a hosted scene. There is no editor or production installer yet. See [the roadmap](docs/PRODUCTION_ROADMAP.md).

## Requirements

- Node.js 22 or newer and npm. No third-party npm dependencies are installed.
- GNU tar on Linux for `npm run package`; CI uses Ubuntu. macOS BSD tar and Windows archives are not qualified by this P0 script. All other checks/builds use Node built-ins.
- Browser/OBS runtime tests require their own supported environment; static checks are not a substitute.

## Commands

```sh
npm ci
npm run check          # first-party/inline syntax, local refs, complete runtime set, empty-password guard
npm run baseline:verify # verify current runtime source bytes; historical P0 hashes are retained
npm run assets:check   # inventory coverage, SHA-256, metadata and blocker consistency
npm test              # built-in node:test regression/contract suite
npm run build         # regenerate dist/ from exact allowlisted inputs, including notices
npm run package       # rebuild, then local preview tar.gz + SHA-256 checksum
npm run release:check # fail while any asset redistribution rights remain unresolved
npm run clean         # delete generated dist/ and release/ outputs
```

`release:check` is a static eligibility gate, **not** legal approval or runtime production certification. It currently passes for the openly licensed replacement set: five Solar System Scope textures (CC BY 4.0), two OFL fonts and the existing MIT Three.js files. Never clear a future blocker by changing status labels without evidence and review. CI uploads previews only when this gate passes. There is no deployment step.

## Outputs

- `dist/`: exactly allowlisted runtime files, root license, attribution/audit notices, and deterministic `build-manifest.json` with SHA-256 hashes, sizes and `previewOnly: true`. No scene transformations.
- `release/obs3dplanetstartingpage-preview-v0.1.0.tar.gz` and matching `.sha256`: local developer preview, not an end-user installer or public release.
- Builds clean stale output and preflight inputs. Packaging always rebuilds so stale `dist/` cannot bypass the credentials guard. GNU tar normalizes mode/owner/mtime; Node generates gzip without a timestamp. Unlisted files are not copied; listed files and their parent paths may not be symlinks. Custom destructive output paths are not accepted.

## Credentials and safety boundaries

Never place a real OBS password into a committed or shared `config.js`. It currently contains `password: ""`. Builds reject nonempty or dynamic password values and do not print the value. The P0 guard also conservatively rejects backslash escapes in executable config tokens (comments excluded), preventing escaped password-property spellings; arbitrary JavaScript customization will need a real schema/parser in a later phase. The scanner checks the current password-property contract without executing config code; **it is not a general secret scanner or proof arbitrary JavaScript is safe**. Review changes manually, including secret-like content elsewhere.

`.env*`, local override filenames and key files are ignored as an extra safeguard. Local overrides are **not yet loaded by the runtime**; creating one does not configure OBS. The separate setup/credential path is planned in P2/P4. Ignoring a file is not sufficient to protect a credential embedded in a tracked file.

## Windows checks

`.gitattributes` requires LF text to preserve byte hashes. Avoid checkout-wide line-ending conversion. On Windows without Developer Mode/elevation, the three file-symlink regressions report explicit skips; they must still run on Linux CI. GNU tar packaging is separately skipped when unavailable. Skips do not qualify those paths on Windows.

## Baselines and new assets

Read [BASELINE.md](docs/BASELINE.md) before modifying scenes. The active `source-baseline.json` records the intentional licensed-asset migration; `source-baseline-p0.json` retains the original hashes. A hash update does not establish visual parity. Rendering refactors still need real browser/OBS evidence, and baseline updates must be deliberate—not regenerated to hide unexpected differences.

When adding/replacing assets, update the exact build allowlist in `scripts/lib.mjs`, the source baseline where appropriate, the asset inventory and notices. Check hashes and record verifiable source/license evidence. Do not infer rights from a filename or root MIT license. [ASSET_AUDIT.md](docs/ASSET_AUDIT.md) documents the replacement provenance. Non-vendor verified assets must list shipped license evidence and its hashes in the inventory.

No public release should occur until both licensing and the browser/OBS acceptance gates in the roadmap are satisfied. Preview tests alone do not establish WebGL rendering, compatibility, offline operation or performance.

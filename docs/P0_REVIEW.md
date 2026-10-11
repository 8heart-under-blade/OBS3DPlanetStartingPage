# P0 implementation review record

Branch: `feature/production-foundation`.

Implementation assistance: OpenCode Muse Spark (tooling) and Big Pickle (asset audit). Coordinator integrated/hardened the work. GitHub Copilot Auto performed two independent read-only review rounds. The second round included the first round's findings and coordinator responses. This record is not a security certification.

## Findings and disposition

- Broad directory copying could accidentally include newly added local configs/secret files: replaced with exact runtime/notice file lists; regression covers unlisted files.
- Packaging reused an existing `dist/`: packaging now always rebuilds, rechecking credentials and inputs.
- Arbitrary `--out` cleanup could remove unintended content: custom output rejected; only the selected root's `dist/` is cleaned.
- Shell-based gzip command: replaced with direct GNU tar execution and Node gzip; safe semantic version validation.
- Credential syntax diagnostics could quote a source line: guard runs first; failures withhold the password value. Static guard is narrow, not a comprehensive scanner.
- Dangling archive/checksum symlinks bypassed `existsSync`: `lstat`-based checks and exclusive file creation; tests cover both paths.
- Missing CI source-baseline verification: CI now runs `baseline:verify` and `assets:check`.
- Weak reproducibility/member tests: actual archive-byte comparison and independent source-baseline member list, including licensing notices, now tested.
- Escaped password property spellings were not recognized: P0 conservatively rejects backslashes in non-comment config tokens, including escaped identifiers/keys; regression includes these spellings. Later schema/data-based configuration should replace this restrictive JavaScript guard.
- Archive could be deleted before discovering an unsafe checksum output: validate both outputs before unlinking either; regression preserves an existing archive on failure.
- Redistribution of unresolved assets through CI artifacts: `release:check` blocks eligibility; upload step is skipped while asset rights are unresolved. No deployment configured.

The first review's defects were confirmed resolved by the second review. The second review's two additional findings were subsequently fixed and regression-tested by the coordinator; no third independent review is claimed.

## Validation obtained

- `npm ci` succeeds with no third-party npm dependencies.
- `npm run check`, `baseline:verify`, `assets:check` pass.
- 26 Node contract/regression tests pass, no skips on this GNU/Linux host.
- Preview build and GNU tar/gzip archive are reproducible; generated output contains the intended 32 runtime/license files plus three notices and the manifest.
- `release:check` fails as expected for eight unresolved assets.
- `git diff --check` passes; all 31 original runtime source files are byte-identical to the recorded baseline.

## Remaining gates

- Two fonts and six textures need documented redistribution terms or verified replacements.
- Browser/OBS visual, offline, compatibility, lifecycle, accessibility and performance qualification are not performed. Missing browser libraries block capture here; see BASELINE.md.
- GNU tar packaging is contributor-preview functionality on Linux/CI, not a cross-platform end-user installer.
- Static licensing status labels require human evidence review; a passing gate alone cannot establish legal rights.

# Retained deployment history — offline preparation, not publishing

Published renderer URLs must survive every rollout and rollback. A clean CI artifact
contains only a source candidate; **never upload it as a replacement for cumulative
history**. These tools make restore-before-build and a fresh backup/restore rehearsal
one local preparation operation. They do not authenticate, download, upload, tag,
create a project/release, update a public alias or authorize production.

## Trust anchor and existing durable backup

The latest production upload and download/restore-verified archive are recorded in
[deployed-history.json](deployed-history.json). Use that reviewed record for the
next cumulative preparation. The bootstrap below remains the original migration
backup, not a silently updated visual reference; preserve both backups indefinitely.

The migration backup is already published as a GitHub **backup prerelease**, not
latest/production. Its reviewed URL, out-of-band SHA-256, 341-record count, three
namespaces, accepted current and accepted P2 commit are in
[history-bootstrap.json](history-bootstrap.json). Preserve that backup indefinitely.
The original migration verified the archive and every file before restoring it.
The new reader also accepts that original ustar archive without conversion.

Download the public archive into a separate local folder when needed. No token is
required for that public download. Verify against the reviewed pin, not only a
checksum downloaded alongside an archive. The embedded catalog is an integrity
check, **not a signature** or independent trust anchor. A wrong/stale but correctly
hashed snapshot is still wrong/stale: before any upload, review which snapshot is
the latest complete deployed history. The bootstrap snapshot must not silently
become the permanent input after newer namespaces have been published.

## Commands

All scripts use Node >=22 built-ins; no tar binary or new dependency is needed.
Paths below are examples; keep bundles and archives outside the source checkout.
Use a new, nonexistent output directory each time. Shell continuations below use
POSIX syntax; the CLI flags are the same on Windows.

```sh
# Read-only authentication/catalog/site/hosting verification of the migration archive:
npm run history:verify -- \
  --archive /backups/cosmic-stream-scenes-history-20261109T001712Z.tar.gz \
  --sha256 b30048e3b7e081ae5e5da29c1cd53c88edddc038fbca89c38dd86cb1140360fa

# Restore only; never build first on a fresh machine. Existing site/ and cf-dist/
# must be absent or exactly byte-identical to the archive, or restoration refuses.
npm run history:restore -- \
  --archive /backups/cosmic-stream-scenes-history-20261109T001712Z.tar.gz \
  --sha256 b30048e3b7e081ae5e5da29c1cd53c88edddc038fbca89c38dd86cb1140360fa \
  --root /work/recovery

# Preferred candidate preparation: trusted history -> isolated restore -> gated
# source build -> explicit accepted-current selection -> backup -> restore check.
npm run prepare:cloudflare -- \
  --archive /backups/cosmic-stream-scenes-history-20261109T001712Z.tar.gz \
  --sha256 b30048e3b7e081ae5e5da29c1cd53c88edddc038fbca89c38dd86cb1140360fa \
  --release v0.1.0-6613f9a2f7269ed867f21986aa2dc412dadc3c55803c27286292f4a7fcf97fc1 \
  --output /work/prepared-unique
```

`--root` on preparation defaults to the source checkout. That checkout's site/,
cf-dist/ and dist/ are not changed. Only exact allowlisted source/notices plus
package.json are copied to a sibling staging directory. The pinned history is
restored **before** Cloudflare's gated build is invoked. Existing namespaces are
checked byte-for-byte afterwards. Output appears only when preparation succeeds.
On failure, temporary preparation data is removed; source history and older backups
remain untouched. Run one writer per destination; these are not hostile concurrent
filesystem or multi-operator locking tools. A filesystem/process crash during a
standalone two-folder restore may leave one folder installed; rerunning with the
same archive completes the restore without replacing differing history.

Selection is mandatory:

- `--release <retained-id>` preserves/selects an already retained renderer as current,
  while also retaining the newly built source namespace.
- `--release source` explicitly chooses the new source renderer. Use only after that
  renderer is reviewed/qualified; source selection is not implied by preparation.

The prepared bundle contains:

- `cf-dist/`: the **only** folder eligible for a separately authorized Pages upload;
- `site/` and allowlisted source inputs: recovery/build inputs, not upload roots;
- `history.tar.gz`: complete site + cf-dist snapshot, including the selected current;
- `preparation.json`: input/output archive pins, requested/actual selection, retained
  IDs and record count. It explicitly says preparation only, not production approved.

To snapshot an already consistent site/cf-dist pair without building:

```sh
npm run history:snapshot -- --root /work/prepared-unique \
  --output /backups/history-unique.tar.gz
```

Snapshot creation runs both validators, builds an exact size/SHA-256 catalog,
rehearses a fresh restore, writes without overwriting an existing file, re-reads and
verifies the stored archive, and prints its digest. No pruning command exists.

## Retention and off-machine verification gate

Local success is **not durable off-machine retention**. Before publishing any
prepared tree containing new namespaces:

1. Preserve the previous trusted backup, its independently recorded digest and its
   release permalink. Do not overwrite or delete old archive objects/assets.
2. Copy the new `history.tar.gz` to the approved off-machine backup location under
   a unique immutable name (currently GitHub backup prereleases are the established
   storage). Creating/uploading such a backup is a separate authorized public-state
   operation; this command does not do it.
3. Download that stored archive back to a new local path. Check its SHA-256 against
   `preparation.json` / the separately recorded trusted digest, then run
   `history:verify` and `history:restore` into a fresh destination. Compare the
   resulting current, complete namespace list and record count with the preparation.
4. Record the backup permalink and pin in a reviewed handoff/change record. Retain
   both previous and candidate backups even if a rollout is cancelled or rolled back.
5. Only after qualification and explicit publishing approval may an operator upload
   the verified **complete** cf-dist. No publish command or automatic deployment is
   added here. Use the existing live HTTP audit and user OBS checks afterwards.
6. Following any publish, update the trusted deployed-history record to the complete
   published snapshot; do not confuse a prepared-but-unpublished candidate with the
   deployed current. Rollback selects an older current in the complete cumulative
   tree; it does not restore an old incomplete Cloudflare deployment.

The initial migration backup satisfies the existing three-namespace off-machine
snapshot, not future candidate uploads. New off-machine storage/download checks,
remote CI and production/OBS qualification must be reported separately, never
inferred from local rehearsal.

## Safety limits and tests

The pinned compressed bytes are checked before decompression. The reader accepts a
strict ustar subset only: regular files/directories under site/ or cf-dist/, plus
snapshot.json. It rejects traversal/absolute/backslash/unsafe portable names,
case-colliding or duplicate members, links, devices, extension headers, file/dir
collisions, bad checksums, truncated framing and unknown directories. It parses
all members and checks the exact catalog before writing into a new temporary root.
Ownership and archive modes are never restored; files/directories use local safe
permissions. Both site and hosting validators then run, including exact approved
file sets, sealed namespaces, cache/404 policy and blank OBS-password gates.

Compressed and decompressed input are limited to 256 MiB and 40,001 tar members.
Large histories fail closed rather than pruning; increase/rework limits only with
review and tests. Snapshots may differ by creation time; they are checksum-sealed,
not signature-certified or claimed deterministic release products.

`tests/history.test.mjs` covers round-trip/idempotence, immutable backup names,
pin/catalog/metadata/hosting tampering, unsafe tar types/paths/framing, conflict
refusal, symlink ancestors, explicit current selection, full cumulative retention,
isolated preparation, source selection and post-build snapshot restore. The normal
Linux/Windows Node CI job runs these tests; no external archive download or public
mutation is part of CI. Synthetic CI artifacts are still not deployed history.

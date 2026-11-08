import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { repoRoot, RUNTIME_FILES, PACKAGE_FILES } from '../scripts/lib.mjs';
import { verifyInventory } from '../scripts/assets.mjs';
const root = repoRoot();
const inventory = JSON.parse(readFileSync(join(root, 'docs/asset-inventory.json'), 'utf8'));

test('source baseline matches the exact current runtime set', () => {
  const count = RUNTIME_FILES.filter(p => p !== 'LICENSE').length;
  assert.match(execFileSync(process.execPath, [join(root, 'scripts/baseline.mjs')], { encoding: 'utf8' }), new RegExp('all ' + count + ' runtime files match'));
});

test('asset inventory hashes, coverage and blockers agree', () => {
  const result = verifyInventory(root, inventory);
  assert.equal(result.total, 19);
  assert.equal(result.unresolved.length, 0);
});

test('asset inventory rejects missing/duplicate entries, altered hashes and inaccurate blockers', () => {
  for (const mutate of [
    inv => inv.assets.pop(),
    inv => inv.assets.push(inv.assets[0]),
    inv => inv.assets[0].sha256 = '0'.repeat(64),
    inv => inv.releaseBlockers = [{path: inv.assets[0].path, reason: 'inaccurate'}],
    inv => inv.counts.total = 0,
    inv => delete inv.assets.find(a => a.path.endsWith('.ttf')).licenseFiles,
    inv => inv.assets.find(a => a.path.endsWith('.ttf')).licenseFileHashes = {},
    inv => inv.assets.find(a => a.path.endsWith('.ttf')).licenseFiles = ['LICENSE'],
  ]) {
    const copy = structuredClone(inventory); mutate(copy);
    assert.throws(() => verifyInventory(root, copy));
  }
});

test('current asset set passes static redistribution eligibility', () => {
  assert.match(execFileSync(process.execPath, [join(root, 'scripts/assets.mjs'), '--release'], { encoding: 'utf8' }), /0 unresolved rights/);
});

test('release check still refuses an unresolved asset', () => {
  const dir = mkdtempSync(join(tmpdir(), 'obs3d-rights-'));
  try {
    for (const rel of PACKAGE_FILES) {
      mkdirSync(dirname(join(dir, rel)), { recursive: true });
      copyFileSync(join(root, rel), join(dir, rel));
    }
    const copy = structuredClone(inventory);
    copy.assets[0].status = 'unresolved';
    copy.releaseBlockers = [{path: copy.assets[0].path, reason: 'test fixture'}];
    copy.counts.verified--; copy.counts.unresolved++;
    writeFileSync(join(dir, 'docs/asset-inventory.json'), JSON.stringify(copy));
    assert.throws(
      () => execFileSync(process.execPath, [join(root, 'scripts/assets.mjs'), '--release'], { env: {...process.env, OBS3DSP_ROOT: dir}, stdio: 'pipe' }),
      error => /redistribution blocked/i.test(String(error.stderr))
    );
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

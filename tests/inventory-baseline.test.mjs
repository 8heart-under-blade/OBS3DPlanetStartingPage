import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { repoRoot } from '../scripts/lib.mjs';
import { verifyInventory } from '../scripts/assets.mjs';
const root = repoRoot();
const inventory = JSON.parse(readFileSync(join(root, 'docs/asset-inventory.json'), 'utf8'));
test('source baseline matches every original runtime file', () => {
  assert.match(execFileSync(process.execPath, [join(root, 'scripts/baseline.mjs')], { encoding: 'utf8' }), /all 31 runtime files match/);
});
test('asset inventory hashes, coverage and blockers agree', () => {
  const result = verifyInventory(root, inventory);
  assert.equal(result.total, 20);
  assert.equal(result.unresolved.length, inventory.assets.filter(a => a.status === 'unresolved').length);
});
test('asset inventory rejects missing/duplicate entries, altered hashes and inaccurate blockers', () => {
  for (const mutate of [
    inv => inv.assets.pop(),
    inv => inv.assets.push(inv.assets[0]),
    inv => inv.assets[0].sha256 = '0'.repeat(64),
    inv => inv.releaseBlockers = [],
    inv => inv.counts.total = 0,
  ]) {
    const copy = structuredClone(inventory); mutate(copy);
    assert.throws(() => verifyInventory(root, copy));
  }
});
test('release check refuses unresolved redistribution rights', () => {
  if (!inventory.assets.some(a => a.status === 'unresolved')) return;
  let failed = false;
  try { execFileSync(process.execPath, [join(root, 'scripts/assets.mjs'), '--release'], { stdio: 'pipe' }); }
  catch (error) { failed = true; assert.match(String(error.stderr), /redistribution blocked/i); }
  assert.equal(failed, true);
});

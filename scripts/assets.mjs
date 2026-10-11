// Verify inventory integrity. --release additionally refuses unresolved rights.
// A successful license gate is not a legal opinion or OBS/runtime qualification.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot, RUNTIME_FILES, assertRegularFile, sha256File } from './lib.mjs';
export function verifyInventory(root, inventory) {
  if (inventory.schemaVersion !== 1 || !Array.isArray(inventory.assets)) throw new Error('Unsupported asset inventory format');
  const expected = RUNTIME_FILES.filter(p => p.startsWith('vendor/') || p.startsWith('textures/') || p.endsWith('.woff')).sort();
  const paths = inventory.assets.map(a => a.path).sort();
  if (JSON.stringify(paths) !== JSON.stringify(expected)) throw new Error('Asset inventory coverage mismatch or duplicate records');
  const unresolved = [];
  for (const asset of inventory.assets) {
    if (!['verified', 'unresolved'].includes(asset.status)) throw new Error(`Invalid status: ${asset.path}`);
    for (const key of ['source', 'license', 'evidence', 'notes']) {
      if (typeof asset[key] !== 'string' || !asset[key].trim()) throw new Error(`Missing ${key}: ${asset.path}`);
    }
    assertRegularFile(root, asset.path);
    if (sha256File(join(root, asset.path)) !== asset.sha256) throw new Error(`Asset hash mismatch: ${asset.path}`);
    if (asset.status === 'unresolved') unresolved.push(asset.path);
  }
  if (inventory.counts?.total !== expected.length || inventory.counts?.unresolved !== unresolved.length ||
      inventory.counts?.verified !== expected.length - unresolved.length) throw new Error('Inventory counts are inconsistent');
  const blockers = (inventory.releaseBlockers || []).map(b => b.path).sort();
  if (JSON.stringify(blockers) !== JSON.stringify(unresolved.sort())) throw new Error('Release blockers do not match unresolved assets');
  return { total: expected.length, unresolved };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const root = repoRoot();
    const inventory = JSON.parse(readFileSync(join(root, 'docs/asset-inventory.json'), 'utf8'));
    const result = verifyInventory(root, inventory);
    console.log(`assets: ${result.total} hashes verified, ${result.unresolved.length} unresolved rights`);
    if (process.argv.includes('--release') && result.unresolved.length) {
      throw new Error(`Public redistribution blocked by ${result.unresolved.length} unresolved assets; see ATTRIBUTIONS.md`);
    }
  } catch (error) {
    console.error(`assets FAIL: ${error.message}`); process.exitCode = 1;
  }
}

// Source-byte preservation check only, not browser/visual validation.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, assertRegularFile, sha256File, RUNTIME_FILES } from './lib.mjs';
try {
  const root = repoRoot();
  const baseline = JSON.parse(readFileSync(join(root, 'docs/source-baseline.json'), 'utf8'));
  if (baseline.schemaVersion !== 1 || !Array.isArray(baseline.files)) throw new Error('Unsupported baseline format');
  const expected = RUNTIME_FILES.filter(p => p !== 'LICENSE');
  const paths = baseline.files.map(f => f.path).sort();
  if (JSON.stringify(paths) !== JSON.stringify(expected)) throw new Error('Baseline must cover the exact runtime file set');
  for (const file of baseline.files) {
    assertRegularFile(root, file.path);
    const abs = join(root, file.path);
    if (readFileSync(abs).length !== file.bytes || sha256File(abs) !== file.sha256) {
      throw new Error(`Runtime differs from recorded baseline: ${file.path}`);
    }
  }
  console.log(`baseline: all ${baseline.files.length} runtime files match source bytes at ${baseline.sourceCommit}`);
  console.log('baseline: no rendering or OBS qualification implied');
} catch (error) {
  console.error(`baseline FAIL: ${error.message}`);
  process.exitCode = 1;
}

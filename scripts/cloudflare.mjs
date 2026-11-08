// Prepare/verify only. Never authenticates, creates a project or deploys.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertNotSymlink, assertRegularFile, repoRoot } from './lib.mjs';
import { json, tree, verifySite } from './site-lib.mjs';
import { cloudflareManifest, headersFile, NOT_FOUND, verifyCloudflare } from './cloudflare-lib.mjs';
try {
  const args = process.argv.slice(2), command = args.shift();
  let root = repoRoot();
  if (args.length) {
    if (args.length !== 2 || args[0] !== '--root' || !args[1] || args[1].startsWith('--')) throw new Error('Invalid Cloudflare arguments');
    root = resolve(args[1]);
  }
  if (!['build', 'verify'].includes(command)) throw new Error('Invalid Cloudflare command');
  const output = join(root, 'cf-dist');
  assertNotSymlink(output);
  if (command === 'verify') {
    const verified = verifyCloudflare(output);
    console.log(`cloudflare: verified ${verified.releases.length} retained namespace(s), current ${verified.current}`);
  } else {
    const prior = existsSync(output) ? verifyCloudflare(output) : null;
    execFileSync(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), 'site.mjs'), 'build', '--root', root], {stdio: 'inherit'});
    const site = join(root, 'site'), verified = verifySite(site);
    if (prior && prior.releases.some(id => !verified.releases.includes(id))) throw new Error('Refusing to drop previously prepared Cloudflare history; restore trusted site history');
    // Fully validate the policy/limits before replacing the prepared folder.
    const headers = headersFile(verified.releases);
    const stage = mkdtempSync(join(root, '.cf-stage-'));
    const next = join(stage, 'next'), previous = join(stage, 'previous');
    let installed = false, moved = false, restored = false;
    try {
      mkdirSync(next);
      for (const path of tree(site)) {
        assertRegularFile(site, path);
        const target = join(next, path); mkdirSync(dirname(target), {recursive: true});
        copyFileSync(join(site, path), target);
      }
      writeFileSync(join(next, '_headers'), headers);
      writeFileSync(join(next, '404.html'), NOT_FOUND);
      writeFileSync(join(next, 'cloudflare-manifest.json'), json(cloudflareManifest(next, verified)));
      verifyCloudflare(next);
      assertNotSymlink(output);
      if (existsSync(output)) { renameSync(output, previous); moved = true; }
      try { renameSync(next, output); installed = true; }
      catch (error) {
        if (moved && !existsSync(output)) { renameSync(previous, output); restored = true; }
        throw error;
      }
    } finally {
      // Preserve a backup if a filesystem failure prevented restoring it.
      if (!moved || installed || restored) rmSync(stage, {recursive: true, force: true});
    }
    console.log(`cloudflare: prepared cf-dist/ with ${verified.releases.length} retained namespace(s)`);
    console.log('cloudflare: scoped immutable-cache rules, mutable alias revalidation, explicit non-SPA 404 and checksums verified');
  }
  console.log('PREPARATION ONLY: no upload, account access or production qualification.');
} catch {
  console.error('cloudflare FAIL: output preparation/verification refused. Check source/site integrity, retained history, output ownership and Pages limits. Details withheld.');
  process.exitCode = 1;
}

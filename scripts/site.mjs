// Candidate site builder/selector. Does not deploy, publish, tag or qualify a release.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PACKAGE_FILES, assertRegularFile, repoRoot, sha256File } from './lib.mjs';
import { contentHash, json, preflightSite, releaseId, selectRelease, tree, verifyAllReleases, verifyRelease, verifySite } from './site-lib.mjs';
const scripts = dirname(fileURLToPath(import.meta.url));
try {
  const args = process.argv.slice(2), command = args.shift();
  const options = {};
  while (args.length) {
    const key = args.shift();
    if (!['--root', '--release'].includes(key) || options[key] !== undefined || !args.length) throw new Error('Invalid site arguments');
    const value = args.shift();
    if (!value || value.startsWith('--')) throw new Error('Invalid site argument value');
    options[key] = value;
  }
  if (!['build', 'verify', 'select'].includes(command) || (options['--release'] !== undefined && command !== 'select')) throw new Error('Invalid site command');
  const root = options['--root'] ? resolve(options['--root']) : repoRoot();
  const site = join(root, 'site');
  if (command === 'build') {
    preflightSite(site);
    if (existsSync(join(site, 'releases'))) verifyAllReleases(site);
    const env = {...process.env, OBS3DSP_ROOT: root};
    for (const [script, flags] of [['check.mjs', []], ['assets.mjs', ['--release']], ['build.mjs', ['--root', root]]]) {
      execFileSync(process.execPath, [join(scripts, script), ...flags], {env, stdio: 'inherit'});
    }
    const dist = join(root, 'dist');
    const manifestBytes = readFileSync(join(dist, 'build-manifest.json'));
    const manifest = JSON.parse(manifestBytes.toString('utf8'));
    if (JSON.stringify(manifest.files.map(file => file.path)) !== JSON.stringify(PACKAGE_FILES)) throw new Error('Invalid input file set');
    const hash = contentHash(manifestBytes), id = releaseId(manifest.version, hash);
    const release = {schemaVersion: 1, releaseId: id, version: manifest.version, buildManifestSha256: hash, previewOnly: true};
    const releaseText = json(release);
    const destination = join(site, 'releases', id);
    mkdirSync(join(site, 'releases'), {recursive: true});
    if (existsSync(destination)) {
      verifyRelease(site, id);
      if (readFileSync(join(destination, 'release-manifest.json'), 'utf8') !== releaseText) throw new Error('Refusing changed release metadata');
    } else {
      const stage = mkdtempSync(join(site, 'releases', '.incoming-'));
      try {
        for (const path of [...PACKAGE_FILES, 'build-manifest.json']) {
          assertRegularFile(dist, path);
          const target = join(stage, path); mkdirSync(dirname(target), {recursive: true});
          copyFileSync(join(dist, path), target);
        }
        writeFileSync(join(stage, 'release-manifest.json'), releaseText);
        // Validate staged files against the fresh manifest before making them addressable.
        for (const file of manifest.files) {
          if (readFileSync(join(stage, file.path)).length !== file.bytes || sha256File(join(stage, file.path)) !== file.sha256) throw new Error('Staged content differs from input');
        }
        if (sha256File(join(stage, 'build-manifest.json')) !== hash || tree(stage).length !== PACKAGE_FILES.length + 2) throw new Error('Invalid staging layout');
        renameSync(stage, destination);
      } finally { rmSync(stage, {recursive: true, force: true}); }
    }
    selectRelease(site, id);
    const verified = verifySite(site);
    console.log(`site: candidate ${verified.current}; ${verified.releases.length} namespace(s) retained`);
    console.log(`site: serve site/; editor.html redirects to releases/${id}/editor.html`);
  } else if (command === 'select') {
    verifySite(site); // Refuse an already inconsistent/partially updated deployment.
    selectRelease(site, options['--release']);
    verifySite(site);
    console.log(`site: current candidate selected: ${options['--release']}`);
  } else {
    const verified = verifySite(site);
    console.log(`site: integrity passed for ${verified.releases.length} namespace(s); current ${verified.current}`);
  }
  console.log('CANDIDATE ONLY: no deployment, browser/OBS or sustained-playback qualification implied.');
} catch (error) {
  // JSON/parser/child errors can contain source excerpts; never print raw exceptions.
  console.error('site FAIL: candidate operation refused. Check input/license/password gates, manifest integrity, arguments and output file types. Error details withheld.');
  process.exitCode = 1;
}

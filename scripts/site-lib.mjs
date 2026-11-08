// P3 candidate deployment layout. Integrity is not a signature or runtime qualification.
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { HTML_PAGES, PACKAGE_FILES, assertNotSymlink, assertRegularFile, inspectPasswordAssignment, sha256File } from './lib.mjs';

export const ROOT_FILES = [...HTML_PAGES, 'current-release.json', '.nojekyll'].sort();
const safeVersion = value => typeof value === 'string' && /^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(value);
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const json = value => JSON.stringify(value, null, 2) + '\n';
export const contentHash = value => createHash('sha256').update(value).digest('hex');
export function releaseId(version, hash) {
  if (!safeVersion(version) || !digest(hash)) throw new Error('Invalid release identity');
  return `v${version}-${hash}`;
}
export function validId(id) { return typeof id === 'string' && /^v\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?-[a-f0-9]{64}$/.test(id); }
function safePath(path) {
  return typeof path === 'string' && path.split('/').every(part => /^[A-Za-z0-9_.-]+$/.test(part) && part !== '.' && part !== '..');
}
export function tree(root, prefix = '') {
  const files = [];
  for (const entry of readdirSync(join(root, prefix), {withFileTypes: true})) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error('Symlink in deployment output');
    if (entry.isDirectory()) files.push(...tree(root, path));
    else if (entry.isFile()) files.push(path);
    else throw new Error('Nonregular deployment output');
  }
  return files.sort();
}
export function verifyRelease(site, id) {
  if (!validId(id)) throw new Error('Invalid release identity');
  assertNotSymlink(site); assertNotSymlink(join(site, 'releases'));
  const root = join(site, 'releases', id);
  assertNotSymlink(root);
  for (const path of ['build-manifest.json', 'release-manifest.json', 'config.js']) assertRegularFile(root, path);
  const buildHash = sha256File(join(root, 'build-manifest.json'));
  const build = JSON.parse(readFileSync(join(root, 'build-manifest.json'), 'utf8'));
  const releaseText = readFileSync(join(root, 'release-manifest.json'), 'utf8');
  const release = JSON.parse(releaseText);
  if (build.schemaVersion !== 1 || build.name !== 'obs3dplanetstartingpage' || build.previewOnly !== true || !safeVersion(build.version) || !Array.isArray(build.files) || !build.files.length) throw new Error('Invalid candidate build manifest');
  if (release.schemaVersion !== 1 || release.previewOnly !== true || release.version !== build.version || release.buildManifestSha256 !== buildHash || release.releaseId !== id || releaseId(build.version, buildHash) !== id) throw new Error('Release identity does not match its contents');
  if (releaseText !== json({schemaVersion: 1, releaseId: id, version: build.version, buildManifestSha256: buildHash, previewOnly: true})) throw new Error('Release metadata is not canonical');
  const paths = build.files.map(file => file.path);
  if (new Set(paths).size !== paths.length || paths.includes('build-manifest.json') || paths.includes('release-manifest.json') || !paths.includes('config.js')) throw new Error('Invalid build file set');
  if (JSON.stringify([...paths].sort()) !== JSON.stringify([...PACKAGE_FILES].sort())) throw new Error('Invalid build file set');
  const expected = [...paths, 'build-manifest.json', 'release-manifest.json'].sort();
  if (JSON.stringify(tree(root)) !== JSON.stringify(expected)) throw new Error('Release has missing or unexpected files');
  for (const file of build.files) {
    if (!safePath(file.path) || !Number.isSafeInteger(file.bytes) || file.bytes < 0 || !digest(file.sha256)) throw new Error('Invalid release file record');
    assertRegularFile(root, file.path);
    if (readFileSync(join(root, file.path)).length !== file.bytes || sha256File(join(root, file.path)) !== file.sha256) throw new Error('Release content integrity failed');
  }
  const password = inspectPasswordAssignment(readFileSync(join(root, 'config.js'), 'utf8'));
  if (!password.found || !password.blank) throw new Error('Release OBS password must be blank (value withheld)');
  return release;
}
export function aliasHtml(id, page) {
  if (!validId(id) || !HTML_PAGES.includes(page)) throw new Error('Invalid compatibility alias');
  const target = `releases/${id}/${page}`;
  return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OBS3DPlanet — current candidate</title></head><body>\n' +
    '<p>Opening the current candidate. <a href="' + target + '">Continue</a></p>\n' +
    '<script>location.replace(new URL(' + JSON.stringify(target) + ' + location.search + location.hash, location.href).href);</script>\n' +
    '<noscript>This app requires JavaScript. Existing personalized release links remain independent of this current-version alias.</noscript>\n</body></html>\n';
}
export function preflightSite(site) {
  assertNotSymlink(site);
  if (!existsSync(site)) return;
  if (!lstatSync(site).isDirectory()) throw new Error('Deployment output must be a directory');
  for (const entry of readdirSync(site)) {
    if (entry !== 'releases' && !ROOT_FILES.includes(entry)) throw new Error('Unexpected deployment root entry; refusing to overwrite it');
    const path = join(site, entry); assertNotSymlink(path);
    if (entry === 'releases' ? !lstatSync(path).isDirectory() : !lstatSync(path).isFile()) throw new Error('Invalid deployment root entry');
  }
}
export function verifyAllReleases(site) {
  const releases = join(site, 'releases'); assertNotSymlink(releases);
  const ids = readdirSync(releases).sort();
  for (const id of ids) verifyRelease(site, id);
  return ids;
}
export function selectRelease(site, id) {
  preflightSite(site);
  const release = verifyRelease(site, id);
  // Stage each small mutable alias; namespaces are never rewritten or deleted.
  const stage = mkdtempSync(join(site, '.select-'));
  try {
    const pointer = {schemaVersion: 1, releaseId: id, version: release.version, path: `releases/${id}/`, previewOnly: true};
    for (const page of HTML_PAGES) writeFileSync(join(stage, page), aliasHtml(id, page));
    writeFileSync(join(stage, '.nojekyll'), '');
    writeFileSync(join(stage, 'current-release.json'), json(pointer));
    // Pointer last. Every alias always targets a complete, verified namespace.
    for (const file of [...HTML_PAGES, '.nojekyll', 'current-release.json']) {
      assertNotSymlink(join(site, file));
      renameSync(join(stage, file), join(site, file));
    }
  } finally { rmSync(stage, {recursive: true, force: true}); }
  return release;
}
export function verifySite(site) {
  preflightSite(site);
  return verifySiteContents(site);
}
// Caller must enforce its own exact root catalog (site or hosting adapter).
export function verifySiteContents(site) {
  for (const file of ROOT_FILES) assertRegularFile(site, file);
  const ids = verifyAllReleases(site);
  const pointer = JSON.parse(readFileSync(join(site, 'current-release.json'), 'utf8'));
  const release = verifyRelease(site, pointer.releaseId);
  if (pointer.schemaVersion !== 1 || pointer.previewOnly !== true || pointer.version !== release.version || pointer.path !== `releases/${pointer.releaseId}/`) throw new Error('Invalid current release pointer');
  if (readFileSync(join(site, 'current-release.json'), 'utf8') !== json({schemaVersion: 1, releaseId: pointer.releaseId, version: release.version, path: `releases/${pointer.releaseId}/`, previewOnly: true})) throw new Error('Current release pointer is not canonical');
  for (const page of HTML_PAGES) if (readFileSync(join(site, page), 'utf8') !== aliasHtml(pointer.releaseId, page)) throw new Error('Compatibility aliases do not match the current release');
  if (readFileSync(join(site, '.nojekyll')).length) throw new Error('Invalid static-host marker');
  return {current: pointer.releaseId, releases: ids};
}
export {json};

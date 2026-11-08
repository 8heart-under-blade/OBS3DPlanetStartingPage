import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { HTML_PAGES, PACKAGE_FILES, extractHtmlRefs, extractInlineScripts, repoRoot, sha256File } from '../scripts/lib.mjs';
import { aliasHtml, contentHash, json, releaseId, tree, verifyRelease, verifySite } from '../scripts/site-lib.mjs';
const ROOT = repoRoot(), SCRIPT = join(ROOT, 'scripts/site.mjs');
const snapshots = createRequire(import.meta.url)('../runtime/snapshots.js')();
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'obs3d-site-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  for (const path of [...PACKAGE_FILES, 'package.json']) {
    mkdirSync(dirname(join(root, path)), {recursive: true});
    copyFileSync(join(ROOT, path), join(root, path));
  }
  const site = join(root, 'site');
  function run(command = 'build', args = [], ok = true) {
    const result = spawnSync(process.execPath, [SCRIPT, command, '--root', root, ...args], {encoding: 'utf8'});
    if (ok) assert.equal(result.status, 0, result.stdout + result.stderr);
    else assert.notEqual(result.status, 0);
    return result;
  }
  const current = () => JSON.parse(readFileSync(join(site, 'current-release.json'), 'utf8')).releaseId;
  const hashes = () => Object.fromEntries(tree(site).map(path => [path, sha256File(join(site, path))]));
  return {root, site, run, current, hashes};
}

test('candidate namespace is deterministic, exact-allowlisted and byte-for-byte source content', t => {
  const f = fixture(t); f.run();
  const id = f.current(), release = join(f.site, 'releases', id);
  assert.match(id, /^v0\.1\.0-[a-f0-9]{64}$/);
  assert.deepEqual(tree(release), [...PACKAGE_FILES, 'build-manifest.json', 'release-manifest.json'].sort());
  for (const path of PACKAGE_FILES) assert.equal(sha256File(join(release, path)), sha256File(join(f.root, path)), path);
  const first = f.hashes(); f.run(); assert.equal(f.current(), id); assert.deepEqual(f.hashes(), first);
  f.run('verify'); assert.equal(verifySite(f.site).releases.length, 1);
});

test('changed bytes get a new identity without a version bump, old pinned links survive update and rollback', t => {
  const f = fixture(t); f.run(); const old = f.current(), first = f.hashes();
  writeFileSync(join(f.root, 'editor.css'), readFileSync(join(f.root, 'editor.css'), 'utf8') + '\n/* candidate change */\n');
  f.run(); const next = f.current(); assert.notEqual(next, old);
  for (const [path, hash] of Object.entries(first)) if (path.startsWith('releases/')) assert.equal(sha256File(join(f.site, path)), hash);
  assert.equal(verifySite(f.site).releases.length, 2);
  const pinned = snapshots.toUrl({...snapshots.defaults(), audioMode: 'auto'}, 'starting', 'https://example.test/project/releases/' + old + '/editor.html');
  assert.equal(new URL(pinned).pathname, '/project/releases/' + old + '/index.html');
  f.run('select', ['--release', old]); assert.equal(f.current(), old);
  assert.equal(verifySite(f.site).releases.length, 2);
  f.run('select', ['--release', next]); assert.equal(f.current(), next);
});

test('compatibility aliases preserve scene queries and exact fragments at root and repository subpaths', () => {
  const id = 'v0.1.0-' + 'a'.repeat(64);
  for (const prefix of ['/', '/project/']) for (const page of HTML_PAGES) {
    const hash = '#preset=' + snapshots.encode(snapshots.defaults());
    const original = new URL(page + '?scene=brb&assets=offline' + hash, 'https://example.test' + prefix);
    let redirected;
    const location = {href: original.href, search: original.search, hash: original.hash, replace(value) { redirected = new URL(value); }};
    const blocks = extractInlineScripts(aliasHtml(id, page)); assert.equal(blocks.length, 1);
    vm.runInNewContext(blocks[0].code, {location, URL});
    assert.equal(redirected.pathname, prefix + 'releases/' + id + '/' + page);
    assert.equal(redirected.search, original.search); assert.equal(redirected.hash, hash);
  }
});

test('corrupted files, extra files and altered metadata cannot be verified or silently overwritten', t => {
  const f = fixture(t); f.run(); const id = f.current();
  const file = join(f.site, 'releases', id, 'editor.js'), bytes = readFileSync(file);
  writeFileSync(file, 'corrupt'); f.run('verify', [], false); f.run('build', [], false);
  assert.equal(readFileSync(file, 'utf8'), 'corrupt');
  writeFileSync(file, bytes);
  const extra = join(f.site, 'releases', id, 'unexpected.txt');
  writeFileSync(extra, 'unlisted'); f.run('verify', [], false); rmSync(extra);
  const metadata = join(f.site, 'releases', id, 'release-manifest.json'), original = readFileSync(metadata);
  writeFileSync(metadata, original.toString().replace('"previewOnly": true', '"previewOnly": false'));
  f.run('verify', [], false); writeFileSync(metadata, original); f.run('verify');
});

test('crafted self-consistent manifests cannot add payloads or omit mandatory license/notice files', t => {
  const f = fixture(t); f.run();
  const current = f.current(), source = join(f.site, 'releases', current);
  const originalBuild = JSON.parse(readFileSync(join(source, 'build-manifest.json'), 'utf8'));
  function craft(files, change) {
    const build = {...originalBuild, files}, text = json(build), hash = contentHash(text);
    const id = releaseId(build.version, hash), destination = join(f.site, 'releases', id);
    cpSync(source, destination, {recursive: true});
    change(destination);
    writeFileSync(join(destination, 'build-manifest.json'), text);
    writeFileSync(join(destination, 'release-manifest.json'), json({schemaVersion: 1, releaseId: id, version: build.version, buildManifestSha256: hash, previewOnly: true}));
    return {id, destination};
  }
  const payload = Buffer.from('synthetic-unapproved-payload');
  const cases = [
    {files: [...originalBuild.files, {path: 'unexpected.txt', bytes: payload.length, sha256: contentHash(payload)}],
      change: destination => writeFileSync(join(destination, 'unexpected.txt'), payload)},
    ...['LICENSE', 'ATTRIBUTIONS.md', 'docs/licenses/CinzelDecorative-OFL.txt', 'docs/licenses/CC-BY-4.0.txt'].map(path => ({
      files: originalBuild.files.filter(file => file.path !== path),
      change: destination => rmSync(join(destination, path))
    }))
  ];
  for (const sample of cases) {
    const crafted = craft(sample.files, sample.change);
    assert.throws(() => verifyRelease(f.site, crafted.id), /Invalid build file set/);
    f.run('verify', [], false); f.run('select', ['--release', crafted.id], false);
    assert.equal(f.current(), current);
    rmSync(crafted.destination, {recursive: true, force: true});
  }
  // File-set equality is deliberately independent of manifest entry ordering.
  const reordered = craft([...originalBuild.files].reverse(), () => {});
  assert.equal(verifyRelease(f.site, reordered.id).releaseId, reordered.id);
  f.run('verify'); assert.equal(f.current(), current);
});

test('input credential gate refuses publication and keeps previously selected candidate untouched', t => {
  const f = fixture(t); f.run(); const first = f.hashes();
  const config = join(f.root, 'config.js'), source = readFileSync(config, 'utf8');
  const changed = source.replace(/password:\s*""/, 'password: "synthetic-publish-secret"'); assert.notEqual(changed, source);
  writeFileSync(config, changed);
  const failure = f.run('build', [], false);
  assert.ok(!(failure.stdout + failure.stderr).includes('synthetic-publish-secret'));
  assert.deepEqual(f.hashes(), first);
});

test('unresolved rights fail closed and leave the previous candidate untouched', t => {
  const f = fixture(t); f.run(); const first = f.hashes();
  const path = join(f.root, 'docs/asset-inventory.json'), inventory = JSON.parse(readFileSync(path, 'utf8'));
  inventory.assets[0].status = 'unresolved'; inventory.counts.unresolved = 1; inventory.counts.verified--;
  inventory.releaseBlockers = [{path: inventory.assets[0].path}];
  writeFileSync(path, JSON.stringify(inventory));
  f.run('build', [], false); assert.deepEqual(f.hashes(), first);
});

test('output ownership, path traversal, malformed metadata and unknown arguments fail without echoing contents', t => {
  const f = fixture(t); f.run(); const first = f.hashes();
  for (const args of [['--release', '../outside'], ['--out', 'elsewhere'], ['--release', 'invalid']]) {
    f.run('select', args, false); assert.deepEqual(f.hashes(), first);
  }
  const pointer = join(f.site, 'current-release.json'), original = readFileSync(pointer);
  writeFileSync(pointer, '{"password":"synthetic-hidden-secret"');
  const failure = f.run('verify', [], false);
  assert.ok(!(failure.stdout + failure.stderr).includes('synthetic-hidden-secret'));
  writeFileSync(pointer, original);
  const other = join(f.site, 'do-not-delete.txt'); writeFileSync(other, 'owned by someone else');
  f.run('build', [], false); assert.equal(readFileSync(other, 'utf8'), 'owned by someone else');
});

test('symlinked deployment output is rejected without touching its destination', t => {
  const f = fixture(t), target = mkdtempSync(join(tmpdir(), 'obs3d-site-outside-'));
  t.after(() => rmSync(target, {recursive: true, force: true}));
  writeFileSync(join(target, 'keep.txt'), 'keep');
  try { symlinkSync(target, f.site, process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (['EPERM', 'EACCES'].includes(error.code)) { t.skip('symlink privileges unavailable'); return; } throw error; }
  f.run('build', [], false); assert.equal(readFileSync(join(target, 'keep.txt'), 'utf8'), 'keep');
});

test('HTTP repository-subpath serving resolves pinned scene HTML, scripts, styles and BRB module graph', async t => {
  const f = fixture(t); f.run(); const id = f.current(), prefix = '/project/';
  const server = createServer((req, res) => {
    const path = new URL(req.url, 'http://example.test').pathname;
    if (!path.startsWith(prefix)) { res.writeHead(404); res.end(); return; }
    let relative = decodeURIComponent(path.slice(prefix.length)) || 'index.html';
    if (relative.endsWith('/')) relative += 'index.html';
    const full = resolve(f.site, relative);
    if (!full.startsWith(resolve(f.site) + sep)) { res.writeHead(404); res.end(); return; }
    let bytes;
    try { bytes = readFileSync(full); } catch { res.writeHead(404); res.end(); return; }
    res.writeHead(200); res.end(bytes);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const base = 'http://127.0.0.1:' + server.address().port + prefix;
  for (const page of HTML_PAGES) {
    const alias = await fetch(new URL(page, base)); assert.equal(alias.status, 200);
    let target;
    const location = {href: new URL(page, base).href, search: '', hash: '', replace(value) { target = value; }};
    vm.runInNewContext(extractInlineScripts(await alias.text())[0].code, {location, URL});
    const response = await fetch(target); assert.equal(response.status, 200);
    assert.ok(target.includes('/releases/' + id + '/'));
    for (const ref of extractHtmlRefs(await response.text())) {
      if (/^(?:[a-z]+:|#|\/\/)/i.test(ref.value)) continue;
      const asset = new URL(ref.value, target);
      assert.equal((await fetch(asset)).status, 200, asset.href);
    }
  }
  for (const path of ['brb-blackhole/blackholeOverlay.module.js', 'vendor/three-0.181.0/build/three.module.js', 'vendor/three-0.181.0/build/three.core.js']) {
    assert.equal((await fetch(new URL('releases/' + id + '/' + path, base))).status, 200);
  }
  assert.equal((await fetch(new URL('releases/v0.1.0-' + '0'.repeat(64) + '/index.html', base))).status, 404);
});

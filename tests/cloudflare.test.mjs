import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { PACKAGE_FILES, repoRoot, sha256File } from '../scripts/lib.mjs';
import { tree, verifySite } from '../scripts/site-lib.mjs';
import { headerRules, headersFile, NOT_FOUND, verifyCloudflare } from '../scripts/cloudflare-lib.mjs';
import { auditCloudflare } from '../scripts/cloudflare-live.mjs';
const ROOT = repoRoot();
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'obs3d-cloudflare-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  for (const path of [...PACKAGE_FILES, 'package.json']) {
    mkdirSync(dirname(join(root, path)), {recursive: true}); copyFileSync(join(ROOT, path), join(root, path));
  }
  function run(command = 'build', ok = true) {
    const result = spawnSync(process.execPath, [join(ROOT, 'scripts/cloudflare.mjs'), command, '--root', root], {encoding: 'utf8'});
    if (ok) assert.equal(result.status, 0, result.stdout + result.stderr); else assert.notEqual(result.status, 0);
    return result;
  }
  const output = join(root, 'cf-dist'), site = join(root, 'site');
  const hashes = () => Object.fromEntries(tree(output).map(path => [path, sha256File(join(output, path))]));
  return {root, output, site, run, hashes};
}
function matchingHeaders(ids, path) {
  const headers = new Headers();
  for (const rule of headerRules(ids)) {
    if (rule.path.endsWith('*') ? path.startsWith(rule.path.slice(0, -1)) : path === rule.path) {
      for (const [key, value] of Object.entries(rule.headers)) headers.append(key, value);
    }
  }
  return headers;
}
function mockPages(f, {mutate = () => {}} = {}) {
  const verified = verifyCloudflare(f.output), requests = [];
  const mime = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.ttf': 'font/ttf'};
  async function fetchMock(value) {
    const url = new URL(value); requests.push(url.href);
    let path = url.pathname, status = 200, bytes;
    const headers = matchingHeaders(verified.releases, path);
    if (path.endsWith('/index.html')) { headers.set('location', path.slice(0, -'index.html'.length) + url.search); return new Response(null, {status: 308, headers}); }
    if (path.endsWith('.html')) { headers.set('location', path.slice(0, -5) + url.search); return new Response(null, {status: 308, headers}); }
    if (path.endsWith('/')) path += 'index.html';
    else if (!extname(path) && !existsSync(join(f.output, path.slice(1)))) path += '.html';
    try { bytes = readFileSync(join(f.output, path.slice(1))); } catch { status = 404; bytes = Buffer.from(NOT_FOUND); }
    headers.set('content-type', mime[extname(path)] || 'text/plain');
    // Canonical clean paths still match the verified namespace cache pattern.
    const matched = matchingHeaders(verified.releases, url.pathname);
    for (const [key, value] of matched) headers.set(key, value);
    if (['/', '/editor', '/brb', '/thanks', '/credits'].includes(url.pathname)) headers.set('cache-control', 'no-cache');
    if (!headers.has('cache-control')) headers.set('cache-control', 'public, max-age=0, must-revalidate');
    const result = {status, headers, bytes, path: url.pathname}; mutate(result);
    return new Response(result.bytes, {status: result.status, headers: result.headers});
  }
  return {fetchMock, requests};
}

test('Cloudflare preparation is deterministic, retains byte-identical namespaces and creates a sealed non-SPA output', t => {
  const f = fixture(t); f.run(); const site = verifySite(f.site), cf = verifyCloudflare(f.output);
  assert.deepEqual(cf, site);
  for (const path of tree(f.site)) assert.equal(sha256File(join(f.site, path)), sha256File(join(f.output, path)), path);
  assert.equal(readFileSync(join(f.output, '404.html'), 'utf8'), NOT_FOUND);
  assert.equal(readFileSync(join(f.output, '_headers'), 'utf8'), headersFile(cf.releases));
  const before = f.hashes(); f.run(); assert.deepEqual(f.hashes(), before); f.run('verify');
  assert.ok(!tree(f.output).includes('_worker.js')); assert.ok(!tree(f.output).some(path => path.startsWith('functions/')));
});

test('cache policy does not concatenate contradictory rules or negatively pin unknown future namespace IDs', () => {
  const id = 'v0.1.0-' + 'a'.repeat(64), future = 'v0.1.0-' + 'b'.repeat(64);
  const pinned = matchingHeaders([id], '/releases/' + id + '/index.html').get('cache-control');
  assert.equal(pinned, 'public, max-age=31536000, immutable');
  assert.equal(matchingHeaders([id], '/editor').get('cache-control'), 'no-cache');
  assert.equal(matchingHeaders([id], '/current-release.json').get('cache-control'), 'no-cache');
  assert.equal(matchingHeaders([id], '/releases/' + future + '/index.html').get('cache-control'), null);
  assert.equal(matchingHeaders([id], '/releases/' + id + '/runtime/audio.js').get('x-content-type-options'), 'nosniff');
  assert.throws(() => headerRules(Array.from({length: 100}, (_, i) => 'v0.1.0-' + i.toString(16).padStart(64, '0'))), /limit/);
});

test('Cloudflare output refuses tampering and source credential gate failure leaves prior candidate intact', t => {
  const f = fixture(t); f.run(); const before = f.hashes(), file = join(f.root, 'config.js');
  writeFileSync(file, readFileSync(file, 'utf8').replace(/password:\s*""/, 'password: "synthetic-cf-secret"'));
  const failure = f.run('build', false); assert.ok(!(failure.stdout + failure.stderr).includes('synthetic-cf-secret'));
  assert.deepEqual(f.hashes(), before);
  writeFileSync(join(f.output, '_headers'), '/*\n  Cache-Control: public, max-age=31536000, immutable\n');
  assert.throws(() => verifyCloudflare(f.output), /policy/); f.run('verify', false);
});

test('Cloudflare preparation refuses to drop previously prepared history when the source site is lost', t => {
  const f = fixture(t); f.run(); const old = verifyCloudflare(f.output).current;
  writeFileSync(join(f.root, 'editor.css'), readFileSync(join(f.root, 'editor.css'), 'utf8') + '\n/* changed */\n');
  f.run(); assert.equal(verifyCloudflare(f.output).releases.length, 2);
  const before = f.hashes(); rmSync(f.site, {recursive: true, force: true});
  f.run('build', false); assert.deepEqual(f.hashes(), before);
  assert.ok(verifyCloudflare(f.output).releases.includes(old));
});

test('read-only HTTP audit follows canonical clean URLs and checks complete retention, bytes, MIME, caching and 404 behavior', async t => {
  const f = fixture(t); f.run(); const mock = mockPages(f);
  const result = await auditCloudflare(f.output, 'https://example-test.pages.dev/', mock.fetchMock);
  assert.equal(result.releases, 1); assert.ok(result.checkedFiles > 50);
  assert.ok(mock.requests.some(url => url.includes('/editor?scene=brb&assets=offline')));
  assert.ok(mock.requests.every(url => url.startsWith('https://example-test.pages.dev/')));
});

test('HTTP audit refuses off-origin or cross-namespace redirects, lost queries and fragment overrides before following them', async t => {
  const f = fixture(t); f.run();
  for (const mode of ['origin', 'namespace', 'query', 'fragment']) {
    const mock = mockPages(f), seen = [];
    const fetchMock = async value => {
      const url = new URL(value); seen.push(url);
      if ((mode === 'origin' || mode === 'namespace') && url.pathname.startsWith('/releases/')) {
        return new Response(null, {status: 308, headers: {location: mode === 'origin' ? 'https://evil.test/index.html' : '/index.html'}});
      }
      if ((mode === 'query' || mode === 'fragment') && url.search) {
        return new Response(null, {status: 308, headers: {location: '/editor' + (mode === 'fragment' ? url.search + '#overridden' : '')}});
      }
      return mock.fetchMock(value);
    };
    await assert.rejects(() => auditCloudflare(f.output, 'https://example-test.pages.dev/', fetchMock), /Redirect/);
    assert.ok(seen.every(url => url.origin === 'https://example-test.pages.dev'));
  }
});

test('HTTP audit rejects SPA fallbacks, broken MIME/cache, transformed content and credential-bearing targets', async t => {
  const f = fixture(t); f.run();
  for (const mutate of [
    result => { if (result.status === 404) result.status = 200; },
    result => { if (result.path.endsWith('.js')) result.headers.set('content-type', 'text/plain'); },
    result => { result.headers.set('cache-control', 'public, max-age=31536000, immutable'); },
    result => { if (result.path.endsWith('.css')) result.bytes = Buffer.from('changed'); },
    result => { if (result.status === 404 && result.path.includes('v0.0.0-')) result.headers.set('cache-control', 'public, max-age=86400'); }
  ]) {
    const mock = mockPages(f, {mutate});
    await assert.rejects(() => auditCloudflare(f.output, 'https://example-test.pages.dev/', mock.fetchMock));
  }
  let count = 0;
  for (const url of ['http://example-test.pages.dev/', 'https://evil.test/', 'https://user:secret@example-test.pages.dev/', 'https://example-test.pages.dev/?token=secret']) {
    await assert.rejects(() => auditCloudflare(f.output, url, () => { count++; throw Error('must not fetch'); }));
  }
  assert.equal(count, 0);
});

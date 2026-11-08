// Read-only public Pages audit. No API token/account credentials are accepted.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { contentHash } from './site-lib.mjs';
import { repoRoot } from './lib.mjs';
import { MAX_BYTES, verifyCloudflare } from './cloudflare-lib.mjs';
export async function auditCloudflare(output, base, fetchImpl = fetch) {
  const verified = verifyCloudflare(output), origin = new URL(base);
  if (origin.protocol !== 'https:' || !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.pages\.dev$/.test(origin.hostname) || origin.username || origin.password || origin.port || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('Use a root HTTPS pages.dev URL without credentials');
  const manifest = JSON.parse(readFileSync(join(output, 'cloudflare-manifest.json'), 'utf8'));
  async function request(path, search = '') {
    let url = new URL(path, origin); url.search = search;
    const originalSearch = url.search;
    const namespace = url.pathname.startsWith('/releases/') ? url.pathname.split('/').slice(0, 3).join('/') + '/' : null;
    for (let redirect = 0; redirect <= 5; redirect++) {
      const response = await fetchImpl(url.href, {redirect: 'manual', headers: {'Cache-Control': 'no-cache'}, signal: AbortSignal.timeout(15000)});
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location || location.includes('#')) throw new Error('Redirect cannot override preset fragments');
        const next = new URL(location, url);
        if (next.origin !== origin.origin || next.username || next.password || next.search !== originalSearch || (namespace && !next.pathname.startsWith(namespace))) throw new Error('Redirect lost origin, namespace or query');
        url = next; continue;
      }
      if (Number(response.headers.get('content-length')) > MAX_BYTES) { await response.body?.cancel(); throw new Error('Response too large'); }
      const reader = response.body?.getReader(), chunks = []; let length = 0;
      try {
        if (reader) while (true) {
          const part = await reader.read(); if (part.done) break;
          length += part.value.length; if (length > MAX_BYTES) throw new Error('Response too large');
          chunks.push(Buffer.from(part.value));
        }
      } finally { if (reader) { await reader.cancel(); reader.releaseLock(); } }
      return {status: response.status, headers: response.headers, bytes: Buffer.concat(chunks), url};
    }
    throw new Error('Too many canonical redirects');
  }
  function cache(response, immutable) {
    const value = response.headers.get('cache-control') || '';
    if (immutable ? !/\bimmutable\b/i.test(value) || !/max-age=31536000\b/i.test(value) : /\bimmutable\b/i.test(value) || !/\bno-cache\b/i.test(value)) throw new Error('Unexpected cache policy');
    if (response.headers.get('referrer-policy') !== 'no-referrer') throw new Error('Missing referrer safety header');
    if (response.headers.get('x-content-type-options') !== 'nosniff') throw new Error('Missing MIME safety header');
  }
  const mime = {'.js': 'javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.ttf': 'font/', '.jpg': 'image/jpeg', '.png': 'image/png'};
  let checked = 0;
  // Pages consumes _headers; 404 and .nojekyll are host control files, audited
  // through response behavior instead of pretending they are ordinary assets.
  for (const file of manifest.files.filter(file => !['_headers', '404.html', '.nojekyll'].includes(file.path))) {
    const result = await request('/' + file.path);
    if (result.status !== 200 || result.bytes.length !== file.bytes || contentHash(result.bytes) !== file.sha256) throw new Error('Deployed bytes differ from prepared candidate');
    cache(result, file.path.startsWith('releases/'));
    const type = Object.entries(mime).find(([extension]) => file.path.endsWith(extension))?.[1];
    if (type && !(result.headers.get('content-type') || '').toLowerCase().includes(type)) throw new Error('Unexpected MIME type');
    checked++;
  }
  const manifestResponse = await request('/cloudflare-manifest.json');
  if (manifestResponse.status !== 200 || !manifestResponse.bytes.equals(readFileSync(join(output, 'cloudflare-manifest.json')))) throw new Error('Deployed manifest differs');
  cache(manifestResponse, false);
  for (const page of ['editor.html', 'index.html']) {
    const expected = manifest.files.find(file => file.path === page);
    const result = await request('/' + page, '?scene=brb&assets=offline');
    if (result.status !== 200 || contentHash(result.bytes) !== expected.sha256) throw new Error('Canonical entrypoint/query audit failed');
  }
  const unknown = 'v0.0.0-' + '0'.repeat(64);
  if (verified.releases.includes(unknown)) throw new Error('Reserved unknown-release probe is occupied');
  for (const path of ['/releases/' + unknown + '/index.html', '/releases/' + verified.current + '/__missing_asset__.js']) {
    const result = await request(path);
    if (result.status !== 404) throw new Error('Missing pinned asset must be 404, never SPA/current-release fallback');
    if (path.includes(unknown)) {
      const policy = result.headers.get('cache-control') || '';
      if (/\bimmutable\b/i.test(policy) || !/(?:\bno-cache\b|\bno-store\b|\bmax-age=0\b)/i.test(policy) || /\bmax-age=[1-9]\d*/i.test(policy)) throw new Error('Unknown future namespaces must revalidate, not acquire positive browser cache lifetimes');
    }
  }
  return {current: verified.current, releases: verified.releases.length, checkedFiles: checked + 1};
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2), options = {};
    while (args.length) {
      const key = args.shift(), value = args.shift();
      if (!['--url', '--root'].includes(key) || !value || options[key] !== undefined) throw new Error('Invalid audit arguments');
      options[key] = value;
    }
    const result = await auditCloudflare(join(options['--root'] ? resolve(options['--root']) : repoRoot(), 'cf-dist'), options['--url']);
    console.log(`cloudflare live: ${result.checkedFiles} file(s), ${result.releases} retained release(s); integrity/cache/MIME/redirect/404 checks passed`);
    console.log('READ-ONLY HTTP AUDIT: not browser/OBS/GPU or deployment authorization.');
  } catch {
    console.error('cloudflare live FAIL: check the public Pages URL, prepared candidate/history and deployed bytes/headers/redirects/404 behavior. Details withheld.');
    process.exitCode = 1;
  }
}

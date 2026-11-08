// Cloudflare Pages output policy. No credentials, network access or publishing.
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { assertNotSymlink, assertRegularFile, HTML_PAGES, sha256File } from './lib.mjs';
import { json, ROOT_FILES, tree, validId, verifySiteContents } from './site-lib.mjs';
export const CF_ROOT_FILES = [...ROOT_FILES, '_headers', '404.html', 'cloudflare-manifest.json'].sort();
export const MAX_FILES = 20000;
export const MAX_BYTES = 25 * 1024 * 1024;
export const NOT_FOUND = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Scene release not found</title></head><body><h1>Scene release not found</h1><p>This pinned release or file is unavailable. It was not replaced with a different scene.</p><p><a href="/editor">Open the current editor</a></p></body></html>\n';
export function headerRules(ids) {
  if (!Array.isArray(ids) || new Set(ids).size !== ids.length || ids.some(id => !validId(id))) throw new Error('Invalid release IDs for headers');
  const mutable = new Set(['/', '/current-release.json', '/cloudflare-manifest.json', '/404.html']);
  for (const page of HTML_PAGES) { mutable.add('/' + page); mutable.add('/' + page.replace(/\.html$/, '')); }
  const rules = [
    {path: '/*', headers: {'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer'}},
    ...[...mutable].sort().map(path => ({path, headers: {'Cache-Control': 'no-cache'}})),
    // Scope immutable caching to existing sealed namespaces, NOT /releases/*.
    // An unknown future ID must not acquire a year-long negative browser cache.
    ...[...ids].sort().map(id => ({path: '/releases/' + id + '/*', headers: {'Cache-Control': 'public, max-age=31536000, immutable'}}))
  ];
  if (rules.length > 100) throw new Error('Cloudflare Pages header rule limit exceeded; do not drop old namespaces automatically');
  return rules;
}
export function headersFile(ids) {
  const text = headerRules(ids).map(rule => rule.path + '\n' + Object.entries(rule.headers).map(([key, value]) => '  ' + key + ': ' + value).join('\n')).join('\n\n') + '\n';
  if (text.split('\n').some(line => line.length > 2000)) throw new Error('Cloudflare Pages header line limit exceeded');
  return text;
}
export function preflightCloudflare(output) {
  assertNotSymlink(output);
  if (!lstatSync(output).isDirectory()) throw new Error('Cloudflare output must be a directory');
  const entries = readdirSync(output).sort();
  if (JSON.stringify(entries) !== JSON.stringify([...CF_ROOT_FILES, 'releases'].sort())) throw new Error('Unexpected or missing Cloudflare root entry');
  for (const file of CF_ROOT_FILES) assertRegularFile(output, file);
  assertNotSymlink(join(output, 'releases'));
}
export function cloudflareManifest(output, verified) {
  const paths = tree(output).filter(path => path !== 'cloudflare-manifest.json');
  if (paths.length + 1 > MAX_FILES) throw new Error('Cloudflare Pages free-plan file count exceeded');
  const files = paths.map(path => {
    assertRegularFile(output, path);
    const bytes = readFileSync(join(output, path)).length;
    if (bytes > MAX_BYTES) throw new Error('Cloudflare Pages single-file size limit exceeded');
    return {path, bytes, sha256: sha256File(join(output, path))};
  });
  return {schemaVersion: 1, target: 'cloudflare-pages', previewOnly: true, currentRelease: verified.current, retainedReleases: verified.releases, files};
}
export function verifyCloudflare(output) {
  preflightCloudflare(output);
  const verified = verifySiteContents(output);
  if (readFileSync(join(output, '_headers'), 'utf8') !== headersFile(verified.releases)) throw new Error('Cloudflare cache/security headers differ from approved policy');
  if (readFileSync(join(output, '404.html'), 'utf8') !== NOT_FOUND) throw new Error('Cloudflare must have the explicit non-SPA 404 document');
  const manifest = json(cloudflareManifest(output, verified));
  if (Buffer.byteLength(manifest) > MAX_BYTES || readFileSync(join(output, 'cloudflare-manifest.json'), 'utf8') !== manifest) throw new Error('Cloudflare deployment manifest integrity failed');
  return verified;
}

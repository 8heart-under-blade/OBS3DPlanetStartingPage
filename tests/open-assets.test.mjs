import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { restoreIntegration } from './helpers/restore-integration.mjs';
import { repoRoot, RUNTIME_FILES, NOTICE_FILES, sha256File } from '../scripts/lib.mjs';
const root = repoRoot();
const read = p => readFileSync(join(root, p), 'utf8');
const window = {};
vm.runInNewContext(read('config.js'), {window});
const config = window.STREAM_CONFIG;

test('font and texture defaults resolve to packaged, openly licensed local files', () => {
  const inv = JSON.parse(read('docs/asset-inventory.json'));
  const local = [
    ...config.overlay.customFontFaces, ...config.overlayThanks.customFontFaces,
  ].map(f => f.src.replace(/^@/, ''));
  for (const key of ['earthDayMapUrl', 'earthNightMapUrl', 'earthCloudMapUrl', 'earthWaterMaskUrl', 'moonMapUrl']) {
    local.push(config.thanksScene[key]);
  }
  for (const path of local) {
    assert.ok(RUNTIME_FILES.includes(path), path);
    const asset = inv.assets.find(a => a.path === path);
    assert.equal(asset?.status, 'verified', path);
    assert.ok(['OFL-1.1', 'CC-BY-4.0'].includes(asset.license));
    for (const notice of asset.licenseFiles) assert.ok(NOTICE_FILES.includes(notice), notice);
  }
  for (const path of ['oracles.woff', 'twigs.woff', 'textures/planets/earth_clouds_1024.png',
    'textures/planets/earth_night_2048.png', 'textures/planets/earth_specular_2048.jpg',
    'textures/planets/moon_1024.jpg']) {
    assert.ok(!RUNTIME_FILES.includes(path));
    assert.equal(existsSync(join(root, path)), false, path);
  }
  assert.doesNotMatch(read('thanks.js'), /threejs\.org\/examples\/textures/);
});

test('Thanks view retains visible credit, license link, and conversion disclosure', () => {
  const html = read('thanks.html');
  assert.match(html, /<footer class="asset-credit">/);
  assert.match(html, /https:\/\/www\.solarsystemscope\.com\/textures\//);
  assert.match(html, /https:\/\/creativecommons\.org\/licenses\/by\/4\.0\//);
  assert.match(html, /specular map converted/);
  assert.match(html, /href="credits.html"/);
  assert.match(read('credits.html'), /TIFF to PNG/);
});

test('current onboarding examples use shipped font files and preserve readable copyright', () => {
  assert.doesNotMatch(read('README.md'), /@(?:oracles|twigs)\.woff/);
  assert.ok(read('README.md').includes('@cinzel-decorative.ttf'));
  assert.ok(read('README.md').includes('@macondo.ttf'));
  assert.match(read('TY4Watching.md'), /Historical implementation plan/);
  assert.ok(read('ATTRIBUTIONS.md').includes('Copyright (c) 1997 - 2011, John Vargas Beltran'));
  assert.equal(sha256File(join(root, 'docs/licenses/Macondo-OFL.txt')),
    '0d75673e4c98de3e11337dbd90b05d0232edfcade5c1c02fbc0118c85aea25da');
});

test('unchanged P0 runtime files retain their original source bytes', () => {
  const old = JSON.parse(read('docs/source-baseline-p0.json'));
  const intentionalChanges = new Set([
    'config.js', 'thanks.js', 'thanks.html', 'thanks.css', 'oracles.woff', 'twigs.woff',
    'index.html', 'brb.html', 'main.js', 'brb.js', // P1 boot/overlay extraction; renderer-preservation tests constrain changes.
    'textures/planets/earth_clouds_1024.png', 'textures/planets/earth_day_2048.jpg',
    'textures/planets/earth_night_2048.png', 'textures/planets/earth_specular_2048.jpg',
    'textures/planets/moon_1024.jpg',
  ]);
  for (const file of old.files) {
    if (file.path === 'brb-blackhole/blackholeOverlay.module.js') {
      assert.equal(createHash('sha256').update(restoreIntegration(read(file.path), file.path)).digest('hex'), file.sha256, file.path);
    } else if (!intentionalChanges.has(file.path)) assert.equal(sha256File(join(root, file.path)), file.sha256, file.path);
  }
});

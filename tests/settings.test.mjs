import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { repoRoot } from '../scripts/lib.mjs';
const require = createRequire(import.meta.url);
const createSettings = require('../runtime/settings.js');
const settings = createSettings();
const window = {};
vm.runInNewContext(readFileSync(join(repoRoot(), 'config.js'), 'utf8'), {window});
const tuned = JSON.parse(JSON.stringify(window.STREAM_CONFIG));
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }

test('current tuned config remains equivalent, independent and warning-free', () => {
  const source = freeze(structuredClone(tuned));
  const result = settings.resolve(source, '');
  assert.deepEqual(result.config, tuned);
  assert.notEqual(result.config, source);
  assert.notEqual(result.config.audioReactive, source.audioReactive);
  assert.notEqual(result.config.audioReactive.targetInputs, source.audioReactive.targetInputs);
  assert.equal(result.quality, 'tuned');
  assert.deepEqual(result.warnings, []);
});

test('quality query takes precedence, keeps unrelated URL data and rejects unknown names safely', () => {
  assert.equal(settings.resolve({quality: 'low'}, '').quality, 'low');
  assert.equal(settings.resolve({quality: 'low'}, '?quality=HIGH&scene=brb').quality, 'high');
  assert.equal(settings.resolve({quality: 'medium'}, '?quality=').quality, 'medium');
  for (const quality of ['constructor', '__proto__', 'toString', 'invalid']) {
    const result = settings.resolve({quality: 'low'}, '?quality=' + quality);
    assert.equal(result.quality, 'tuned');
    assert.deepEqual(result.warnings, ['invalid-quality']);
  }
});

test('invalid section and numeric types fall back without mutating source', () => {
  const source = {assets: [], overlay: 7, audioReactive: {gain: NaN, attack: 0, release: 0, enabled: 'false',
    password: 42, targetInputs: [null], reconnectBaseMs: Infinity}, thanksScene: {earthRadius: Infinity, moonRadius: '2', cloudOpacity: 0}};
  const result = settings.resolve(source, '');
  assert.equal(result.config.assets, undefined);
  assert.equal(result.config.overlay, undefined);
  assert.equal(result.config.audioReactive.gain, undefined);
  assert.equal(result.config.audioReactive.attack, 0);
  assert.equal(result.config.audioReactive.release, 0);
  assert.equal(result.config.thanksScene.cloudOpacity, 0);
  assert.equal(result.config.thanksScene.moonRadius, undefined);
  assert.equal(source.audioReactive.password, 42);
  assert.ok(Number.isNaN(source.audioReactive.gain));
});

test('validation diagnostics contain fixed codes only, never credentials or URLs', () => {
  const result = settings.resolve({assets: {localThree: 'javascript:synthetic-secret'},
    audioReactive: {url: 'ws://user:synthetic-secret@example.test:4455', password: 'synthetic-secret', gain: 'synthetic-secret'}}, '');
  assert.equal(result.config.audioReactive.password, 'synthetic-secret', 'runtime credential is not exported or logged');
  assert.equal(result.config.audioReactive.url, undefined);
  assert.equal(result.config.assets.localThree, undefined);
  assert.ok(!JSON.stringify(result.warnings).includes('synthetic-secret'));
  assert.ok(!JSON.stringify(result.warnings).includes('example.test'));
});

test('known runtime URLs allow local/http assets and ws/wss audio, but reject unsafe schemes', () => {
  for (const url of ['vendor/three.js', 'https://example.test/three.js', 'http://127.0.0.1/three.js']) {
    assert.equal(settings.resolve({assets: {localThree: url}}, '').config.assets.localThree, url);
  }
  for (const url of ['data:text/javascript,alert(1)', 'javascript:alert(1)', '//example.test/script.js']) {
    assert.equal(settings.resolve({assets: {localThree: url}}, '').config.assets.localThree, undefined);
  }
  for (const url of ['ws://127.0.0.1:4455', 'wss://example.test:4455']) {
    assert.equal(settings.resolve({audioReactive: {url}}, '').config.audioReactive.url, url);
  }
  assert.equal(settings.resolve({audioReactive: {provider: 'unsupported'}}, '').config.audioReactive.provider, 'unsupported');
});

test('own-property copying excludes pollution names and preserves unknown trusted fields', () => {
  const source = JSON.parse('{"__proto__":{"polluted":true},"constructor":"bad","assets":{"__proto__":{"polluted":true},"mode":"auto"},"custom":{"future":1}}');
  const result = settings.resolve(source, '');
  assert.equal(Object.hasOwn(result.config, '__proto__'), false);
  assert.equal(Object.hasOwn(result.config, 'constructor'), false);
  assert.equal(Object.hasOwn(result.config.assets, '__proto__'), false);
  assert.equal({}.polluted, undefined);
  assert.deepEqual(result.config.custom, {future: 1});
  assert.deepEqual(settings.resolve(null, '').warnings, ['invalid-config']);
});

test('tuned quality leaves all fields untouched, even on a frozen renderer config', () => {
  const scene = freeze({renderer: {maxPixelRatio: 1.6}, fabric: {segments: 172}, stars: {count: 3800}, camera: {radius: 106}});
  assert.equal(settings.applyQuality(scene, 'tuned'), scene);
  assert.equal(settings.limit('stars', 3800, 'tuned'), 3800);
});

test('profiles cap only declared quality fields and never raise tuned settings', () => {
  for (const [quality, ratio, segments, stars] of [['low', 1, 80, 1900], ['medium', 1.3, 120, 2850], ['high', 1.6, 172, 3800]]) {
    const scene = {renderer: {maxPixelRatio: 1.6, exposure: 1.08}, fabric: {segments: 172, size: 240},
      blackHole: {warpSegments: 176, coreRadius: 6.2}, stars: {count: 3800, mobileCount: 2500}, camera: {radius: 106}};
    assert.equal(settings.applyQuality(scene, quality), scene);
    assert.equal(scene.renderer.maxPixelRatio, ratio);
    assert.equal(scene.fabric.segments, segments);
    assert.equal(scene.stars.count, stars);
    assert.equal(scene.renderer.exposure, 1.08); assert.equal(scene.fabric.size, 240);
    assert.equal(scene.blackHole.coreRadius, 6.2); assert.equal(scene.camera.radius, 106);
    assert.ok(settings.limit('stars', 800, quality) <= 800);
    assert.equal(settings.limit('pixelRatio', 0.75, quality), 0.75);
  }
  assert.equal(settings.limit('stars', 0, 'low'), 0);
  assert.equal(settings.limit('unknown', 8, 'low'), 8);
});

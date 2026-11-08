import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { repoRoot, RUNTIME_FILES, sha256File } from '../scripts/lib.mjs';
import { createHash } from 'node:crypto';
import { restoreIntegration } from './helpers/restore-integration.mjs';

const require = createRequire(import.meta.url);
const createBoot = require('../runtime/boot.js');
const createSettings = require('../runtime/settings.js');
const snapshots = require('../runtime/snapshots.js')();
const root = repoRoot();
const read = file => readFileSync(join(root, file), 'utf8');
const local = 'vendor/three.min.js';
const cdn = 'https://unpkg.com/three@0.160.1/build/three.min.js';

function fixture({config = {}, search = '', fail = [], layer = true, errorElement = true, overlayRuntime = true, importer} = {}) {
  const requests = [], errors = [], events = [], snapshots = [];
  const error = {hidden: true, textContent: 'Scene bootstrap could not load.'};
  const win = {STREAM_CONFIG: config, location: {search, pathname: '/', hash: '', replace() { throw Error('Unexpected redirect'); }}, console: {error: e => errors.push(e)}};
  win.StreamAudio = {createController() {}};
  win.StreamAudioSession = {bind(controller) { return controller; }};
  win.StreamSnapshots = {fromHash() { return null; }, apply(_snapshot, config) { return config; }};
  win.StreamSettings = {resolve: config => ({config, quality: 'tuned', warnings: []}), applyQuality() {}, limit(_kind, value) { return value; }};
  win.StreamRecovery = {createScope() {}, observeRenderer() {}, disposeScene() {}, report() {}, createLoadingManager() {}};
  if (overlayRuntime) win.StreamOverlay = {applyTypography() {}, startClock() {}};
  const doc = {
    currentScript: {getAttribute: () => 'starting'},
    createElement: () => ({}),
    getElementById: id => id === 'bootError' ? (errorElement ? error : null) : id === 'blackholeLayer' && layer ? {} : null,
    head: {appendChild(script) {
      requests.push(script.src);
      snapshots.push({source: script.src, resolved: win.STREAM_ASSET_RESOLVED_MODE});
      queueMicrotask(() => {
        events.push('script:' + script.src);
        if (fail.includes(script.src)) script.onerror(); else script.onload();
        assert.equal(script.onload, null);
        assert.equal(script.onerror, null);
      });
    }},
  };
  const api = createBoot(win, doc, async () => {
    events.push('import');
    return importer ? importer() : {mountBlackholeOverlay: async () => { events.push('mount'); }};
  });
  return {api, win, doc, requests, errors, error, events, snapshots};
}

test('asset mode precedence, invalid candidates and configured sources retain original behavior', async () => {
  const cases = [
    [{assets: {mode: 'offline'}}, '', 'offline'],
    [{assets: {mode: 'offline'}}, '?assets=CDN', 'cdn'],
    [{assets: {mode: 'cdn'}}, '?assets=', 'cdn'],
    [{assets: {mode: 'offline'}}, '?assets=invalid', 'auto'],
    [{assets: {mode: 'CDN'}}, '', 'cdn'],
    [{assets: {mode: 'invalid'}}, '', 'auto'],
    [{assets: {mode: 'offline'}}, '?assets=%20offline%20', 'auto'],
    [null, '', 'auto'],
    [{assets: null}, '', 'auto'],
    ['invalid config', '', 'auto'],
  ];
  for (const [config, search, mode] of cases) {
    const f = fixture({config, search});
    const result = await f.api.start('starting');
    assert.equal(result.status, 'ready');
    assert.equal(f.win.STREAM_ASSET_MODE, mode);
    assert.deepEqual(f.requests, [mode === 'cdn' ? cdn : local, 'main.js']);
    assert.deepEqual(f.win.STREAM_ASSET_SOURCES, {localThree: local, cdnThree: cdn});
  }
  const custom = fixture({config: {assets: {localThree: 'custom/three.js', cdnThree: 'https://example.test/three.js'}}, fail: ['custom/three.js']});
  assert.equal((await custom.api.start('thanks')).mode, 'cdn');
  assert.deepEqual(custom.requests, ['custom/three.js', 'https://example.test/three.js', 'thanks.js']);
});

test('auto falls back from failed local Three to CDN before loading the renderer', async () => {
  const f = fixture({fail: [local]});
  assert.equal((await f.api.start('thanks')).status, 'ready');
  assert.deepEqual(f.requests, [local, cdn, 'thanks.js']);
  assert.equal(f.win.STREAM_ASSET_MODE, 'auto');
  assert.equal(f.win.STREAM_ASSET_RESOLVED_MODE, 'cdn');
  assert.equal(f.snapshots.at(-1).resolved, 'cdn');
  assert.equal(f.errors.length, 0);
  assert.equal(f.error.hidden, true);
});

test('offline and CDN modes never fall back to the other source', async () => {
  for (const mode of ['offline', 'cdn']) {
    const source = mode === 'offline' ? local : cdn;
    const f = fixture({search: '?assets=' + mode, fail: [source]});
    assert.equal((await f.api.start('thanks')).status, 'failed');
    assert.deepEqual(f.requests, [source]);
    assert.equal(f.win.STREAM_ASSET_RESOLVED_MODE, undefined);
    assert.equal(f.errors.length, 1);
    assert.equal(f.error.hidden, false);
    assert.match(f.error.textContent, mode === 'offline' ? /next to thanks.html/ : /Could not load rendering assets/);
  }
});

test('exhausted auto fallback and renderer failures stop boot and show an error', async () => {
  const both = fixture({fail: [local, cdn]});
  assert.equal((await both.api.start('starting')).status, 'failed');
  assert.deepEqual(both.requests, [local, cdn]);
  assert.equal(both.error.hidden, false);
  const renderer = fixture({fail: ['brb.js']});
  assert.equal((await renderer.api.start('brb')).status, 'failed');
  assert.deepEqual(renderer.requests, [local, 'brb.js']);
  assert.equal(renderer.win.STREAM_ASSET_RESOLVED_MODE, 'offline');
  assert.ok(!renderer.events.includes('import'));
});

test('missing or incomplete shared overlay API fails visibly before starting a renderer', async () => {
  for (const api of [undefined, {}, {applyTypography() {}}, {startClock() {}}]) {
    const f = fixture({overlayRuntime: false});
    f.win.StreamOverlay = api;
    assert.equal((await f.api.start('starting')).status, 'failed');
    assert.deepEqual(f.requests, []);
    assert.equal(f.error.hidden, false);
    assert.match(f.error.textContent, /Shared overlay helpers could not load/);
    assert.equal(f.errors.length, 1);
  }
});

test('missing shared audio API fails visibly before renderer initialization', async () => {
  for (const api of [undefined, {}, {createController: 'invalid'}]) {
    const f = fixture();
    f.win.StreamAudio = api;
    assert.equal((await f.api.start('starting')).status, 'failed');
    assert.deepEqual(f.requests, []);
    assert.equal(f.error.hidden, false);
    assert.match(f.error.textContent, /Shared audio helpers could not load/);
    assert.equal(f.errors.length, 1);
  }
});

test('missing session audio helpers fail visibly before loading any renderer', async () => {
  for (const api of [undefined, {}, {bind: 'invalid'}]) {
    const f = fixture(); f.win.StreamAudioSession = api;
    assert.equal((await f.api.start('starting')).status, 'failed');
    assert.deepEqual(f.requests, []); assert.equal(f.error.hidden, false);
    assert.match(f.error.textContent, /runtime\/audio-session\.js/);
  }
});

test('settings and recovery helpers are required before any renderer is loaded', async () => {
  for (const key of ['StreamSettings', 'StreamRecovery']) {
    const f = fixture(); f.win[key] = {};
    assert.equal((await f.api.start('starting')).status, 'failed');
    assert.deepEqual(f.requests, []);
    assert.equal(f.error.hidden, false);
    assert.match(f.error.textContent, key === 'StreamSettings' ? /Settings helpers/ : /Recovery helpers/);
  }
});

test('bootstrap publishes validated config and opt-in quality without mutating source config', async () => {
  const config = {quality: 'high', assets: {mode: 'offline'}, audioReactive: {password: '', gain: 3.5}};
  const before = structuredClone(config);
  const f = fixture({config, search: '?quality=low&assets=offline'});
  f.win.StreamSettings = createSettings();
  assert.equal((await f.api.start('thanks')).status, 'ready');
  assert.equal(f.win.STREAM_QUALITY, 'low');
  assert.deepEqual(f.win.STREAM_CONFIG_WARNINGS, []);
  assert.notEqual(f.win.STREAM_RUNTIME_CONFIG, config);
  assert.deepEqual(config, before);
});

test('asset timeout fails closed without competing CDN fallback or late scene initialization', async () => {
  const f = fixture(), timers = new Map(), scripts = [];
  let id = 0;
  f.win.setTimeout = (fn, ms) => { assert.equal(ms, 15000); timers.set(++id, fn); return id; };
  f.win.clearTimeout = key => timers.delete(key);
  f.doc.head.appendChild = script => { scripts.push(script); f.requests.push(script.src); };
  const pending = f.api.start('starting');
  const lateLoad = scripts[0].onload;
  [...timers.values()][0]();
  assert.equal((await pending).status, 'failed');
  lateLoad();
  assert.deepEqual(f.requests, [local]);
  assert.equal(timers.size, 0);
  assert.match(f.error.textContent, /too long to load/);
});

test('successful script loads clear every load timeout', async () => {
  const f = fixture(), timers = new Map(); let id = 0;
  f.win.setTimeout = fn => { timers.set(++id, fn); return id; };
  f.win.clearTimeout = key => timers.delete(key);
  assert.equal((await f.api.start('starting')).status, 'ready');
  assert.equal(timers.size, 0);
});

test('failed scene initialization never mounts the optional BRB renderer', async () => {
  const f = fixture();
  f.win.StreamRuntime = {isDisposed: () => true};
  assert.equal((await f.api.start('brb')).status, 'failed');
  assert.ok(!f.events.includes('import'));
});

test('snapshot URLs transfer nonsecret settings and disable audio without relying on editor storage', async () => {
  const preset = snapshots.defaults(); preset.quality = 'low'; preset.reducedMotion = true;
  preset.scenes.starting.title = 'Custom Unicode 星空 😀';
  const config = {audioReactive: {enabled: true, password: 'synthetic-secret'}, overlay: {title: 'Legacy'}};
  const f = fixture({config}); f.win.StreamSnapshots = snapshots; f.win.StreamSettings = createSettings();
  f.win.location.hash = '#preset=' + snapshots.encode(preset);
  const attributes = {};
  f.doc.documentElement = {setAttribute(key, value) { attributes[key] = value; }};
  assert.equal((await f.api.start('starting')).status, 'ready');
  assert.equal(f.win.STREAM_RUNTIME_CONFIG.overlay.title, preset.scenes.starting.title);
  assert.equal(f.win.STREAM_OVERLAY.title, preset.scenes.starting.title);
  assert.equal(f.win.STREAM_RUNTIME_CONFIG.audioReactive.enabled, false);
  assert.equal(f.win.STREAM_RUNTIME_CONFIG.audioReactive.password, '');
  assert.equal(f.win.STREAM_QUALITY, 'low'); assert.equal(attributes['data-reduced-motion'], 'true');
  assert.equal(config.audioReactive.password, 'synthetic-secret');
});

test('malformed or unavailable snapshot helpers fail closed before any asset or audio initialization', async () => {
  for (const hash of ['#preset=invalid', '#preset=', '#x=1&preset=invalid']) {
    const f = fixture(); f.win.StreamSnapshots = snapshots; f.win.location.hash = hash;
    assert.equal((await f.api.start('starting')).status, 'failed');
    assert.deepEqual(f.requests, []);
    assert.match(f.error.textContent, /Preset settings could not be loaded/);
    assert.ok(!f.error.textContent.includes(hash));
  }
  const f = fixture(); delete f.win.StreamSnapshots;
  assert.equal((await f.api.start('starting')).status, 'failed');
  assert.deepEqual(f.requests, []);
});

test('legacy scene URLs preserve their original local audio behavior', async () => {
  const config = {audioReactive: {enabled: true, password: ''}, overlay: {title: 'Legacy'}};
  const f = fixture({config}); f.win.StreamSnapshots = snapshots; f.win.StreamSettings = createSettings();
  f.win.location.hash = '#old-anchor';
  assert.equal((await f.api.start('starting')).status, 'ready');
  assert.equal(f.win.STREAM_RUNTIME_CONFIG.audioReactive.enabled, true);
  assert.equal(f.win.STREAM_RUNTIME_CONFIG.overlay.title, 'Legacy');
  assert.equal(f.win.STREAM_REDUCED_MOTION, false);
});

test('BRB imports and mounts its overlay only after its scene script completes', async () => {
  const f = fixture({search: '?assets=offline'});
  const promise = f.api.start('brb');
  assert.equal(f.api.start('brb'), promise);
  assert.equal((await promise).status, 'ready');
  assert.deepEqual(f.events, ['script:' + local, 'script:brb.js', 'import', 'mount']);
  assert.equal(f.snapshots.at(-1).resolved, 'offline');
  assert.equal(f.api.start('brb'), promise);
});

test('disabled BRB replacement or missing layer never imports optional ESM dependencies', async () => {
  for (const options of [{config: {brbBlackholeReplacement: {enabled: false}}}, {layer: false}]) {
    const f = fixture(options);
    assert.equal((await f.api.start('brb')).status, 'ready');
    assert.deepEqual(f.requests, [local, 'brb.js']);
    assert.ok(!f.events.includes('import'));
  }
  // Only explicit false disables the overlay, preserving the mount API contract.
  for (const enabled of [undefined, null, 0, true]) {
    const f = fixture({config: {brbBlackholeReplacement: {enabled}}});
    assert.equal((await f.api.start('brb')).status, 'ready');
    assert.ok(f.events.includes('mount'));
  }
});

test('BRB import or mount failures use the existing offline error path', async () => {
  for (const importer of [
    () => { throw Error('import failed'); },
    () => ({mountBlackholeOverlay: async () => { throw Error('mount failed'); }}),
  ]) {
    const f = fixture({search: '?assets=offline', importer});
    assert.equal((await f.api.start('brb')).status, 'failed');
    assert.equal(f.errors.length, 1);
    assert.equal(f.error.hidden, false);
    assert.match(f.error.textContent, /local BRB assets/);
  }
  const missingError = fixture({search: '?assets=offline', fail: [local], errorElement: false});
  assert.equal((await missingError.api.start('brb')).status, 'failed');
});

test('browser script wrapper auto-starts each HTML data-scene with config loaded first', async () => {
  for (const [page, scene, renderer] of [['index.html', 'starting', 'main.js'], ['brb.html', 'brb', 'brb.js'], ['thanks.html', 'thanks', 'thanks.js']]) {
    const f = fixture();
    const html = read(page);
    const marker = /<script src="runtime\/boot.js" data-scene="([^"]+)"/.exec(html);
    assert.equal(marker?.[1], scene);
    f.doc.currentScript.getAttribute = key => key === 'data-scene' ? marker[1] : null;
    const context = vm.createContext({window: f.win, document: f.doc, URLSearchParams, URL});
    vm.runInContext(read('config.js'), context);
    vm.runInContext(read('runtime/snapshots.js'), context);
    vm.runInContext(read('runtime/settings.js'), context);
    vm.runInContext(read('runtime/overlay.js'), context);
    vm.runInContext(read('runtime/audio.js'), context);
    vm.runInContext(read('runtime/audio-session.js'), context);
    vm.runInContext(read('runtime/recovery.js'), context);
    f.win.STREAM_CONFIG.brbBlackholeReplacement.enabled = false;
    vm.runInContext(read('runtime/boot.js'), context);
    assert.equal((await f.win.StreamBoot.ready).status, 'ready');
    assert.deepEqual(f.requests, [local, renderer]);
    const handler = /onerror="([^"]+)"/.exec(html)[1];
    vm.runInContext(handler, context);
    assert.equal(f.error.hidden, false, 'missing bootstrap must expose fallback text');
  }
});

test('overlay import resolves relative to the shared file under file and repository-subpath URLs', () => {
  const source = read('runtime/boot.js');
  const relative = /return import\("([^"]+)"\)/.exec(source)[1];
  assert.equal(relative, '../brb-blackhole/blackholeOverlay.module.js');
  for (const base of ['https://example.test/repo/', 'file:///C:/preview/']) {
    const script = new URL('runtime/boot.js', base);
    assert.equal(new URL(relative, script).href, new URL('brb-blackhole/blackholeOverlay.module.js', base).href);
  }
  assert.ok(existsSync(join(root, 'runtime', relative)));
  assert.ok(RUNTIME_FILES.includes('runtime/boot.js'));
});

test('P1 preserves pre-P1 runtime bytes except the declared boot and overlay extraction files', () => {
  const before = JSON.parse(read('docs/source-baseline-assets.json'));
  const shells = new Set(['index.html', 'brb.html', 'thanks.html', 'main.js', 'brb.js', 'thanks.js']);
  for (const file of before.files) {
    if (file.path === 'brb-blackhole/blackholeOverlay.module.js') {
      assert.equal(createHash('sha256').update(restoreIntegration(read(file.path), file.path)).digest('hex'), file.sha256, file.path);
    } else if (!shells.has(file.path)) assert.equal(sha256File(join(root, file.path)), file.sha256, file.path);
  }
});

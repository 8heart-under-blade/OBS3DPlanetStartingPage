import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { repoRoot } from '../scripts/lib.mjs';
const require = createRequire(import.meta.url);
const createRecovery = require('../runtime/recovery.js');
const createOverlay = require('../runtime/overlay.js');
const root = repoRoot();
const read = file => readFileSync(join(root, file), 'utf8');

function fixture({container = true} = {}) {
  const intervals = new Map(), nodes = [], error = {hidden: true, textContent: ''};
  let nextTimer = 1, sockets = 0;
  const elements = {title: {}, subtitle: {}, datetime: {}, scene: container ? {} : null, bootError: error};
  const document = {documentElement: {style: {setProperty() {}}}, head: {appendChild: node => nodes.push(node)},
    createElement: tag => ({tag}), getElementById: id => elements[id] || null};
  const window = {Date, Intl, console, THREE: {WebGLRenderer: function () { throw Error('synthetic WebGL failure'); }},
    setInterval(fn, ms) { const id = nextTimer++; intervals.set(id, {fn, ms}); return id; },
    clearInterval(id) { intervals.delete(id); },
    WebSocket: function () { sockets++; }, location: {reload() {}},
    StreamSettings: {applyQuality: config => config},
  };
  window.StreamOverlay = createOverlay(window, document);
  window.StreamRecovery = createRecovery(window, document);
  return {window, document, intervals, error, nodes, sockets: () => sockets};
}

for (const scene of ['main.js', 'brb.js', 'thanks.js']) {
  test(scene + ': failed WebGL initialization stops clock, opens no audio socket, and reports safely', () => {
    const f = fixture();
    const context = vm.createContext({window: f.window, document: f.document});
    vm.runInContext(read('config.js'), context);
    vm.runInContext(read(scene), context);
    assert.equal(f.error.hidden, false);
    assert.match(f.error.textContent, /WebGL could not be initialized/);
    assert.equal(f.intervals.size, 0);
    assert.equal(f.sockets(), 0);
    f.window.StreamRuntime.dispose();
    assert.equal(f.intervals.size, 0);
  });
  test(scene + ': absent scene container also stops its clock', () => {
    const f = fixture({container: false});
    const context = vm.createContext({window: f.window, document: f.document});
    vm.runInContext(read('config.js'), context);
    vm.runInContext(read(scene), context);
    assert.equal(f.intervals.size, 0);
    assert.equal(f.sockets(), 0);
  });
}

test('scope listener wrappers reject saved callbacks after unsubscribe and disposal', () => {
  const f = fixture(), callbacks = [];
  const target = {addEventListener(_type, callback) { callbacks.push(callback); }, removeEventListener() {}};
  const scope = f.window.StreamRecovery.createScope();
  let calls = 0;
  const unsubscribe = scope.listen(target, 'resize', () => calls++);
  callbacks[0](); unsubscribe(); callbacks[0]();
  scope.listen(target, 'resize', () => calls++);
  scope.dispose(); callbacks[1]();
  assert.equal(calls, 1);
});

test('frame callback failures dispose the scope and use a fixed diagnostic', () => {
  const f = fixture(); let callback, cleaned = 0;
  f.window.requestAnimationFrame = fn => { callback = fn; return 1; };
  f.window.cancelAnimationFrame = () => {};
  const scope = f.window.StreamRecovery.createScope();
  scope.add(() => cleaned++);
  scope.requestFrame(() => { throw Error('private-error-value'); });
  assert.doesNotThrow(() => callback(16));
  assert.equal(scope.isDisposed(), true);
  assert.equal(cleaned, 1);
  assert.equal(f.error.hidden, false);
  assert.ok(!f.error.textContent.includes('private-error-value'));
});

test('late asset diagnostics are suppressed after scope disposal', () => {
  const f = fixture(), scope = f.window.StreamRecovery.createScope();
  const manager = f.window.StreamRecovery.createLoadingManager({LoadingManager: function () {}}, () => !scope.isDisposed());
  scope.dispose(); manager.onError('private-url-with-secret');
  assert.equal(f.error.hidden, true);
  assert.ok(!f.error.textContent.includes('secret'));
});

test('extra in-flight and replaced textures share the disposal deduplication set', () => {
  const f = fixture(); let disposed = 0;
  const texture = {dispose() { disposed++; }};
  const scene = {material: {map: texture}};
  f.window.StreamRecovery.disposeScene(scene, null, [texture, texture]);
  assert.equal(disposed, 1);
});

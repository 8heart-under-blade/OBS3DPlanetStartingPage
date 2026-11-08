// Recovery tests for runtime/recovery.js createRecovery factory.
// Dependency-free: node:test + node:assert/strict + node:module only.
// Fakes DOM, events, RAF and Three resources; no browser, network or timers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const createRecovery = require('../runtime/recovery.js');

const SAFE_MESSAGES = {
  'webgl-unavailable': 'WebGL could not be initialized in this browser source. Enable hardware acceleration or try a different browser source.',
  'context-lost': 'The 3D graphics context was lost and the scene has paused. Reload the page to rebuild the 3D view.',
  'asset-failed': 'Some scene assets could not be loaded. Check network access or local vendor files and reload the page.',
  'boot-failed': 'The scene could not start. Reload the page to try again.',
};

function makeBootError() {
  return { textContent: 'INITIAL', hidden: true, innerHTML: '__UNSET__' };
}

function makeDocument({ bootError = null, throwOnGet = false } = {}) {
  return {
    getElementById(id) {
      if (throwOnGet) throw new Error('synthetic dom failure');
      if (id === 'bootError') return bootError;
      return null;
    },
  };
}

function makeWindow() {
  const pending = new Map();
  const history = new Map();
  const cancelled = [];
  let nextId = 1;
  let rafCalls = 0;
  const win = {
    _pending: pending,
    _history: history,
    _cancelled: cancelled,
    _getRafCalls: () => rafCalls,
    location: {
      reloadCalls: 0,
      reload() {
        this.reloadCalls += 1;
      },
    },
    requestAnimationFrame(callback) {
      rafCalls += 1;
      const id = nextId;
      nextId += 1;
      history.set(id, callback);
      pending.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) {
      cancelled.push(id);
      pending.delete(id);
    },
    fire(id, timestamp = 16) {
      const callback = history.get(id);
      assert.ok(typeof callback === 'function', 'missing RAF history for id ' + id);
      pending.delete(id);
      callback(timestamp);
    },
    invokeHistorical(id, timestamp = 16) {
      const callback = history.get(id);
      assert.ok(typeof callback === 'function', 'missing RAF history for id ' + id);
      callback(timestamp);
    },
  };
  return win;
}

function makeTarget() {
  const listeners = new Map();
  const added = [];
  const removed = [];
  return {
    _listeners: listeners,
    _added: added,
    _removed: removed,
    addEventListener(type, callback, options) {
      added.push({ type, callback, options });
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push({ callback, options });
    },
    removeEventListener(type, callback, options) {
      removed.push({ type, callback, options });
      const list = listeners.get(type);
      if (!list) return;
      const index = list.findIndex((entry) => entry.callback === callback);
      if (index >= 0) list.splice(index, 1);
    },
    dispatch(type, event = {}) {
      const list = listeners.get(type);
      if (!list) return;
      for (const entry of list.slice()) entry.callback(event);
    },
    count(type) {
      return (listeners.get(type) || []).length;
    },
  };
}

function makeRecovery({ bootError = makeBootError(), throwOnGet = false, omitBootError = false } = {}) {
  const doc = makeDocument({ bootError: omitBootError ? null : bootError, throwOnGet });
  const win = makeWindow();
  const api = createRecovery(win, doc);
  return { api, win, doc, bootError: omitBootError ? null : bootError };
}

function makeDisposable({ fail = false } = {}) {
  const resource = {
    disposeCalls: 0,
    dispose() {
      resource.disposeCalls += 1;
      if (fail) throw new Error('synthetic dispose failure');
    },
  };
  return resource;
}

function makeFakeThree() {
  let constructed = 0;
  function LoadingManager() {
    constructed += 1;
    this.onError = null;
  }
  return {
    THREE: { LoadingManager },
    _getConstructed: () => constructed,
  };
}

function makeFakeScene(children) {
  const scene = {
    children: children || [],
    traverse(fn) {
      const visit = (node) => {
        fn(node);
        for (const child of node.children || []) visit(child);
      };
      visit(scene);
    },
  };
  return scene;
}

function makeRenderer(canvas, { failDispose = false, failLists = false } = {}) {
  const renderer = {
    domElement: canvas,
    disposeCalls: 0,
    listsCalls: 0,
    forceContextLossCalls: 0,
    forceContextRestoreCalls: 0,
    renderLists: {
      dispose() {
        renderer.listsCalls += 1;
        if (failLists) throw new Error('synthetic list dispose failure');
      },
    },
    dispose() {
      renderer.disposeCalls += 1;
      if (failDispose) throw new Error('synthetic renderer dispose failure');
    },
    forceContextLoss() {
      renderer.forceContextLossCalls += 1;
    },
    forceContextRestore() {
      renderer.forceContextRestoreCalls += 1;
    },
  };
  return renderer;
}

function makeLostEvent() {
  return {
    preventDefaultCalls: 0,
    preventDefault() {
      this.preventDefaultCalls += 1;
    },
  };
}

test('factory exposes the recovery API', () => {
  const { api } = makeRecovery();
  assert.equal(typeof api.createScope, 'function');
  assert.equal(typeof api.observeRenderer, 'function');
  assert.equal(typeof api.report, 'function');
  assert.equal(typeof api.createLoadingManager, 'function');
  assert.equal(typeof api.disposeScene, 'function');
});

test('report shows fixed safe messages for each allowed code', () => {
  for (const code of Object.keys(SAFE_MESSAGES)) {
    const { api, bootError } = makeRecovery();
    api.report(code);
    assert.equal(bootError.textContent, SAFE_MESSAGES[code], code);
    assert.equal(bootError.hidden, false, code);
    assert.equal(bootError.innerHTML, '__UNSET__', 'must use textContent, never innerHTML');
  }
});

test('report never echoes arbitrary strings, URLs or credentials', () => {
  const nasty = [
    'https://evil.example/secret?password=hunter2',
    'ws://127.0.0.1:4455 password=secret',
    'constructor',
    '__proto__',
    'toString',
    '',
    ' ',
    '<script>alert(1)</script>',
    42,
    null,
    undefined,
    {},
  ];
  for (const input of nasty) {
    const { api, bootError } = makeRecovery();
    api.report(input);
    assert.equal(bootError.textContent, SAFE_MESSAGES['boot-failed']);
    assert.equal(bootError.hidden, false);
    assert.ok(!bootError.textContent.includes('evil.example'));
    assert.ok(!bootError.textContent.includes('hunter2'));
    assert.ok(!bootError.textContent.includes('password'));
    assert.ok(!bootError.textContent.includes('<script>'));
  }
});

test('report is safe when bootError element or DOM lookup is missing', () => {
  const missing = makeRecovery({ omitBootError: true });
  assert.doesNotThrow(() => missing.api.report('context-lost'));

  const throwing = createRecovery(makeWindow(), makeDocument({ throwOnGet: true }));
  assert.doesNotThrow(() => throwing.report('context-lost'));
});

test('scope dispose is idempotent, runs cleanups once in reverse order', () => {
  const { api } = makeRecovery();
  const scope = api.createScope();
  assert.equal(scope.isDisposed(), false);
  const order = [];
  scope.add(() => order.push('a'));
  scope.add(() => order.push('b'));
  scope.add(() => order.push('c'));
  scope.dispose();
  assert.equal(scope.isDisposed(), true);
  assert.deepEqual(order, ['c', 'b', 'a']);
  scope.dispose();
  scope.dispose();
  assert.deepEqual(order, ['c', 'b', 'a']);
});

test('cleanup failure does not prevent other cleanups and dispose never throws', () => {
  const { api } = makeRecovery();
  const scope = api.createScope();
  const order = [];
  scope.add(() => order.push('first-added'));
  scope.add(() => {
    order.push('throws');
    throw new Error('synthetic cleanup failure');
  });
  scope.add(() => order.push('last-added'));
  assert.doesNotThrow(() => scope.dispose());
  assert.deepEqual(order, ['last-added', 'throws', 'first-added']);
});

test('scope cancels pending RAFs on dispose and disposed callbacks cannot run', () => {
  const { api, win } = makeRecovery();
  const scope = api.createScope();
  let runs = 0;
  const id1 = scope.requestFrame(() => {
    runs += 1;
  });
  const id2 = scope.requestFrame(() => {
    runs += 1;
  });
  assert.ok(id1 !== null && id2 !== null);
  assert.equal(win._pending.size, 2);
  scope.dispose();
  assert.deepEqual(win._cancelled.slice().sort(), [id1, id2].sort());
  assert.equal(win._pending.size, 0);
  // Even a late fire racing the cancel must be guarded.
  win.invokeHistorical(id1);
  win.invokeHistorical(id2);
  assert.equal(runs, 0);
});

test('fired frames are removed from tracking and not cancelled later', () => {
  const { api, win } = makeRecovery();
  const scope = api.createScope();
  let runs = 0;
  const id = scope.requestFrame((ts) => {
    assert.equal(ts, 99);
    runs += 1;
  });
  win.fire(id, 99);
  assert.equal(runs, 1);
  assert.equal(win._pending.size, 0);
  scope.dispose();
  assert.deepEqual(win._cancelled, []);
});

test('scope guards add/listen/requestFrame after dispose', () => {
  const { api, win } = makeRecovery();
  const scope = api.createScope();
  scope.dispose();

  let addedRan = false;
  scope.add(() => {
    addedRan = true;
  });
  assert.equal(addedRan, true, 'cleanup added after dispose runs immediately and is not stored');

  const target = makeTarget();
  const unsubscribe = scope.listen(target, 'resize', () => {});
  assert.equal(typeof unsubscribe, 'function');
  assert.equal(target._added.length, 0);
  unsubscribe();

  let ran = false;
  const result = scope.requestFrame(() => {
    ran = true;
  });
  assert.equal(result, null);
  assert.equal(win._getRafCalls(), 0);
  assert.equal(ran, false);
});

test('scope listeners are removed on dispose with matching options and unsubscribe is safe', () => {
  const { api } = makeRecovery();
  const scope = api.createScope();
  const target = makeTarget();
  let hits = 0;
  const callback = () => {
    hits += 1;
  };
  const options = { passive: true };
  const unsubscribe = scope.listen(target, 'resize', callback, options);
  assert.equal(target.count('resize'), 1);
  target.dispatch('resize');
  assert.equal(hits, 1);

  // Unsubscribe removes only this entry.
  unsubscribe();
  unsubscribe();
  assert.equal(target.count('resize'), 0);
  target.dispatch('resize');
  assert.equal(hits, 1);
  assert.equal(target._removed.length, 1);
  assert.equal(target._removed[0].callback, target._added[0].callback);
  assert.notEqual(target._added[0].callback, callback, 'listener wrapper must reject stale callbacks');
  assert.equal(target._removed[0].options, options);

  // A second listener tracked by the scope is removed by dispose.
  let hits2 = 0;
  const callback2 = () => {
    hits2 += 1;
  };
  scope.listen(target, 'scroll', callback2, options);
  assert.equal(target.count('scroll'), 1);
  scope.dispose();
  assert.equal(target.count('scroll'), 0);
  target.dispatch('scroll');
  assert.equal(hits2, 0);
  // Dispose must not double-remove the already-unsubscribed resize entry.
  const resizeRemovals = target._removed.filter((entry) => entry.type === 'resize');
  assert.equal(resizeRemovals.length, 1);
});

test('scopes are independent disposal units', () => {
  const { api, win } = makeRecovery();
  const scopeA = api.createScope();
  const scopeB = api.createScope();
  const target = makeTarget();
  let aHits = 0;
  let bHits = 0;
  let bRuns = 0;
  scopeA.listen(target, 'resize', () => {
    aHits += 1;
  });
  scopeB.listen(target, 'resize', () => {
    bHits += 1;
  });
  scopeB.requestFrame(() => {
    bRuns += 1;
  });
  scopeA.dispose();
  target.dispatch('resize');
  assert.equal(aHits, 0);
  assert.equal(bHits, 1);
  assert.equal(win._cancelled.length, 0);
  win._pending.forEach((callback, id) => callback(16));
  assert.equal(bRuns, 1);
  scopeB.dispose();
});

test('observeRenderer marks lost, prevents default, reports context-lost and calls onLost', () => {
  const { api, bootError } = makeRecovery();
  const canvas = makeTarget();
  const renderer = makeRenderer(canvas);
  let lostEvents = [];
  const observer = api.observeRenderer(renderer, {
    onLost: (event) => lostEvents.push(event),
  });
  assert.equal(observer.isLost(), false);

  const event = makeLostEvent();
  canvas.dispatch('webglcontextlost', event);
  assert.equal(event.preventDefaultCalls, 1);
  assert.equal(observer.isLost(), true);
  assert.equal(bootError.textContent, SAFE_MESSAGES['context-lost']);
  assert.equal(bootError.hidden, false);
  assert.equal(lostEvents.length, 1);
  assert.equal(lostEvents[0], event);

  // Duplicate lost must not re-report or re-call onLost.
  const duplicate = makeLostEvent();
  canvas.dispatch('webglcontextlost', duplicate);
  assert.equal(duplicate.preventDefaultCalls, 1);
  assert.equal(lostEvents.length, 1);
  observer.dispose();
});

test('observeRenderer restored with onRestored clears lost and never reloads', () => {
  const { api, win } = makeRecovery();
  const canvas = makeTarget();
  const renderer = makeRenderer(canvas);
  let restored = 0;
  const observer = api.observeRenderer(renderer, {
    onRestored: () => {
      restored += 1;
    },
  });
  canvas.dispatch('webglcontextlost', makeLostEvent());
  assert.equal(observer.isLost(), true);
  canvas.dispatch('webglcontextrestored', {});
  assert.equal(restored, 1);
  assert.equal(observer.isLost(), false);
  assert.equal(win.location.reloadCalls, 0);
  observer.dispose();
});

test('observeRenderer restored without handler reloads exactly once and ignores spurious restores', () => {
  const { api, win } = makeRecovery();
  const canvas = makeTarget();
  const renderer = makeRenderer(canvas);
  const observer = api.observeRenderer(renderer);

  // Spurious restore without prior loss does nothing.
  canvas.dispatch('webglcontextrestored', {});
  assert.equal(win.location.reloadCalls, 0);
  assert.equal(observer.isLost(), false);

  canvas.dispatch('webglcontextlost', makeLostEvent());
  assert.equal(observer.isLost(), true);
  canvas.dispatch('webglcontextrestored', {});
  assert.equal(win.location.reloadCalls, 1);

  // Second restore after the same loss must not reload again.
  canvas.dispatch('webglcontextrestored', {});
  assert.equal(win.location.reloadCalls, 1);

  // A later loss/restore cycle must still not reload again (once-only).
  canvas.dispatch('webglcontextlost', makeLostEvent());
  assert.equal(observer.isLost(), true);
  canvas.dispatch('webglcontextrestored', {});
  assert.equal(win.location.reloadCalls, 1);
  observer.dispose();
});

test('observeRenderer never reloads after dispose and detaches both events', () => {
  const { api, win, bootError } = makeRecovery();
  const canvas = makeTarget();
  const renderer = makeRenderer(canvas);
  let lostCalls = 0;
  const observer = api.observeRenderer(renderer, {
    onLost: () => {
      lostCalls += 1;
    },
  });
  canvas.dispatch('webglcontextlost', makeLostEvent());
  assert.equal(lostCalls, 1);
  const removalsBefore = canvas._removed.length;
  observer.dispose();
  observer.dispose();
  assert.equal(canvas._removed.length, removalsBefore + 2);
  assert.equal(canvas.count('webglcontextlost'), 0);
  assert.equal(canvas.count('webglcontextrestored'), 0);

  // After dispose, restored must not reload even though state is remembered.
  canvas.dispatch('webglcontextrestored', {});
  assert.equal(win.location.reloadCalls, 0);

  // Also a fresh observer disposed before loss must stay silent.
  const bootError2 = makeBootError();
  const { api: api2, win: win2 } = makeRecovery({ bootError: bootError2 });
  const canvas2 = makeTarget();
  const observer2 = api2.observeRenderer(makeRenderer(canvas2), {});
  observer2.dispose();
  canvas2.dispatch('webglcontextlost', makeLostEvent());
  assert.equal(bootError2.hidden, true);
  assert.equal(win2.location.reloadCalls, 0);
});

test('observeRenderer is graceful with missing renderer/canvas and throwing callbacks', () => {
  const { api } = makeRecovery();
  for (const renderer of [null, undefined, {}, { domElement: null }, { domElement: {} }]) {
    const observer = api.observeRenderer(renderer, {});
    assert.equal(observer.isLost(), false);
    assert.doesNotThrow(() => observer.dispose());
    assert.doesNotThrow(() => observer.dispose());
  }

  const canvas = makeTarget();
  const { api: api2, bootError } = makeRecovery();
  const observer = api2.observeRenderer(makeRenderer(canvas), {
    onLost: () => {
      throw new Error('synthetic onLost failure');
    },
    onRestored: () => {
      throw new Error('synthetic onRestored failure');
    },
  });
  canvas.dispatch('webglcontextlost', makeLostEvent());
  assert.equal(observer.isLost(), true);
  assert.equal(bootError.textContent, SAFE_MESSAGES['context-lost']);
  assert.doesNotThrow(() => canvas.dispatch('webglcontextrestored', {}));
  assert.equal(observer.isLost(), false);
  observer.dispose();
});

test('createLoadingManager returns a LoadingManager whose onError reports asset-failed without echoing URL', () => {
  const { api, bootError } = makeRecovery();
  const fake = makeFakeThree();
  const manager = api.createLoadingManager(fake.THREE);
  assert.ok(manager && typeof manager === 'object');
  assert.equal(fake._getConstructed(), 1);
  assert.equal(typeof manager.onError, 'function');

  manager.onError('https://evil.example/textures/secret.png?password=hunter2', 'hunter2');
  assert.equal(bootError.textContent, SAFE_MESSAGES['asset-failed']);
  assert.equal(bootError.hidden, false);
  assert.ok(!bootError.textContent.includes('evil.example'));
  assert.ok(!bootError.textContent.includes('hunter2'));
  assert.ok(!bootError.textContent.includes('password'));

  // Safe to call with no arguments too.
  manager.onError();
  assert.equal(bootError.textContent, SAFE_MESSAGES['asset-failed']);
});

test('createLoadingManager returns null gracefully when THREE is missing', () => {
  const { api } = makeRecovery();
  for (const three of [null, undefined, {}, { LoadingManager: 'nope' }]) {
    assert.equal(api.createLoadingManager(three), null);
  }
  const broken = {
    LoadingManager: function () {
      throw new Error('synthetic constructor failure');
    },
  };
  assert.equal(api.createLoadingManager(broken), null);
});

test('disposeScene disposes deduped geometry/material/textures including uniforms and arrays', () => {
  const { api } = makeRecovery();
  const sharedGeometry = makeDisposable();
  const sharedTexture = makeDisposable();
  const uniformTexture = makeDisposable();
  const arrayTextureA = makeDisposable();
  const arrayTextureB = makeDisposable();
  const plainTexture = makeDisposable();
  const materialA = makeDisposable();
  materialA.map = sharedTexture;
  materialA.normalMap = sharedTexture;
  materialA.uniforms = {
    uMain: { value: sharedTexture },
    uSingle: { value: uniformTexture },
    uArray: { value: [arrayTextureA, arrayTextureB] },
    uPlain: { value: { nested: plainTexture } },
    uNumber: { value: 42 },
    uNull: { value: null },
    uVec: { value: { x: 1, y: 2, isVector3: true } },
  };
  const materialB = makeDisposable();
  materialB.uniforms = { uSingle: { value: uniformTexture } };

  const mesh1 = { geometry: sharedGeometry, material: materialA, children: [] };
  const mesh2 = { geometry: sharedGeometry, material: materialB, children: [] };
  const mesh3 = { geometry: makeDisposable(), material: [materialA, materialB], children: [] };
  const scene = makeFakeScene([mesh1, mesh2, mesh3]);
  const backgroundTexture = makeDisposable();
  scene.background = backgroundTexture;

  const renderer = makeRenderer(makeTarget());
  api.disposeScene(scene, renderer);

  assert.equal(sharedGeometry.disposeCalls, 1);
  assert.equal(materialA.disposeCalls, 1);
  assert.equal(materialB.disposeCalls, 1);
  assert.equal(sharedTexture.disposeCalls, 1);
  assert.equal(uniformTexture.disposeCalls, 1);
  assert.equal(arrayTextureA.disposeCalls, 1);
  assert.equal(arrayTextureB.disposeCalls, 1);
  assert.equal(plainTexture.disposeCalls, 1);
  assert.equal(backgroundTexture.disposeCalls, 1);
  assert.equal(mesh3.geometry.disposeCalls, 1);
  assert.equal(renderer.disposeCalls, 1);
  assert.equal(renderer.listsCalls, 1);
  assert.equal(renderer.forceContextLossCalls, 0);
  assert.equal(renderer.forceContextRestoreCalls, 0);
});

test('disposeScene isolates failures and continues disposing everything reachable', () => {
  const { api } = makeRecovery();
  const failingGeometry = makeDisposable({ fail: true });
  const goodGeometry = makeDisposable();
  const failingTexture = makeDisposable({ fail: true });
  const goodTexture = makeDisposable();
  const failingMaterial = makeDisposable({ fail: true });
  failingMaterial.map = failingTexture;
  failingMaterial.uniforms = { uGood: { value: goodTexture } };
  const goodMaterial = makeDisposable();
  goodMaterial.map = goodTexture;

  const scene = makeFakeScene([
    { geometry: failingGeometry, material: failingMaterial, children: [] },
    { geometry: goodGeometry, material: goodMaterial, children: [] },
  ]);
  const renderer = makeRenderer(makeTarget(), { failLists: true, failDispose: true });

  assert.doesNotThrow(() => api.disposeScene(scene, renderer));
  assert.equal(failingGeometry.disposeCalls, 1);
  assert.equal(goodGeometry.disposeCalls, 1);
  assert.equal(failingTexture.disposeCalls, 1);
  assert.equal(goodTexture.disposeCalls, 1);
  assert.equal(failingMaterial.disposeCalls, 1);
  assert.equal(goodMaterial.disposeCalls, 1);
  assert.equal(renderer.listsCalls, 1);
  assert.equal(renderer.disposeCalls, 1);
});

test('disposeScene handles missing APIs gracefully without forcing context loss', () => {
  const { api } = makeRecovery();
  assert.doesNotThrow(() => api.disposeScene(null, null));
  assert.doesNotThrow(() => api.disposeScene(undefined, undefined));

  const renderer = makeRenderer(makeTarget());
  assert.doesNotThrow(() => api.disposeScene(null, renderer));
  assert.equal(renderer.disposeCalls, 1);
  assert.equal(renderer.forceContextLossCalls, 0);

  // Scene without traverse falls back to children walk.
  const geometry = makeDisposable();
  const material = makeDisposable();
  const scene = { children: [{ geometry, material, children: [] }] };
  assert.doesNotThrow(() => api.disposeScene(scene, null));
  assert.equal(geometry.disposeCalls, 1);
  assert.equal(material.disposeCalls, 1);

  // Bare nodes and missing dispose functions are ignored.
  const bareScene = { traverse(fn) { fn({ children: [] }); fn({ geometry: {}, material: {}, children: [] }); } };
  assert.doesNotThrow(() => api.disposeScene(bareScene, {}));

  // Renderer without dispose/renderLists is a no-op.
  assert.doesNotThrow(() => api.disposeScene(makeFakeScene([]), {}));
});

test('disposeScene does not walk arbitrary nested objects outside uniforms', () => {
  const { api } = makeRecovery();
  const secretTexture = makeDisposable();
  const material = makeDisposable();
  material.userData = { deep: { texture: secretTexture } };
  material.uniforms = {};
  const scene = makeFakeScene([{ geometry: makeDisposable(), material, children: [] }]);
  api.disposeScene(scene, null);
  assert.equal(material.disposeCalls, 1);
  assert.equal(secretTexture.disposeCalls, 0, 'arbitrary nested userData must not be walked');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { repoRoot } from '../scripts/lib.mjs';
const require = createRequire(import.meta.url);
const createRecovery = require('../runtime/recovery.js');
const source = readFileSync(join(repoRoot(), 'brb-blackhole/blackholeOverlay.module.js'), 'utf8');
const mountBody = source.slice(source.indexOf('export async function mountBlackholeOverlay()'), source.indexOf('\nfunction createOrbitControls(')).replace('export async function', 'async function');

function target() {
  const listeners = new Map();
  return {listeners,
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    emit(type, event = {}) { for (const fn of [...(listeners.get(type) || [])]) fn(event); },
  };
}
function fixture({enabled = true, layerPresent = true, deferred = false, throwRender = false} = {}) {
  const frames = new Map(), disposed = {geometry: 0, material: 0, renderer: 0};
  let nextFrame = 1, imports = 0, baseDisposed = 0, reloads = 0, renders = 0, madeRenderers = 0;
  const layer = {style: {}, children: [], getBoundingClientRect: () => ({width: 1920, height: 1080}),
    appendChild(node) { this.children.push(node); node.parentElement = this; },
    removeChild(node) { this.children.splice(this.children.indexOf(node), 1); node.parentElement = null; }};
  const error = {hidden: true, textContent: ''};
  const document = {getElementById: id => id === 'blackholeLayer' ? (layerPresent ? layer : null) : id === 'bootError' ? error : null};
  const window = Object.assign(target(), {
    STREAM_CONFIG: {brbBlackholeReplacement: {enabled, mouseControlEnabled: false}},
    StreamRuntime: {isDisposed: () => false, dispose() { baseDisposed++; }},
    StreamSettings: {limit: (_kind, count) => count},
    devicePixelRatio: 1,
    requestAnimationFrame(fn) { const id = nextFrame++; frames.set(id, fn); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    location: {reload() { reloads++; }},
  });
  window.StreamRecovery = createRecovery(window, document);
  class Vector3 {
    constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
    set(x, y, z) { Object.assign(this, {x, y, z}); return this; }
    copy(v) { return this.set(v.x, v.y, v.z); }
    clone() { return new Vector3(this.x, this.y, this.z); }
    normalize() { return this; }
  }
  let renderer;
  const THREE = {
    Vector3,
    WebGLRenderer: class {
      constructor() { madeRenderers++; renderer = this; this.domElement = Object.assign(target(), {style: {}}); }
      setClearColor() {} setClearAlpha() {} setPixelRatio() {} setSize() {}
      render() { if (throwRender) throw Error('synthetic render failure'); renders++; }
      dispose() { disposed.renderer++; }
    },
    Scene: class { constructor() { this.children = []; } add(child) { this.children.push(child); } },
    OrthographicCamera: class {},
    PerspectiveCamera: class {
      constructor(fov) { this.fov = fov; this.aspect = 1; this.position = new Vector3(); this.matrixWorld = {elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]}; }
      lookAt() {} updateMatrixWorld() {} updateProjectionMatrix() {}
    },
    ShaderMaterial: class { constructor(options) { Object.assign(this, options); } dispose() { disposed.material++; } },
    PlaneGeometry: class { dispose() { disposed.geometry++; } },
    Mesh: class { constructor(geometry, material) { Object.assign(this, {geometry, material}); } },
    Clock: class { getElapsedTime() { return 0; } },
  };
  let resolveRuntime;
  const wait = new Promise(resolve => { resolveRuntime = resolve; });
  const loadOverlayRuntime = () => { imports++; return deferred ? wait : Promise.resolve({THREE}); };
  const factory = vm.runInNewContext('(function(window, document, loadOverlayRuntime, readVector3Config, vertexShader, fragmentShader) { ' + mountBody + '; return mountBlackholeOverlay; })');
  const mount = factory(window, document, loadOverlayRuntime, (_value, x, y, z) => ({x, y, z}), 'test vertex', 'test fragment');
  return {window, layer, error, frames, disposed, mount,
    release: () => resolveRuntime({THREE}), renderer: () => renderer,
    imports: () => imports, baseDisposed: () => baseDisposed, reloads: () => reloads,
    renders: () => renders, madeRenderers: () => madeRenderers};
}

test('disabled or absent BRB overlay never imports its optional runtime', async () => {
  for (const options of [{enabled: false}, {layerPresent: false}]) {
    const f = fixture(options);
    assert.equal(await f.mount(), null);
    assert.equal(f.imports(), 0);
  }
});

test('BRB unload during async runtime loading prevents late renderer creation', async () => {
  const f = fixture({deferred: true}), pending = f.mount();
  f.window.emit('beforeunload'); f.release();
  assert.equal(await pending, null);
  assert.equal(f.madeRenderers(), 0);
  assert.equal(f.frames.size, 0);
});

test('BRB dispose cancels RAF, releases GPU resources once, removes canvas and listeners', async () => {
  const f = fixture(), mounted = await f.mount();
  assert.equal(f.renders(), 1); assert.equal(f.frames.size, 1); assert.equal(f.layer.children.length, 1);
  mounted.dispose(); mounted.dispose();
  assert.deepEqual(f.disposed, {geometry: 1, material: 1, renderer: 1});
  assert.equal(f.frames.size, 0); assert.equal(f.layer.children.length, 0);
  for (const listeners of f.window.listeners.values()) assert.equal(listeners.size, 0);
});

test('BRB first-frame failure releases partial initialization and reports safely', async () => {
  const f = fixture({throwRender: true});
  await assert.rejects(f.mount(), /BRB renderer could not start/);
  assert.deepEqual(f.disposed, {geometry: 1, material: 1, renderer: 1});
  assert.equal(f.frames.size, 0);
  assert.equal(f.layer.children.length, 0);
  assert.equal(f.error.hidden, false);
});

test('BRB context loss pauses both scenes and default restoration rebuilds the page once', async () => {
  const f = fixture(), mounted = await f.mount(), canvas = f.renderer().domElement;
  let prevented = 0;
  canvas.emit('webglcontextlost', {preventDefault() { prevented++; }});
  assert.equal(prevented, 1); assert.equal(f.baseDisposed(), 1); assert.equal(f.error.hidden, false);
  const pending = [...f.frames.values()]; f.frames.clear(); pending.forEach(fn => fn());
  assert.equal(f.renders(), 1); assert.equal(f.frames.size, 0);
  canvas.emit('webglcontextrestored'); canvas.emit('webglcontextrestored');
  assert.equal(f.reloads(), 1);
  mounted.dispose(); canvas.emit('webglcontextlost'); canvas.emit('webglcontextrestored');
  assert.equal(f.reloads(), 1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { repoRoot } from '../scripts/lib.mjs';
const require = createRequire(import.meta.url);
const createEditor = require('../editor.js');
const snapshots = require('../runtime/snapshots.js')();
const html = readFileSync(join(repoRoot(), 'editor.html'), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

class Element {
  constructor(id = '') { this.id = id; this.value = ''; this.checked = false; this.disabled = false; this.hidden = false; this.style = {}; this.children = []; this.listeners = new Map(); this.attributes = {}; this.clientWidth = 960; this.sources = []; }
  set textContent(value) { this._text = value; this.children = []; }
  get textContent() { return this._text || ''; }
  set src(value) { this._src = value; this.sources.push(value); }
  get src() { return this._src; }
  appendChild(child) { this.children.push(child); child.parentNode = this; return child; }
  removeChild(child) { this.children.splice(this.children.indexOf(child), 1); child.parentNode = null; }
  addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
  async emit(type, extra = {}) { await Promise.all([...(this.listeners.get(type) || [])].map(fn => fn({target: this, preventDefault() {}, ...extra}))); }
  setAttribute(key, value) { this.attributes[key] = value; }
  removeAttribute(key) { delete this.attributes[key]; if (key === 'href') this.href = ''; }
  focus() { this.focused = true; }
  select() { this.selected = true; }
  click() { this.clicked = true; }
}
function fixture({stored = null, reduced = false, blocked = false, clipboard = 'ok', confirm = true, start = true, href = 'http://127.0.0.1:8080/repo/editor.html'} = {}) {
  const controls = Object.fromEntries(ids.map(id => [id, new Element(id)]));
  controls['preset-select'].value = 'original';
  const body = new Element('body'), created = [], saved = [], timers = new Map(), copied = [], blobs = [], revoked = [];
  const storage = {value: stored, clears: 0};
  const drafts = {
    load: () => ({snapshot: storage.value, warning: blocked ? 'storage-unavailable' : ''}),
    save(value) { const json = snapshots.stringify(value); if (blocked) return {ok: false, warning: 'storage-unavailable'}; saved.push(json); storage.value = snapshots.parse(json); return {ok: true, warning: ''}; },
    clear() { storage.clears++; storage.value = null; return {ok: !blocked, warning: blocked ? 'storage-unavailable' : ''}; },
  };
  const document = {getElementById: id => controls[id] || null, body, createElement: tag => { const element = new Element(); element.tag = tag; created.push(element); return element; }};
  let timerId = 0, observer;
  const window = Object.assign(new Element('window'), {
    location: {href},
    navigator: clipboard === 'missing' ? {} : {clipboard: {writeText(value) { if (clipboard === 'fail') return Promise.reject(Error('private-native-error')); copied.push(value); return Promise.resolve(); }}},
    matchMedia: () => ({matches: reduced}), confirm: () => confirm,
    setTimeout(fn, delay) { const id = ++timerId; timers.set(id, {fn, delay}); return id; },
    clearTimeout: id => timers.delete(id),
    ResizeObserver: class { constructor(fn) { this.fn = fn; observer = this; } observe() {} disconnect() { this.disconnected = true; } },
    Blob: class { constructor(parts, options) { this.parts = parts; this.type = options.type; blobs.push(this); } },
    URL: {createObjectURL: () => 'blob:synthetic-' + blobs.length, revokeObjectURL: value => revoked.push(value)},
  });
  const api = createEditor(window, document, snapshots, drafts);
  if (start) api.start();
  function runTimers(delay = 350) { for (const [id, value] of [...timers]) if (value.delay === delay) { timers.delete(id); value.fn(); } }
  async function edit(id, value) { if (id === 'reduced-motion') controls[id].checked = value; else controls[id].value = value; await controls['editor-form'].emit('input', {target: controls[id]}); }
  async function importFile(source, size = Buffer.byteLength(source)) { controls['import-input'].files = [{size, text: async () => source}]; await controls['import-input'].emit('change'); }
  return {api, window, controls, document, saved, timers, copied, blobs, revoked, storage, created, runTimers, edit, importFile, observer: () => observer};
}
function decodeLink(f, scene) { return snapshots.fromHash(new URL(f.controls['link-' + scene].value).hash); }

test('editor starts with three validated snapshot links, a full-size scaled preview and no config.js', () => {
  const f = fixture();
  for (const scene of ['starting', 'brb', 'thanks']) assert.deepEqual(decodeLink(f, scene), f.api.getSnapshot());
  assert.equal(f.controls['scene-preview'].style.transform, 'scale(0.5)');
  assert.ok(f.controls['scene-preview'].src.includes('/repo/index.html?assets=offline#preset='));
  assert.doesNotMatch(html, /<script[^>]+src="config\.js"/);
  assert.equal(f.saved.length, 0);
});

test('Unicode edits autosave only validated state and copied URLs retain snapshot semantics', async () => {
  const f = fixture(), old = f.controls['link-starting'].value;
  await f.edit('title-input', '星空 café 😀'); f.runTimers();
  assert.equal(f.api.getSnapshot().scenes.starting.title, '星空 café 😀');
  assert.equal(f.saved.length, 1);
  assert.equal(decodeLink(f, 'thanks').scenes.starting.title, '星空 café 😀');
  assert.equal(snapshots.fromHash(new URL(old).hash).scenes.starting.title, 'STREAM STARTING SOON');
  assert.equal(Object.hasOwn(JSON.parse(f.saved[0]), 'audioReactive'), false);
});

test('switching scenes commits the old fields and resetting affects only the selected scene', async () => {
  const f = fixture();
  await f.edit('title-input', 'Custom start');
  f.controls['scene-select'].value = 'brb'; await f.controls['scene-select'].emit('change');
  assert.equal(f.controls['title-input'].value, 'BE RIGHT BACK');
  assert.equal(f.api.getSnapshot().scenes.starting.title, 'Custom start');
  await f.edit('title-input', 'Custom BRB'); f.runTimers();
  await f.controls['reset-button'].emit('click');
  assert.equal(f.api.getSnapshot().scenes.brb.title, 'BE RIGHT BACK');
  assert.equal(f.api.getSnapshot().scenes.starting.title, 'Custom start');
});

test('invalid controls disable stale link copying/export without writing raw input', async () => {
  const f = fixture(), previous = f.api.getSnapshot();
  await f.edit('top-input', ''); f.runTimers();
  assert.equal(f.controls['copy-starting'].disabled, true);
  assert.equal(f.controls['link-starting'].value, '');
  assert.equal(f.controls['export-button'].disabled, true);
  assert.equal(f.controls['editor-error'].hidden, false);
  assert.match(f.controls['editor-status'].textContent, /last valid settings/);
  assert.deepEqual(f.api.getSnapshot(), previous); assert.equal(f.saved.length, 0);
  await f.edit('top-input', '0'); f.runTimers();
  assert.equal(f.api.getSnapshot().scenes.starting.topVh, 0);
  assert.equal(f.controls['copy-starting'].disabled, false);
  await f.edit('title-font', 'url(https://private.example)'); f.runTimers();
  assert.equal(f.saved.length, 1); assert.equal(f.controls['link-starting'].value, '');
  assert.ok(!f.controls['editor-error'].textContent.includes('private.example'));
});

test('new drafts honor system reduced motion while restored drafts retain their own choice', () => {
  const fresh = fixture({reduced: true});
  assert.equal(fresh.api.getSnapshot().reducedMotion, true);
  const stored = snapshots.defaults(); stored.scenes.starting.title = 'Saved';
  const restored = fixture({stored, reduced: true});
  assert.equal(restored.controls['title-input'].value, 'Saved');
  assert.equal(restored.api.getSnapshot().reducedMotion, false);
});

test('presets replace all scenes deliberately and cancelling leaves the draft unchanged', async () => {
  const f = fixture(); f.controls['preset-select'].value = 'minimal'; await f.controls['preset-apply'].emit('click');
  for (const scene of Object.values(f.api.getSnapshot().scenes)) assert.equal(scene.subtitle, '');
  f.controls['preset-select'].value = 'quiet'; await f.controls['preset-apply'].emit('click');
  assert.equal(f.api.getSnapshot().reducedMotion, true); assert.equal(f.api.getSnapshot().quality, 'low');
  const cancelled = fixture({confirm: false}); cancelled.controls['preset-select'].value = 'quiet';
  await cancelled.controls['preset-apply'].emit('click'); assert.equal(cancelled.api.getSnapshot().quality, 'tuned');
});

test('valid and schema-0 imports update every URL; invalid imports leave current settings intact', async () => {
  const f = fixture(); await f.importFile('{"schemaVersion":0,"title":"Imported title"}');
  assert.equal(f.api.getSnapshot().scenes.starting.title, 'Imported title');
  assert.equal(decodeLink(f, 'brb').scenes.starting.title, 'Imported title');
  const previous = f.api.getSnapshot(), saves = f.saved.length;
  await f.importFile('{"schemaVersion":1,"password":"synthetic-secret"}');
  assert.deepEqual(f.api.getSnapshot(), previous); assert.equal(f.saved.length, saves);
  assert.ok(!f.controls['editor-error'].textContent.includes('synthetic-secret'));
  assert.equal(f.controls['editor-error'].hidden, false);
});

test('oversized imports are rejected before reading and never reach draft storage', async () => {
  const f = fixture(); let reads = 0;
  f.controls['import-input'].files = [{size: 8193, text: async () => { reads++; return '{}'; }}];
  await f.controls['import-input'].emit('change');
  assert.equal(reads, 0); assert.equal(f.saved.length, 0);
});

test('an import resolving after new user edits cannot overwrite those edits', async () => {
  const f = fixture(); let resolve;
  f.controls['import-input'].files = [{size: 30, text: () => new Promise(done => { resolve = done; })}];
  const pending = f.controls['import-input'].emit('change');
  await f.edit('title-input', 'New user edit');
  resolve('{"schemaVersion":0,"title":"Old import"}'); await pending;
  f.runTimers();
  assert.equal(f.api.getSnapshot().scenes.starting.title, 'New user edit');
});

test('export serializes only the validated preset and releases its object URL', async () => {
  const f = fixture(); await f.edit('title-input', 'Export newest');
  await f.controls['export-button'].emit('click');
  assert.equal(f.blobs[0].type, 'application/json');
  const value = snapshots.parse(f.blobs[0].parts.join(''));
  assert.equal(value.scenes.starting.title, 'Export newest');
  assert.equal(Object.hasOwn(value, 'password'), false);
  assert.ok(f.created.some(element => element.download === 'obs3dplanet-preset-v1.json' && element.clicked));
  f.runTimers(1000); assert.deepEqual(f.revoked, ['blob:synthetic-1']);
});

test('copy uses current validated links and provides a manual fallback if clipboard is unavailable', async () => {
  const f = fixture(); await f.edit('title-input', 'Copy newest');
  await f.controls['copy-starting'].emit('click'); await flush();
  assert.equal(snapshots.fromHash(new URL(f.copied[0]).hash).scenes.starting.title, 'Copy newest');
  for (const clipboard of ['missing', 'fail']) {
    const fallback = fixture({clipboard}); await fallback.controls['copy-thanks'].emit('click'); await flush();
    assert.equal(fallback.controls['link-thanks'].focused, true);
    assert.equal(fallback.controls['link-thanks'].selected, true);
    assert.ok(!fallback.controls['editor-status'].textContent.includes('private-native-error'));
  }
});

test('blocked draft storage warns but does not prevent preview and link generation', async () => {
  const f = fixture({blocked: true}); await f.edit('title-input', 'Not stored'); f.runTimers();
  assert.equal(f.controls['copy-starting'].disabled, false);
  assert.equal(f.controls['warning-list'].children[0].textContent, 'Draft storage is unavailable. Copy your links or export a preset backup.');
  await f.controls['clear-draft-button'].emit('click'); assert.equal(f.storage.clears, 1);
});

test('clearing a draft cancels pending autosave and does not immediately recreate the saved copy', async () => {
  const f = fixture();
  await f.edit('title-input', 'Keep current but not saved');
  await f.controls['clear-draft-button'].emit('click');
  assert.equal(f.storage.value, null);
  assert.equal(f.api.getSnapshot().scenes.starting.title, 'Keep current but not saved');
  f.runTimers();
  assert.equal(f.saved.length, 0);
  await f.window.emit('beforeunload');
  assert.equal(f.storage.value, null);
});

test('unload flushes pending valid edits and disposal removes listeners/timers/preview', async () => {
  const f = fixture(); const count = f.controls['editor-form'].listeners.get('input').size;
  f.api.start(); assert.equal(f.controls['editor-form'].listeners.get('input').size, count);
  await f.edit('title-input', 'Last edit'); await f.window.emit('beforeunload');
  assert.equal(f.storage.value.scenes.starting.title, 'Last edit');
  assert.equal(f.timers.size, 0); assert.equal(f.controls['scene-preview'].src, 'about:blank');
  assert.equal(f.observer().disconnected, true);
  assert.equal(f.controls['editor-form'].listeners.get('input').size, 0);
  f.api.dispose();
});

test('real browser wrappers start the editor and round-trip autosaves through the actual storage adapter', async () => {
  const f = fixture({start: false}), data = new Map();
  Object.assign(f.window, {TextEncoder, TextDecoder, btoa, atob,
    localStorage: {getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key)}});
  const context = vm.createContext({window: f.window, document: f.document, URL, URLSearchParams});
  for (const file of ['runtime/snapshots.js', 'runtime/drafts.js', 'editor.js']) {
    vm.runInContext(readFileSync(join(repoRoot(), file), 'utf8'), context);
  }
  assert.equal(f.window.StreamEditor.getSnapshot().schemaVersion, 1);
  await f.edit('title-input', 'Real adapters 星空'); f.runTimers();
  const saved = snapshots.parse(data.get('obs3dplanet.editor.draft.v1'));
  assert.equal(saved.scenes.starting.title, 'Real adapters 星空');
  assert.equal(decodeLink(f, 'starting').scenes.starting.title, 'Real adapters 星空');
  f.window.StreamEditor.dispose();
});

test('stale iframe loads and ready promises cannot claim success for newer preview settings', async () => {
  const f = fixture(), frame = f.controls['scene-preview'];
  const oldUrl = frame.src, oldPreset = f.api.getSnapshot();
  await f.edit('title-input', 'New preview'); f.runTimers();
  frame.contentWindow = {location: {href: oldUrl}, STREAM_SNAPSHOT: oldPreset, StreamBoot: {ready: Promise.resolve({status: 'ready', scene: 'starting'})}};
  await frame.emit('load'); await flush();
  assert.ok(!f.controls['editor-status'].textContent.startsWith('Preview started.'));
  let resolve;
  frame.contentWindow = {location: {href: frame.src}, STREAM_SNAPSHOT: f.api.getSnapshot(), StreamBoot: {ready: new Promise(done => { resolve = done; })}};
  await frame.emit('load');
  await f.edit('title-input', 'Newest preview'); f.runTimers();
  resolve({status: 'ready', scene: 'starting'}); await flush();
  assert.ok(!f.controls['editor-status'].textContent.startsWith('Preview started.'));
  frame.contentWindow = {location: {href: frame.src}, STREAM_SNAPSHOT: f.api.getSnapshot(), StreamBoot: {ready: Promise.resolve({status: 'ready', scene: 'starting'})}};
  await frame.emit('load'); await flush();
  assert.ok(f.controls['editor-status'].textContent.startsWith('Preview started.'));
});

test('fresh editor defaults Auto, allows Off and saves only the nonsecret mode; remote Auto stays a portable mode', async () => {
  const f = fixture();
  assert.equal(f.api.getSnapshot().audioMode, 'auto');
  await f.edit('audio-mode', 'off'); f.runTimers();
  assert.equal(decodeLink(f, 'starting').audioMode, 'off');
  assert.equal(f.saved.length, 1);
  await f.edit('audio-mode', 'setup'); f.runTimers();
  assert.equal(decodeLink(f, 'brb').audioMode, 'setup');
  assert.equal(Object.hasOwn(JSON.parse(f.saved.at(-1)), 'password'), false);
  const remote = fixture({href: 'https://example.com/editor.html'});
  assert.equal(remote.api.getSnapshot().audioMode, 'auto');
  assert.match(remote.controls['warning-list'].children[0].textContent, /only from a trusted localhost/);
  const oldDraft = snapshots.defaults(); delete oldDraft.audioMode;
  const restored = fixture({stored: oldDraft});
  assert.equal(restored.api.getSnapshot().audioMode, 'off', 'old saved snapshots must not unexpectedly enable audio');
});

test('editor shell has unique IDs, labelled controls, status/error regions and no unsafe handlers', () => {
  assert.equal(new Set(ids).size, ids.length);
  for (const match of html.matchAll(/<(?:input|select|textarea)\b[^>]*\bid="([^"]+)"/g)) assert.ok(html.includes('for="' + match[1] + '"'), match[1]);
  assert.match(html, /role="status" aria-live="polite"/);
  assert.match(html, /role="alert" hidden/);
  assert.match(html, /<noscript>/);
  assert.doesNotMatch(html, /\bon(?:click|input|change|load)=/);
  assert.match(html, /Auto connects only from a trusted localhost/);
  for (const [scene, label] of [['starting', 'Starting'], ['brb', 'BRB'], ['thanks', 'Thanks']]) {
    assert.ok(html.includes('<button id="copy-' + scene + '" type="button" aria-label="Copy link for ' + label + ' scene">Copy link</button>'));
  }
  assert.ok(html.indexOf('runtime/snapshots.js') < html.indexOf('runtime/drafts.js'));
  assert.ok(html.indexOf('runtime/drafts.js') < html.indexOf('src="editor.js"'));
});

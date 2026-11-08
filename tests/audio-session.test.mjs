import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { webcrypto } from 'node:crypto';
const require = createRequire(import.meta.url);
const snapshots = require('../runtime/snapshots.js')();
const createAudio = require('../runtime/audio.js');
const createSession = require('../runtime/audio-session.js');
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };
class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.listeners = new Map(); this.hidden = false; this.value = ''; this.attributes = {}; }
  appendChild(child) { this.children.push(child); child.parentNode = this; return child; }
  removeChild(child) { this.children.splice(this.children.indexOf(child), 1); child.parentNode = null; }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
  emit(type, extra = {}) { const event = {preventDefault() { this.prevented = true; }, ...extra}; for (const fn of [...(this.listeners.get(type) || [])]) fn(event); return event; }
  focus() { this.focused = true; }
}
function fixture({mode = 'auto', href = 'http://127.0.0.1:8080/index.html', framed = false, legacy = false} = {}) {
  const elements = [], sockets = [], timers = new Map(), warnings = [], cleanups = [];
  let timerId = 0;
  const doc = {body: new Element('body'), createElement(tag) { const el = new Element(tag); elements.push(el); return el; }};
  class Socket {
    constructor(url) { this.url = url; this.readyState = 0; this.sent = []; this.closes = 0; sockets.push(this); }
    open() { this.readyState = 1; this.onopen?.(); }
    message(data) { this.onmessage?.({data: JSON.stringify(data)}); }
    send(data) { this.sent.push(JSON.parse(data)); }
    close() { this.readyState = 3; this.closes++; this.onclose?.(); }
  }
  const win = Object.assign(new Element('window'), {
    STREAM_SNAPSHOT: legacy ? null : {...snapshots.defaults(), audioMode: mode},
    StreamSnapshots: snapshots, location: {href}, WebSocket: Socket, crypto: webcrypto, TextEncoder,
    btoa: value => Buffer.from(value, 'binary').toString('base64'),
    console: {warn: (...args) => warnings.push(args)},
    setTimeout(fn, delay) { const id = ++timerId; timers.set(id, {fn, delay}); return id; },
    clearTimeout(id) { timers.delete(id); }
  });
  win.parent = framed ? {} : win;
  for (const key of ['localStorage', 'sessionStorage']) Object.defineProperty(win, key, {get() { throw Error('Storage must not be accessed'); }});
  win.StreamAudio = createAudio(win);
  const base = Object.freeze({enabled: false, password: '', provider: 'obsWebSocket', gain: 1, maxBoost: 1, noiseFloorDb: -120, attack: .1, release: .1});
  const original = win.StreamAudio.createController(base);
  const scope = {add(fn) { cleanups.push(fn); }, dispose() { cleanups.splice(0).reverse().forEach(fn => fn()); }};
  const controller = createSession(win, doc).bind(original, base, scope);
  const find = id => elements.find(el => el.id === id);
  const panel = doc.body.children[0];
  const form = elements.find(el => el.tag === 'form');
  const button = label => elements.find(el => el.tag === 'button' && el.textContent === label);
  const message = elements.find(el => el.attributes.role === 'status');
  const key = () => win.emit('keydown', {key: 'a', ctrlKey: true, altKey: true});
  function submit(secret = '', address = 'ws://127.0.0.1:4455') { find('obs-audio-password').value = secret; find('obs-audio-address').value = address; return form.emit('submit'); }
  function runTimer(id) { const timer = timers.get(id); assert.ok(timer); timers.delete(id); timer.fn(); }
  return {win, doc, base, original, controller, elements, sockets, timers, warnings, scope, find, panel, form, button, message, key, submit, runTimer};
}
function hello(f, auth = false) {
  const socket = f.sockets.at(-1); socket.open();
  socket.message({op: 0, d: {rpcVersion: 1, ...(auth ? {authentication: {salt: 'test-salt', challenge: 'test-challenge'}} : {})}});
  return socket;
}

test('Auto on local origin connects with no password, requests meters only, and hides all setup UI', () => {
  const f = fixture(); f.controller.start(); f.controller.start();
  assert.equal(f.sockets.length, 1); assert.equal(f.sockets[0].url, 'ws://127.0.0.1:4455');
  const socket = hello(f);
  assert.deepEqual(socket.sent, [{op: 1, d: {rpcVersion: 1, eventSubscriptions: 65536}}]);
  socket.message({op: 2, d: {negotiatedRpcVersion: 1}}); f.controller.update(.016);
  assert.equal(f.controller.getStatus(), 'identified'); assert.equal(f.panel.hidden, true); assert.equal(f.timers.size, 0);
});

test('authentication challenge sends no empty-password authentication, prompts and clears the old connection', () => {
  const f = fixture(); f.controller.start(); const socket = hello(f, true);
  assert.equal(f.controller.getStatus(), 'auth-required'); assert.equal(socket.sent.length, 0);
  f.controller.update(.016);
  assert.equal(socket.closes, 1); assert.equal(f.panel.hidden, false); assert.match(f.message.textContent, /requires authentication/);
  assert.equal(f.timers.size, 0); assert.equal(f.find('obs-audio-password').value, '');
});

test('separately entered password authenticates without plaintext transport or persistence', async () => {
  const f = fixture({mode: 'setup'}); f.controller.start();
  assert.equal(f.sockets.length, 0); assert.equal(f.panel.hidden, false);
  const snapshotBefore = snapshots.stringify(f.win.STREAM_SNAPSHOT), hrefBefore = f.win.location.href;
  assert.equal(f.submit('synthetic-session-secret').prevented, true);
  assert.equal(f.find('obs-audio-password').value, '');
  const socket = hello(f, true); await flush();
  assert.equal(socket.sent.length, 1); assert.equal(typeof socket.sent[0].d.authentication, 'string');
  assert.ok(!JSON.stringify(socket.sent).includes('synthetic-session-secret'));
  socket.message({op: 2, d: {negotiatedRpcVersion: 1}}); f.controller.update(.016);
  assert.equal(f.panel.hidden, true); assert.equal(f.win.location.href, hrefBefore);
  assert.equal(snapshots.stringify(f.win.STREAM_SNAPSHOT), snapshotBefore); assert.equal(f.base.password, '');
  assert.ok(!JSON.stringify(f.warnings).includes('synthetic-session-secret'));
  f.scope.dispose(); assert.equal(f.sockets[0].closes, 1); assert.equal(f.timers.size, 0);
});

test('manual setup also permits authentication-disabled OBS and custom local port/input names', () => {
  const f = fixture({mode: 'setup'}); f.controller.start();
  f.find('obs-audio-inputs').value = 'Music'; f.submit('', 'ws://localhost:4456');
  const socket = hello(f); assert.equal(socket.url, 'ws://localhost:4456/');
  assert.equal(Object.hasOwn(socket.sent[0].d, 'authentication'), false);
  socket.message({op: 2}); f.controller.update(.016); assert.equal(f.panel.hidden, true);
});

test('remote origins, embedded previews, Off and legacy paths never create session UI or session connections', () => {
  for (const options of [{href: 'https://example.com/index.html'}, {href: 'http://localhost.evil.test/'}, {href: 'file:///index.html'}, {framed: true}, {mode: 'off'}, {legacy: true}]) {
    const f = fixture(options); assert.equal(f.controller, f.original); f.controller.start();
    assert.equal(f.sockets.length, 0); assert.equal(f.doc.body.children.length, 0); assert.equal(f.timers.size, 0);
  }
});

test('manual endpoint validation blocks remote hosts and credential-bearing URLs before opening sockets', () => {
  const f = fixture({mode: 'setup'}); f.controller.start();
  for (const url of ['ws://remote.example:4455', 'ws://127.0.0.1.evil.test', 'ws://user:synthetic-session-secret@localhost:4455', 'ws://localhost:4455/?token=synthetic-session-secret', 'ws://localhost:4455/#secret', 'ws://localhost:4455/path', 'http://localhost:4455', 'ws://0.0.0.0:4455', 'not a url']) {
    f.submit('synthetic-session-secret', url); assert.equal(f.sockets.length, 0);
    assert.equal(f.find('obs-audio-password').value, ''); assert.ok(!f.message.textContent.includes('synthetic-session-secret'));
  }
});

test('Disable clears the connection but leaves future manual connection usable; closing clears typed password', () => {
  const f = fixture(); f.controller.start(); const old = hello(f);
  old.message({op: 2}); f.controller.update(.016); f.key();
  f.find('obs-audio-password').value = 'unsent-secret'; f.button('Close setup').emit('click');
  assert.equal(f.find('obs-audio-password').value, ''); assert.equal(f.panel.hidden, true);
  f.key(); f.button('Disable audio').emit('click'); assert.equal(old.closes, 1);
  assert.equal(f.controller.getStatus(), 'disabled'); assert.equal(f.timers.size, 0);
  f.submit(); assert.equal(f.sockets.length, 2); assert.equal(f.controller.getStatus(), 'connecting');
});

test('stop/disposal clear credentials, timers, sockets, DOM and hotkey listeners; stale timer cannot orphan a new timer', () => {
  const f = fixture(); f.controller.start();
  const stale = [...f.timers.values()].find(timer => timer.delay === 10000).fn;
  f.controller.stop(); assert.equal(f.timers.size, 0);
  f.submit('unsent-while-stopped'); assert.equal(f.find('obs-audio-password').value, '');
  assert.equal(f.sockets.length, 1);
  f.controller.start(); f.key(); f.submit('new-session-secret');
  assert.equal(f.timers.size, 1); stale(); assert.equal(f.timers.size, 1);
  f.find('obs-audio-password').value = 'unsent-secret'; f.scope.dispose(); f.scope.dispose();
  assert.equal(f.find('obs-audio-password').value, ''); assert.equal(f.timers.size, 0);
  assert.equal(f.doc.body.children.length, 0); assert.equal(f.win.listeners.get('keydown').size, 0);
  assert.equal(f.sockets.at(-1).closes, 1); assert.equal(f.controller.update(.016), 0);
});

test('timeout and failed sockets do not retry indefinitely or force diagnostics onto the clean stream', () => {
  const f = fixture(); f.controller.start(); const socket = f.sockets[0];
  const id = [...f.timers.entries()].find(([, timer]) => timer.delay === 10000)[0]; f.runTimer(id);
  assert.equal(socket.closes, 1); assert.equal(f.timers.size, 0); assert.equal(f.panel.hidden, true);
  assert.match(f.message.textContent, /timed out/);
  f.key(); f.submit(); f.sockets.at(-1).close(); f.controller.update(.016);
  assert.equal(f.timers.size, 0); assert.match(f.message.textContent, /could not connect/);
});

test('dismissed setup is not reopened by a late auth challenge; timeout detects auth even without frame updates', () => {
  const f = fixture(); f.controller.start(); f.key(); f.button('Close setup').emit('click');
  hello(f, true); f.controller.update(.016); assert.equal(f.panel.hidden, true);
  const g = fixture(); g.controller.start(); hello(g, true);
  const id = [...g.timers.keys()][0]; g.runTimer(id); assert.equal(g.panel.hidden, false); assert.equal(g.timers.size, 0);
});

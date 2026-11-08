import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const createAudioRuntime = require('../runtime/audio.js');
const zero = {level: 0, rms: 0, peak: 0, transient: 0, balance: 0};

const sha = value => createHash('sha256').update(value).digest();
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, actual + ' != ' + expected);

function fixture({config = {}, supportsWebSocket = true, throwOpen = false, crypto = true} = {}) {
  const sockets = [], timers = new Map(), scheduled = [], cleared = [], warnings = [], digests = [];
  const deferredDigests = [];
  let nextTimer = 1;
  class Socket {
    constructor(url, protocol) {
      if (throwOpen) throw Error('synthetic connection failure');
      this.url = url; this.protocol = protocol; this.readyState = 0; this.sent = []; this.closeCalls = 0;
      sockets.push(this);
    }
    open() { this.readyState = 1; this.onopen?.(); }
    message(payload) { this.onmessage?.({data: typeof payload === 'string' ? payload : JSON.stringify(payload)}); }
    send(payload) { this.sent.push(JSON.parse(payload)); }
    close() { this.closeCalls++; this.readyState = 3; this.onclose?.(); }
  }
  const window = {
    WebSocket: supportsWebSocket ? Socket : undefined,
    console: {warn: (...args) => warnings.push(args)},
    TextEncoder,
    btoa: value => Buffer.from(value, 'binary').toString('base64'),
    setTimeout(callback, delay) { const id = nextTimer++; timers.set(id, callback); scheduled.push({id, delay}); return id; },
    clearTimeout(id) { cleared.push(id); timers.delete(id); },
  };
  if (crypto === false) {
    // no crypto
  } else if (crypto === 'deferred') {
    window.crypto = {subtle: {digest(algorithm, bytes) {
      assert.equal(algorithm, 'SHA-256');
      digests.push(new TextDecoder().decode(bytes));
      const record = {bytes: new Uint8Array(bytes).slice(), resolve: null, reject: null};
      const promise = new Promise((resolve, reject) => { record.resolve = resolve; record.reject = reject; });
      deferredDigests.push(record);
      return promise;
    }}};
  } else {
    window.crypto = {subtle: {digest(algorithm, bytes) {
      assert.equal(algorithm, 'SHA-256');
      digests.push(new TextDecoder().decode(bytes));
      const data = createHash('sha256').update(bytes).digest();
      return Promise.resolve(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
    }}};
  }
  const controller = createAudioRuntime(window).createController({...{
    enabled: true, provider: 'obsWebSocket', gain: 1, attack: 1, release: 1,
    maxBoost: 1, noiseFloorDb: -120, reconnectBaseMs: 300, reconnectMaxMs: 800, targetInputs: []
  }, ...config});
  function runReconnect() {
    assert.equal(timers.size, 1);
    const [id, callback] = timers.entries().next().value;
    timers.delete(id); callback();
  }
  function resolveDeferred(index, value) {
    const record = deferredDigests[index];
    assert.ok(record, 'missing deferred digest ' + index);
    const data = value || createHash('sha256').update(record.bytes).digest();
    record.resolve(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
  }
  function rejectDeferred(index, error) {
    const record = deferredDigests[index];
    assert.ok(record, 'missing deferred digest ' + index);
    record.reject(error || new Error('synthetic auth failure'));
  }
  return {controller, window, sockets, timers, scheduled, cleared, warnings, digests, deferredDigests, runReconnect, resolveDeferred, rejectDeferred};
}

function connect(f) { f.controller.start(); const socket = f.sockets.at(-1); socket.open(); return socket; }
function meters(socket, inputs) { socket.message({op: 5, d: {eventType: 'InputVolumeMeters', eventData: {inputs}}}); }
const input = (name, magnitude = 0.4, peak = 0.8) => ({inputName: name, inputLevelsMul: [[magnitude, peak], [magnitude / 2, peak * 0.75]]});

test('duplicate start is idempotent and duplicate stop is idempotent', () => {
  const f = fixture(); const socket = connect(f);
  f.controller.start(); f.controller.start();
  assert.equal(f.sockets.length, 1);
  f.controller.stop(); f.controller.stop();
  assert.equal(socket.closeCalls, 1);
  assert.equal(f.timers.size, 0);
  assert.deepEqual(f.controller.getFeatures(), zero);
});

test('start resets reconnect attempt and meter state after a stopped session', () => {
  const f = fixture(); let socket = connect(f);
  for (const expected of [300, 465]) {
    socket.close(); socket.onclose();
    near(f.scheduled.at(-1).delay, expected);
    f.runReconnect(); socket = f.sockets.at(-1); socket.open();
  }
  socket.close(); socket.onclose();
  f.controller.stop();
  assert.equal(f.timers.size, 0);
  f.controller.start();
  const restarted = f.sockets.at(-1); restarted.open();
  restarted.close(); restarted.onclose();
  assert.equal(f.scheduled.at(-1).delay, 300);
  assert.deepEqual(f.controller.getFeatures(), zero);
});

test('pending reconnect timer is cancelled by stop and cannot fire', () => {
  const f = fixture({throwOpen: true});
  f.controller.start();
  assert.equal(f.timers.size, 1);
  const callback = [...f.timers.values()][0];
  f.controller.stop();
  assert.equal(f.timers.size, 0);
  // callback may be a no-op now; ensure no new socket
  assert.doesNotThrow(() => callback());
  assert.equal(f.sockets.length, 0);
});

test('stale socket callbacks cannot affect a restarted connection', () => {
  const f = fixture();
  const oldSocket = connect(f);
  const onOpen = oldSocket.onopen;
  const onMessage = oldSocket.onmessage;
  const onError = oldSocket.onerror;
  const onClose = oldSocket.onclose;

  f.controller.stop();
  f.controller.start();
  const newSocket = f.sockets.at(-1);
  newSocket.open();

  // stale callbacks should be inert
  onOpen();
  onError();
  onMessage({data: JSON.stringify({op: 5, d: {eventType: 'InputVolumeMeters', eventData: {inputs: [{inputName: 'Mic', inputLevelsMul: [[1, 1]]}]}}})});
  onClose();

  assert.equal(newSocket.closeCalls, 0);
  assert.equal(f.timers.size, 0);
  // new socket remains usable
  meters(newSocket, [input('Mic')]);
  assert.ok(f.controller.update(0.1) >= 0);
});

test('old close callback does not schedule reconnect for a new run', () => {
  const f = fixture();
  const oldSocket = connect(f);
  const onClose = oldSocket.onclose;
  f.controller.stop();
  f.controller.start();
  const newSocket = f.sockets.at(-1);
  newSocket.open();
  // invoking stale close must not create a timer or close new socket
  onClose();
  assert.equal(f.timers.size, 0);
  assert.equal(newSocket.closeCalls, 0);
});

test('late auth success does not send or close after stop/restart', async () => {
  const f = fixture({crypto: 'deferred'});
  const oldSocket = connect(f);
  oldSocket.message({op: 0, d: {rpcVersion: 1, authentication: {salt: 's', challenge: 'c'}}});
  assert.equal(f.deferredDigests.length, 1);

  f.controller.stop();
  f.controller.start();
  const newSocket = f.sockets.at(-1);
  newSocket.open();

  // resolve both deferred digests now; old auth must not affect anything
  f.resolveDeferred(0);
  await flush();
  if (f.deferredDigests.length > 1) f.resolveDeferred(1);
  await flush();

  assert.equal(oldSocket.sent.length, 0);
  assert.equal(newSocket.sent.length, 0);
  assert.equal(newSocket.closeCalls, 0);
});

test('late auth failure does not close a newer socket', async () => {
  const f = fixture({crypto: 'deferred'});
  const oldSocket = connect(f);
  oldSocket.message({op: 0, d: {rpcVersion: 1, authentication: {salt: 's', challenge: 'c'}}});

  f.controller.stop();
  f.controller.start();
  const newSocket = f.sockets.at(-1);
  newSocket.open();

  f.rejectDeferred(0, new Error('synthetic auth failure'));
  await flush();

  assert.equal(newSocket.closeCalls, 0);
  assert.equal(f.timers.size, 0);
});

test('late auth failure before stop closes only the originating socket', async () => {
  const f = fixture({crypto: 'deferred'});
  const socket = connect(f);
  socket.message({op: 0, d: {rpcVersion: 1, authentication: {salt: 's', challenge: 'c'}}});

  f.rejectDeferred(0, new Error('synthetic auth failure'));
  await flush();

  assert.equal(socket.closeCalls, 1);
});

test('stop zeroes feature state and update stays zero', () => {
  const f = fixture();
  const socket = connect(f);
  meters(socket, [input('Mic')]);
  f.controller.update(0.1);
  assert.ok(f.controller.getFeatures().level > 0 || f.controller.getFeatures().peak > 0);
  f.controller.stop();
  assert.deepEqual(f.controller.getFeatures(), zero);
  assert.equal(f.controller.update(0.1), 0);
  assert.deepEqual(f.controller.getFeatures(), zero);
});

test('warnings do not include passwords, urls, or raw error payloads', async () => {
  const f = fixture({config: {password: 'synthetic-secret', url: 'ws://secret-host:4455'}, throwOpen: true});
  f.controller.start();
  // trigger auth path with crypto failure
  const g = fixture({config: {password: 'synthetic-secret'}, crypto: 'deferred'});
  const socket = connect(g);
  socket.message({op: 0, d: {rpcVersion: 1, authentication: {salt: 's', challenge: 'c'}}});
  g.rejectDeferred(0, new Error('synthetic-secret ws://secret-host boom'));
  await flush();
  assert.ok(g.warnings.length > 0);
  for (const warning of f.warnings.concat(g.warnings)) {
    const text = warning.map(String).join(' ');
    assert.ok(!text.includes('synthetic-secret'), text);
    assert.ok(!text.includes('secret-host'), text);
    assert.ok(!text.includes('boom'), text);
  }
});

test('stale reconnect timer cannot clear or orphan a newer run timer', () => {
  const f = fixture();
  const old = connect(f); old.close();
  const stale = [...f.timers.values()][0];
  f.controller.stop(); f.controller.start();
  const current = f.sockets.at(-1); current.open(); current.close();
  assert.equal(f.timers.size, 1);
  stale();
  f.controller.stop();
  assert.equal(f.timers.size, 0, 'new timer must still be tracked and cancellable');
});

test('failed Identify send closes only its socket and uses a safe warning', () => {
  const f = fixture(), socket = connect(f);
  socket.send = () => { throw Error('synthetic-secret'); };
  assert.doesNotThrow(() => socket.message({op: 0, d: {rpcVersion: 1}}));
  assert.equal(socket.closeCalls, 1);
  assert.ok(f.warnings.some(w => w[0] === 'Audio websocket send failed.'));
  assert.ok(!JSON.stringify(f.warnings).includes('synthetic-secret'));
});

test('auth success still sends identify on an open current socket', async () => {
  const f = fixture({crypto: 'deferred'});
  const socket = connect(f);
  socket.message({op: 0, d: {rpcVersion: 1, authentication: {salt: 's', challenge: 'c'}}});
  f.resolveDeferred(0);
  await flush();
  if (f.deferredDigests.length > 1) f.resolveDeferred(1);
  await flush();
  assert.equal(socket.sent.length, 1);
  assert.equal(typeof socket.sent[0].d.authentication, 'string');
  assert.ok(!JSON.stringify(socket.sent).includes('synthetic'));
});

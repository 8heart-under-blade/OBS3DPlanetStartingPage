import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const createAudioRuntime = require('../runtime/audio.js');
const zero = {level: 0, rms: 0, peak: 0, transient: 0, balance: 0};
const defaults = {enabled: true, provider: 'obsWebSocket', gain: 1, attack: 1, release: 1,
  maxBoost: 1, noiseFloorDb: -120, reconnectBaseMs: 300, reconnectMaxMs: 800, targetInputs: []};
const sha = value => createHash('sha256').update(value).digest('base64');
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, actual + ' != ' + expected);

function fixture({config = {}, supportsWebSocket = true, throwOpen = false, crypto = true} = {}) {
  const sockets = [], timers = new Map(), scheduled = [], cleared = [], warnings = [], digests = [];
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
  if (crypto) window.crypto = {subtle: {digest(algorithm, bytes) {
    assert.equal(algorithm, 'SHA-256');
    digests.push(new TextDecoder().decode(bytes));
    const data = createHash('sha256').update(bytes).digest();
    return Promise.resolve(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
  }}};
  const controller = createAudioRuntime(window).createController({...defaults, ...config});
  function runReconnect() {
    assert.equal(timers.size, 1);
    const [id, callback] = timers.entries().next().value;
    timers.delete(id); callback();
  }
  return {controller, window, sockets, timers, scheduled, cleared, warnings, digests, runReconnect};
}

function connect(f) { f.controller.start(); const socket = f.sockets.at(-1); socket.open(); return socket; }
function meters(socket, inputs) { socket.message({op: 5, d: {eventType: 'InputVolumeMeters', eventData: {inputs}}}); }
const input = (name, magnitude = 0.4, peak = 0.8) => ({inputName: name, inputLevelsMul: [[magnitude, peak], [magnitude / 2, peak * 0.75]]});

function assertFeatures(features) {
  for (const key of ['level', 'rms', 'peak', 'transient']) assert.ok(Number.isFinite(features[key]) && features[key] >= 0 && features[key] <= 1, key);
  assert.ok(Number.isFinite(features.balance) && features.balance >= -1 && features.balance <= 1);
}

test('disabled, unsupported provider and missing WebSocket preserve the no-op contract', () => {
  for (const options of [{config: {enabled: false}}, {config: {provider: 'other'}}, {config: {provider: undefined}}, {supportsWebSocket: false}]) {
    const f = fixture(options); f.controller.start();
    assert.equal(f.controller.update(0.1), 0);
    assert.deepEqual(f.controller.getFeatures(), zero);
    f.controller.stop();
    assert.equal(f.sockets.length, 0); assert.equal(f.timers.size, 0);
    assert.equal(f.warnings.length, options.supportsWebSocket === false ? 1 : 0);
  }
});

test('start is connection-idempotent, preserves URL/subprotocol, and stop closes without reconnect', () => {
  const f = fixture({config: {url: ' ws://127.0.0.1:4456 '}});
  const socket = connect(f); f.controller.start();
  assert.equal(f.sockets.length, 1);
  assert.equal(socket.url, 'ws://127.0.0.1:4456');
  assert.equal(socket.protocol, 'obswebsocket.json');
  f.controller.stop(); f.controller.stop();
  assert.equal(socket.closeCalls, 1); assert.equal(f.timers.size, 0);
  f.controller.start(); assert.equal(f.sockets.length, 2);
  f.controller.stop();
  const blank = fixture({config: {url: ' '}}); connect(blank);
  assert.equal(blank.sockets[0].url, 'ws://127.0.0.1:4455');
});

test('close schedules one capped exponential reconnect and identification resets the backoff', () => {
  const f = fixture(); let socket = connect(f);
  for (const expected of [300, 465, 720.75, 800]) {
    socket.close(); socket.onclose();
    near(f.scheduled.at(-1).delay, expected);
    assert.equal(f.timers.size, 1);
    f.runReconnect(); socket = f.sockets.at(-1); socket.open();
  }
  socket.message({op: 2, d: {negotiatedRpcVersion: 1}}); socket.close();
  assert.equal(f.scheduled.at(-1).delay, 300);
  const id = f.scheduled.at(-1).id;
  f.controller.stop(); assert.deepEqual(f.cleared, [id]); assert.equal(f.timers.size, 0);
});

test('constructor failure schedules backoff and stop cancels it', () => {
  const f = fixture({throwOpen: true});
  f.controller.start(); assert.equal(f.warnings.length, 1); assert.equal(f.timers.size, 1);
  f.runReconnect(); assert.equal(f.warnings.length, 2); near(f.scheduled.at(-1).delay, 465);
  f.controller.stop(); assert.equal(f.timers.size, 0);
});

test('Hello identifies with the existing RPC and volume-meter subscription mask', () => {
  for (const [version, expected] of [[undefined, 1], [-1, 1], [2.9, 2], ['3', 1]]) {
    const f = fixture(), socket = connect(f);
    socket.message({op: 0, d: {rpcVersion: version}});
    assert.deepEqual(socket.sent, [{op: 1, d: {rpcVersion: expected, eventSubscriptions: 2047 | (1 << 16)}}]);
  }
  const f = fixture(); f.controller.start();
  f.sockets[0].message({op: 0, d: {rpcVersion: 1}});
  assert.equal(f.sockets[0].sent.length, 0, 'Identify only sent on an open socket');
});

test('authentication preserves OBS double-SHA256/base64 protocol without sending plaintext password', async () => {
  const password = 'synthetic-test-password', salt = 'synthetic-salt', challenge = 'synthetic-challenge';
  const f = fixture({config: {password}}), socket = connect(f);
  socket.message({op: 0, d: {rpcVersion: 1, authentication: {salt, challenge}}});
  await flush();
  const secret = sha(password + salt), authentication = sha(secret + challenge);
  assert.deepEqual(f.digests, [password + salt, secret + challenge]);
  assert.deepEqual(socket.sent, [{op: 1, d: {rpcVersion: 1, eventSubscriptions: 2047 | (1 << 16), authentication}}]);
  assert.ok(!JSON.stringify(socket.sent).includes(password)); assert.equal(f.warnings.length, 0);
});

test('missing Web Crypto authentication closes safely and stop prevents a late auth send', async () => {
  const noCrypto = fixture({crypto: false}), socket = connect(noCrypto);
  socket.message({op: 0, d: {authentication: {salt: 's', challenge: 'c'}}});
  await flush();
  assert.equal(socket.sent.length, 0); assert.equal(socket.closeCalls, 1);
  assert.equal(noCrypto.warnings.length, 1); assert.equal(noCrypto.timers.size, 1);
  noCrypto.controller.stop(); assert.equal(noCrypto.timers.size, 0);
  const stopped = fixture(), stoppedSocket = connect(stopped);
  stoppedSocket.message({op: 0, d: {authentication: {salt: 's', challenge: 'c'}}});
  stopped.controller.stop(); await flush();
  assert.equal(stoppedSocket.sent.length, 0); assert.equal(stopped.timers.size, 0);
});

test('meter smoothing retains level math, feature ranges, balance and decay', () => {
  const f = fixture(), socket = connect(f);
  meters(socket, [input('Desktop Audio')]);
  const boost = f.controller.update(0.1), features = f.controller.getFeatures();
  const target = Math.max(0.8 * Math.exp(-0.78), 0.8 * Math.exp(-0.96));
  near(boost, target * (1 - Math.exp(-1.2)));
  near(features.level, boost);
  assertFeatures(features); assert.ok(features.balance < 0); assert.ok(features.transient > 0);
  const snapshot = {...features};
  for (let i = 0; i < 200; i++) f.controller.update(0.1);
  assertFeatures(features); assert.ok(features.level < snapshot.level * 0.00001);
  assert.equal(f.controller.getFeatures(), features, 'enabled controller reuses its snapshot');
});

test('target input names are trimmed/case-normalized and unmatched filters warn once then fall back', () => {
  const filtered = fixture({config: {targetInputs: [' Desktop Audio ', 'desktop audio', null]}});
  const reference = fixture(), all = fixture();
  const a = connect(filtered), b = connect(reference), c = connect(all);
  meters(a, [input('DESKTOP AUDIO', 0.1, 0.2), input('Mic', 1, 1)]);
  meters(b, [input('Desktop Audio', 0.1, 0.2)]);
  filtered.controller.update(0.1); reference.controller.update(0.1);
  assert.deepEqual(filtered.controller.getFeatures(), reference.controller.getFeatures());
  assert.equal(filtered.warnings.length, 0);
  const fallback = fixture({config: {targetInputs: ['missing']}}), d = connect(fallback);
  for (let i = 0; i < 2; i++) {
    meters(d, [input('Mic')]); meters(c, [input('Mic')]);
    fallback.controller.update(0.1); all.controller.update(0.1);
  }
  assert.deepEqual(fallback.controller.getFeatures(), all.controller.getFeatures());
  assert.equal(fallback.warnings.length, 1);
});

test('linear and dB fallback inputs preserve equivalent magnitudes', () => {
  for (const [linearKey, dbKey] of [['inputLevelMul', 'inputLevelDb'], ['inputPeakMul', 'inputPeakDb']]) {
    const a = fixture(), b = fixture();
    meters(connect(a), [{inputName: 'a', [linearKey]: 0.1}]);
    meters(connect(b), [{inputName: 'a', [dbKey]: -20}]);
    near(a.controller.update(0.1), b.controller.update(0.1));
    assert.deepEqual(a.controller.getFeatures(), b.controller.getFeatures());
  }
});

test('malformed/unrelated messages and bounded malformed meter payloads do not poison features', () => {
  const f = fixture(), socket = connect(f);
  for (const message of ['not-json', 'null', '{}', '{"op":"5"}', {op: 5, d: {eventType: 'Other'}},
    {op: 5, d: {eventType: 'InputVolumeMeters', eventData: null}}]) socket.message(message);
  assert.equal(f.controller.update(0.1), 0);
  let deep = 1;
  for (let i = 0; i < 8; i++) deep = {next: deep};
  meters(socket, [null, {inputLevelsMul: [[-1, null], ['invalid', 'invalid']]}, {inputLevelDb: -150},
    {inputLevelMul: deep}]);
  assert.equal(f.controller.update(0.1), 0); assertFeatures(f.controller.getFeatures());
  meters(socket, [{inputPeakMul: 100}]); assertFeatures(f.controller.getFeatures());
  assert.ok(f.controller.update(0.1) <= 1);
});

test('invalid frame deltas retain the original 16ms fallback and maxBoost remains bounded', () => {
  for (const delta of [0, -1, NaN, undefined]) {
    const a = fixture({config: {maxBoost: 0.5}}), b = fixture({config: {maxBoost: 0.5}});
    meters(connect(a), [input('a')]); meters(connect(b), [input('a')]);
    near(a.controller.update(delta), b.controller.update(0.016));
    assert.ok(a.controller.update(0.1) <= 0.5);
  }
});

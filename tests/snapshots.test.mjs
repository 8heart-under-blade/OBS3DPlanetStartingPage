import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const snapshots = require('../runtime/snapshots.js')();
const tokenFromText = text => Buffer.from(text, 'utf8').toString('base64url');

test('audio mode is a nonsecret enum; previous snapshots stay Off and credentials remain rejected', () => {
  const old = snapshots.defaults(); delete old.audioMode;
  assert.equal(snapshots.parse(JSON.stringify(old)).audioMode, 'off');
  for (const audioMode of ['off', 'auto', 'setup']) {
    const preset = {...snapshots.defaults(), audioMode};
    const copy = snapshots.decode(snapshots.encode(preset));
    assert.equal(copy.audioMode, audioMode);
    const applied = snapshots.apply(copy, {audioReactive: {enabled: true, password: 'synthetic-secret'}});
    assert.equal(applied.audioReactive.enabled, false); assert.equal(applied.audioReactive.password, '');
  }
  for (const audioMode of [true, false, {}, [], null, 'enabled', 'constructor']) {
    assert.throws(() => snapshots.validate({...snapshots.defaults(), audioMode}));
  }
  for (const field of ['password', 'url', 'targetInputs', 'audioReactive']) {
    assert.throws(() => snapshots.validate({...snapshots.defaults(), audioMode: 'auto', [field]: 'synthetic-secret'}));
  }
});

test('local audio capability uses exact loopback HTTP origins, not physical-PC or remote-prefix detection', () => {
  for (const url of ['http://localhost:8080/', 'http://127.0.0.1/', 'https://[::1]:8080/']) assert.equal(snapshots.supportsLocalAudio(url), true);
  for (const url of ['https://example.com/', 'http://localhost.evil.test/', 'http://127.0.0.1.evil.test/', 'http://192.168.1.2/', 'file:///index.html', 'ws://localhost/', 'http://user:password@localhost/', 'not a url']) assert.equal(snapshots.supportsLocalAudio(url), false);
});

test('defaults and canonical snapshot encoding are deterministic and independent', () => {
  const a = snapshots.defaults(), b = snapshots.defaults();
  a.scenes.starting.title = 'Custom';
  assert.notEqual(a.scenes.starting.title, b.scenes.starting.title);
  assert.deepEqual(snapshots.decode(snapshots.encode(a)), a);
  assert.equal(snapshots.encode(a), snapshots.encode(snapshots.parse(snapshots.stringify(a))));
});

test('Unicode, emoji and literal HTML text round-trip without becoming executable config', () => {
  const preset = snapshots.defaults();
  preset.scenes.starting.title = '星空 café 😀 <img src=x onerror=alert(1)>';
  assert.deepEqual(snapshots.decode(snapshots.encode(preset)), preset);
  const applied = snapshots.apply(preset, {});
  assert.equal(applied.overlay.title, preset.scenes.starting.title);
  assert.equal(applied.overlay.externalFontStylesheets.length, 0);
  assert.ok(applied.overlay.customFontFaces.every(face => ['@cinzel-decorative.ttf', '@macondo.ttf'].includes(face.src)));
});

test('strict preset allowlists reject credential fields, executable config and prototype names', () => {
  const cases = [
    {...snapshots.defaults(), password: 'synthetic-secret'},
    {...snapshots.defaults(), audioReactive: {password: 'synthetic-secret'}},
    {schemaVersion: 1, scenes: {starting: {token: 'synthetic-secret'}}},
    {schemaVersion: 1, scenes: {starting: {customFontFaces: [{src: 'https://private.example/font'}]}}},
    {schemaVersion: 1, scenes: {starting: {titleFont: 'url(https://private.example/font)'}}},
    JSON.parse('{"schemaVersion":1,"__proto__":{"polluted":true}}'),
    JSON.parse('{"schemaVersion":1,"scenes":{"starting":{"constructor":{}}}}'),
    {schemaVersion: 1, scenes: {constructor: {title: 'x'}}},
  ];
  for (const value of cases) {
    assert.throws(() => snapshots.validate(value), error => !String(error).includes('synthetic-secret') && !String(error).includes('private.example'));
  }
  assert.equal({}.polluted, undefined);
});

test('bounds reject long text, controls, bad enums and nonfinite/nonnumeric positions', () => {
  for (const value of [
    {title: 'x'.repeat(121)}, {subtitle: 'x'.repeat(241)}, {title: 'bad' + String.fromCharCode(0) + 'text'},
    {topVh: -1}, {topVh: 41}, {topVh: NaN}, {topVh: '12'},
    {titleSpacing: Infinity}, {subtitleSpacing: 0.41}, {titleFont: '__proto__'},
  ]) assert.throws(() => snapshots.validate({schemaVersion: 1, scenes: {starting: value}}));
  assert.throws(() => snapshots.validate({schemaVersion: 1, reducedMotion: 'false'}));
  assert.throws(() => snapshots.validate({schemaVersion: 1, quality: 'constructor'}));
  assert.equal(snapshots.validate({schemaVersion: 1, scenes: {starting: {title: '', topVh: 0, titleSpacing: 0}}}).scenes.starting.title, '');
});

test('decoded UTF-8 and complete URL budgets are enforced without truncation', () => {
  assert.throws(() => snapshots.parse(' '.repeat(8193)), /8 KiB/);
  assert.throws(() => snapshots.parse('😀'.repeat(3000)), /8 KiB/);
  assert.throws(() => snapshots.decode('a'.repeat(12000)), /too large/);
  const preset = snapshots.defaults();
  for (const scene of Object.values(preset.scenes)) { scene.title = '😀'.repeat(120); scene.subtitle = '星'.repeat(240); }
  assert.deepEqual(snapshots.decode(snapshots.encode(preset)), preset);
  assert.ok(snapshots.toUrl(preset, 'thanks', 'https://example.test/repo/editor.html').length <= snapshots.MAX_URL);
  assert.throws(() => snapshots.toUrl(preset, 'starting', 'https://example.test/' + 'x'.repeat(12000) + '/editor.html'), /too long/);
});

test('malformed encodings, invalid UTF-8, corrupt JSON and unsupported versions fail visibly', () => {
  for (const token of ['', '=', '%%%bad', 'ab+c', 'a', '_w', tokenFromText('{bad'), tokenFromText('{"schemaVersion":2}')]) {
    assert.throws(() => snapshots.decode(token));
  }
  for (const value of [null, [], {}, {schemaVersion: '1'}, {schemaVersion: 9}, {schemaVersion: 1, scenes: []}]) assert.throws(() => snapshots.validate(value));
  assert.throws(() => snapshots.validate(Object.create({schemaVersion: 1})), /version/);
});

test('documented schema 0 prototype migrates and does not smuggle unknown fields', () => {
  const preset = snapshots.parse('{"schemaVersion":0,"title":"Old title","subtitle":"Old subtitle","quality":"low"}');
  assert.equal(preset.schemaVersion, 1); assert.equal(preset.quality, 'low');
  assert.equal(preset.scenes.starting.title, 'Old title');
  assert.equal(preset.scenes.brb.title, 'BE RIGHT BACK');
  assert.throws(() => snapshots.parse('{"schemaVersion":0,"title":"x","password":"secret"}'), /unsafe/);
});

test('fragments preserve legacy anchors but strictly reject ambiguous preset requests', () => {
  assert.equal(snapshots.fromHash(''), null);
  assert.equal(snapshots.fromHash('#old-anchor'), null);
  const preset = snapshots.defaults(), encoded = snapshots.encode(preset);
  assert.deepEqual(snapshots.fromHash('#preset=' + encoded), preset);
  for (const hash of ['#preset', '#preset=', '#Preset=' + encoded, '#%70reset=' + encoded,
    '#preset=' + encoded + '&extra=1', '#x=1&preset=' + encoded, '#preset=' + encoded + '&preset=' + encoded]) {
    assert.throws(() => snapshots.fromHash(hash));
  }
});

test('generated URLs use fixed scene pages at repository subpaths, not editor storage or base secrets', () => {
  const preset = snapshots.defaults();
  for (const [scene, page] of [['starting', 'index.html'], ['brb', 'brb.html'], ['thanks', 'thanks.html']]) {
    const value = snapshots.toUrl(preset, scene, 'https://example.test/repo/editor.html?token=synthetic-secret#old');
    const url = new URL(value);
    assert.equal(url.pathname, '/repo/' + page);
    assert.equal(url.search, '?assets=offline');
    assert.ok(!value.includes('synthetic-secret'));
    assert.deepEqual(snapshots.fromHash(url.hash), preset);
  }
  assert.throws(() => snapshots.toUrl(preset, '__proto__', 'https://example.test/editor.html'));
  for (const base of ['javascript:alert(1)', 'file:///C:/editor.html', 'https://user:secret@example.test/editor.html']) {
    assert.throws(() => snapshots.toUrl(preset, 'starting', base), /HTTP/);
  }
});

test('applying a snapshot is nonmutating and always excludes audio credentials from the render path', () => {
  const base = {audioReactive: {enabled: true, password: 'synthetic-secret', gain: 3.5},
    overlay: {externalFontStylesheets: ['https://private.example/font.css']}, thanksScene: {earthRadius: 8.8}};
  const before = structuredClone(base), preset = snapshots.defaults();
  preset.quality = 'low';
  const config = snapshots.apply(preset, base);
  assert.deepEqual(base, before);
  assert.equal(config.audioReactive.enabled, false);
  assert.equal(config.audioReactive.password, '');
  assert.equal(config.audioReactive.gain, 3.5);
  assert.equal(config.thanksScene.earthRadius, 8.8);
  assert.deepEqual(config.overlay.externalFontStylesheets, []);
  assert.equal(config.quality, 'low');
  assert.ok(!snapshots.stringify(preset).includes('synthetic-secret'));
});

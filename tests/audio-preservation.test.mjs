import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { repoRoot } from '../scripts/lib.mjs';
import { restoreIntegration } from './helpers/restore-integration.mjs';
import { audioFunctionNames, functionSource, restoreAudio } from './helpers/restore-audio.mjs';
const root = repoRoot();
const read = file => readFileSync(join(root, file), 'utf8');

test('audio extraction reconstructs the entire previous scene scripts byte-for-byte', () => {
  const baseline = JSON.parse(read('docs/source-baseline-p1-overlay.json'));
  const audio = read('tests/fixtures/audio-before-lifecycle.js');
  const archived = JSON.parse(read('docs/source-baseline-p1-audio.json')).files.find(file => file.path === 'runtime/audio.js');
  assert.equal(createHash('sha256').update(audio).digest('hex'), archived.sha256, 'archive matches the approved slice 3 runtime');
  for (const scene of ['main.js', 'brb.js', 'thanks.js']) {
    const current = restoreIntegration(read(scene), scene);
    assert.ok(current.includes('window.StreamAudio.createController(CONFIG.audioReactive)'));
    assert.ok(current.includes('function normalizeAudioReactiveMode('), 'render-mode selection stays local');
    for (const name of audioFunctionNames) assert.ok(!current.includes('  function ' + name + '('), name);
    for (const dependency of ['clamp01', 'clampSigned', 'ensureArray']) {
      assert.equal(functionSource(audio, dependency), functionSource(current, dependency), dependency);
    }
    const restored = restoreAudio(current, audio, scene);
    const expected = baseline.files.find(file => file.path === scene);
    assert.equal(Buffer.byteLength(restored), expected.bytes, scene);
    assert.equal(createHash('sha256').update(restored).digest('hex'), expected.sha256, scene);
    assert.ok(current.includes('audioReactive.stop();'), 'original unload stop retained');
  }
});

test('audio lifecycle hardening leaves meter/auth helpers and smoothing formulas unchanged', () => {
  const before = read('tests/fixtures/audio-before-lifecycle.js'), current = read('runtime/audio.js');
  for (const name of audioFunctionNames.filter(name => name !== 'createAudioReactiveController').concat(['clamp01', 'clampSigned', 'ensureArray'])) {
    assert.equal(functionSource(current, name), functionSource(before, name), name);
  }
  for (const name of ['update', 'ingestVolumeEvent']) {
    const extract = source => {
      const a = source.indexOf('    function ' + name + '(');
      const b = source.indexOf('\n    }\n', a) + 7;
      assert.ok(a >= 0 && b > a, name);
      return source.slice(a, b);
    };
    assert.equal(extract(current), extract(before), name);
  }
});

test('browser audio wrapper installs its API without opening sockets or scheduling reconnects', () => {
  let sockets = 0, timers = 0;
  const window = {console, WebSocket: function () { sockets++; }, setTimeout() { timers++; }};
  vm.runInNewContext(read('runtime/audio.js'), {window});
  assert.equal(typeof window.StreamAudio.createController, 'function');
  assert.equal(sockets, 0);
  assert.equal(timers, 0);
});

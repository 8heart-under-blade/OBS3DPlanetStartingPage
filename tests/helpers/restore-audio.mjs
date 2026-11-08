import assert from 'node:assert/strict';

export const audioFunctionNames = ['createAudioReactiveController', 'normalizeInputFilters', 'normalizeInputName',
  'mergeMeterFeatures', 'extractInputMeterFeatures', 'extractInputMeterLevel', 'extractLinearMeterPeak',
  'extractDbMeterPeak', 'collectNumericSamples', 'dbToLinear', 'createObsWebSocketAuth',
  'sha256Base64', 'arrayBufferToBase64'];

export function functionSource(source, name) {
  const start = source.indexOf('  function ' + name + '(');
  assert.ok(start >= 0, name);
  const end = source.indexOf('\n  }\n', start) + 5;
  assert.ok(end > start, name);
  return source.slice(start, end);
}

export function restoreAudio(sceneSource, audioSource, scene) {
  let source = sceneSource.replace('window.StreamAudio.createController(CONFIG.audioReactive);', 'createAudioReactiveController(CONFIG.audioReactive);');
  const lastAnchor = scene === 'main.js' ? '\n  var sunFaculaAlphaMap = ' :
    scene === 'brb.js' ? '\n\n  function pickDefined(' : '\n\n  function normalizeOptionalUrl(';
  const groups = [[audioFunctionNames.slice(0, 3), '\n  function normalizeAudioReactiveMode('],
    [audioFunctionNames.slice(3), lastAnchor]];
  for (const [names, anchor] of groups) {
    assert.ok(source.includes(anchor), scene + ': audio insertion anchor');
    source = source.replace(anchor, names.map(name => functionSource(audioSource, name)).join('\n') + anchor);
  }
  return source;
}

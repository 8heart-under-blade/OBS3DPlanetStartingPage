import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { repoRoot } from '../scripts/lib.mjs';
const root = repoRoot();

test('snapshot reduced motion freezes scene clocks while still rendering loaded assets; legacy motion stays active', () => {
  for (const file of ['main.js', 'brb.js', 'thanks.js']) {
    const source = readFileSync(join(root, file), 'utf8');
    const a = source.indexOf('  function animate() {'), b = source.indexOf('\n  }\n', a) + 5;
    assert.ok(a > 0 && b > a, file);
    for (const reduced of [false, true]) {
      let clockCalls = 0, renderCalls = 0, deltaSeen, elapsedSeen;
      const context = {
        window: {STREAM_REDUCED_MOTION: reduced, StreamRecovery: {report() { throw Error('unexpected rendering failure'); }}},
        runtimeScope: {isDisposed: () => false, requestFrame() {}, dispose() {}}, contextWatcher: {isLost: () => false},
        clock: {getDelta() { clockCalls++; return 0.016; }, getElapsedTime() { clockCalls++; return 5; }},
        audioReactive: {update(delta) { deltaSeen = delta; return 0; }, getFeatures: () => ({})},
        CONFIG: {simulation: {daysPerSecond: 3.6}, sun: {cycleSeconds: 56}, audioReactive: {glowInfluence: 0.3}, brbBlackholeReplacement: {enabled: true}},
        initialDays: 100, simDays: 0, scene: {}, camera: {}, renderer: {render() { renderCalls++; }},
        stars: {rotation: {x: 0, y: 0}}, sun: {rotation: {y: 0}}, sunGlow: {scale: {set() {}}, material: {}}, sunLight: {}, sunActivityEnabled: false,
        updatePlanets() {}, updateCamera() {}, updateSceneAtmosphere() {}, updateBlackHole() {}, updateEarthSystem() {}, rebuildGravityBodies() {}, updateLights() {},
        updateFabric(elapsed) { elapsedSeen = elapsed; }, updateWarpField(elapsed) { elapsedSeen = elapsed; },
      };
      const animate = vm.runInNewContext('(' + source.slice(a, b).trim() + ')', context);
      animate();
      assert.equal(clockCalls, reduced ? 0 : 2, file);
      assert.equal(deltaSeen, reduced ? 0 : 0.016, file);
      assert.equal(elapsedSeen, reduced ? 0 : 5, file);
      assert.equal(renderCalls, 1, file);
      if (reduced) assert.equal(context.stars.rotation.y, 0, file);
      else assert.ok(context.stars.rotation.y > 0, file);
    }
  }
  assert.match(readFileSync(join(root, 'runtime/motion.css'), 'utf8'), /animation: none !important/);
});

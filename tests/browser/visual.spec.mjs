import { test, expect } from '@playwright/test';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { writeFileSync } from 'node:fs';
import { candidateBase, prepare, preset, ready, reference, snapshots } from './helpers.mjs';
function difference(expected, actual) {
  const a = PNG.sync.read(expected), b = PNG.sync.read(actual);
  expect({width: b.width, height: b.height}).toEqual({width: a.width, height: a.height});
  const output = new PNG({width: a.width, height: a.height});
  const pixels = pixelmatch(a.data, b.data, output.data, a.width, a.height, {threshold: .1});
  return {pixels, bytes: PNG.sync.write(output)};
}
const shot = page => page.screenshot({animations: 'disabled', caret: 'hide', scale: 'css'});
for (const scene of ['starting', 'brb', 'thanks']) {
  test(`${scene} reduced-motion tuned frame matches accepted P2 in the same browser`, async ({page, browser, baseURL}, testInfo) => {
    // Ray-marched BRB is sampled at a smaller viewport on software WebGL;
    // this is regression coverage, not full-resolution GPU qualification.
    if (scene === 'brb') await page.setViewportSize({width: 480, height: 270});
    await prepare(page, {controlledFrames: true});
    const candidate = await candidateBase(page, baseURL);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const settings = preset();
    // One foreground tab, sequential documents: background tabs throttle RAF and
    // parallel software WebGL contexts would distort timing/resource behavior.
    await page.goto(snapshots.toUrl(settings, scene, new URL('/reference/editor.html', baseURL).href)); await ready(page);
    const expected = await shot(page);
    await page.goto(snapshots.toUrl(settings, scene, candidate)); await ready(page);
    expect(await page.evaluate(() => document.fonts.check('24px "Cinzel Decorative"'))).toBe(true);
    if (scene === 'thanks') expect(await page.evaluate(() => document.fonts.check('24px "Macondo"'))).toBe(true);
    expect(await page.locator('canvas').count()).toBeGreaterThan(0);
    const actual = await shot(page), diff = difference(expected, actual);
    for (const [name, bytes] of [['accepted-p2.png', expected], ['candidate.png', actual], ['difference.png', diff.bytes]]) {
      const path = testInfo.outputPath(name); writeFileSync(path, bytes); await testInfo.attach(name, {path, contentType: 'image/png'});
    }
    const metadata = {referenceCommit: reference.commit, candidateUrl: page.url(), browser: browser.version(), viewport: page.viewportSize(), softwareRendererRequested: true, reducedMotion: true, quality: settings.quality, fixedTime: reference.fixedTime, seed: reference.seed, controlledRafSteps: 2, differingPixels: diff.pixels};
    await testInfo.attach('comparison-environment.json', {body: Buffer.from(JSON.stringify(metadata, null, 2)), contentType: 'application/json'});
    expect(diff.pixels, 'Candidate must match accepted P2 (same browser, fixed scene state); inspect attached diff before any baseline change').toBe(0);
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => window.__testObs.attempts)).toEqual([]);
    if (scene === 'starting') {
      // Negative control: the comparator must notice a deliberate real layout change.
      await page.locator('.overlay').evaluate(el => { el.style.transform = 'translateY(40px)'; });
      expect(difference(actual, await shot(page)).pixels).toBeGreaterThan(1000);
    }
  });
}

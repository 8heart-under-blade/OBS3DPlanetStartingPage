import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
export const snapshots = createRequire(import.meta.url)('../../runtime/snapshots.js')();
export const reference = JSON.parse(readFileSync(new URL('./reference.json', import.meta.url), 'utf8'));
const resources = new WeakMap();
export async function prepare(page, {authenticatedMock = false, noAuthMock = false, controlledFrames = false} = {}) {
  const pending = new Set(); resources.set(page, pending);
  page.on('request', request => pending.add(request));
  page.on('requestfinished', request => pending.delete(request));
  page.on('requestfailed', request => pending.delete(request));
  await page.clock.setFixedTime(new Date(reference.fixedTime));
  await page.addInitScript(({seed, authenticatedMock, noAuthMock, controlledFrames}) => {
    if (controlledFrames) {
      let next = 0, tick = 0; const callbacks = new Map();
      window.requestAnimationFrame = fn => { const id = ++next; callbacks.set(id, fn); return id; };
      window.cancelAnimationFrame = id => callbacks.delete(id);
      window.__testFrames = {step(count) {
        for (let i = 0; i < count; i++) {
          tick++; const pending = [...callbacks.values()]; callbacks.clear();
          for (const fn of pending) fn(tick * 1000 / 60);
        }
      }};
    }
    let state = seed >>> 0;
    Math.random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
    window.__testObs = {attempts: [], sent: []};
    // Always replace the constructor BEFORE app code: never contact real OBS,
    // even if a regression accidentally bypasses origin/iframe isolation.
    window.WebSocket = class TestSocket {
      static OPEN = 1;
      constructor(url) {
        window.__testObs.attempts.push(String(url)); this.readyState = 0;
        if (!authenticatedMock && !noAuthMock) throw new Error('Browser tests block real WebSockets');
        queueMicrotask(() => {
          if (this.readyState === 3) return;
          this.readyState = 1; this.onopen?.();
          this.onmessage?.({data: JSON.stringify({op: 0, d: {rpcVersion: 1, ...(authenticatedMock ? {authentication: {salt: 'browser-synthetic-salt', challenge: 'browser-synthetic-challenge'}} : {})}})});
        });
      }
      send(text) {
        const payload = JSON.parse(text); window.__testObs.sent.push(payload);
        if (payload.op === 1) queueMicrotask(() => { if (this.readyState === 1) this.onmessage?.({data: JSON.stringify({op: 2, d: {negotiatedRpcVersion: 1}})}); });
      }
      close() { this.readyState = 3; this.onclose?.(); }
    };
  }, {seed: reference.seed, authenticatedMock, noAuthMock, controlledFrames});
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (['127.0.0.1', 'hosted.obs.test'].includes(url.hostname) && url.protocol === 'http:' && url.port === (process.env.OBS3DSP_BROWSER_PORT || '4173')) return route.continue();
    return route.abort('blockedbyclient');
  });
}
export async function ready(page) {
  await page.waitForFunction(() => !!window.StreamBoot?.ready);
  const outcome = await page.evaluate(() => window.StreamBoot.ready);
  expect(outcome.status).toBe('ready');
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => [...resources.get(page)].map(request => request.url()), {message: 'All requested scene resources must finish before capture'}).toEqual([]);
  // Explicit app/font/resource readiness, not networkidle: Chrome may keep its own page
  // traffic alive and the render loop is intentionally perpetual.
  await page.evaluate(() => {
    if (window.__testFrames) { window.__testFrames.step(2); return; }
    return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await expect(page.locator('#bootError')).toBeHidden();
}
export async function previewReady(page) {
  const url = await page.locator('#scene-preview').getAttribute('src');
  await expect.poll(() => page.frames().some(frame => frame.url() === url)).toBe(true);
  const frame = page.frame({url});
  await frame.waitForFunction(() => !!window.StreamBoot?.ready);
  const outcome = await frame.evaluate(() => window.StreamBoot.ready);
  expect(outcome.status).toBe('ready');
  await expect(page.locator('#editor-status')).toContainText('Preview started');
  return frame;
}
export function preset() { return {...snapshots.defaults(), reducedMotion: true, audioMode: 'off'}; }
export async function candidateBase(page, baseURL) {
  const metadata = await (await page.request.get(new URL('/health', baseURL).href)).json();
  return new URL('/project/releases/' + metadata.candidate + '/editor.html', baseURL).href;
}

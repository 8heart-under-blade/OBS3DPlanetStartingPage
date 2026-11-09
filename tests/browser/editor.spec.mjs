import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { candidateBase, prepare, preset, previewReady, ready, snapshots } from './helpers.mjs';

test('editor customizes three scenes, autosaves, exports/imports and copies a pinned OBS URL', async ({page, context, baseURL}) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  // Editor interactions must not compete with a perpetual full-HD SwiftShader loop.
  // Keep real scene bootstrap/preview loading; visual.spec owns stepped render comparisons.
  await prepare(page, {controlledFrames: true});
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {origin: new URL(baseURL).origin});
  await page.goto('/project/editor.html');
  await expect(page).toHaveURL(/\/project\/releases\/v[^/]+\/editor\.html$/);
  await previewReady(page);
  await expect(page.getByLabel('Audio mode', {exact: true})).toHaveValue('auto');
  await page.getByLabel('Title', {exact: true}).fill('Browser smoke 星界');
  await page.getByLabel('Subtitle', {exact: true}).fill('Preset round-trip');
  await page.getByLabel('Audio mode', {exact: true}).selectOption('off');
  await previewReady(page);
  const updatedPreview = await previewReady(page);
  await expect(updatedPreview.locator('#title')).toHaveText('Browser smoke 星界');
  const starting = await page.locator('#link-starting').inputValue();
  expect(snapshots.fromHash(new URL(starting).hash).scenes.starting.title).toBe('Browser smoke 星界');
  await page.locator('#scene-select').selectOption('brb');
  await page.getByLabel('Title', {exact: true}).fill('Browser BRB');
  await page.locator('#scene-select').selectOption('thanks');
  await page.getByLabel('Title', {exact: true}).fill('Browser Thanks');
  await page.locator('#scene-select').selectOption('starting');
  await expect(page.getByLabel('Title', {exact: true})).toHaveValue('Browser smoke 星界');
  await previewReady(page);
  await page.getByRole('button', {name: 'Copy link for Starting scene', exact: true}).click();
  await expect(page.locator('#editor-status')).toContainText('Copied the starting');
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(await page.locator('#link-starting').inputValue());
  expect(new URL(copied).pathname).toMatch(/\/project\/releases\/v[^/]+\/index\.html$/);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Export preset JSON', exact: true}).click();
  const download = await downloadPromise, exported = JSON.parse(readFileSync(await download.path(), 'utf8'));
  expect(exported.scenes.brb.title).toBe('Browser BRB'); expect(exported.scenes.thanks.title).toBe('Browser Thanks');
  expect(exported).not.toHaveProperty('password'); expect(exported).not.toHaveProperty('audioReactive');
  await page.reload(); await previewReady(page);
  await expect(page.getByLabel('Title', {exact: true})).toHaveValue('Browser smoke 星界');
  exported.scenes.starting.title = 'Imported from browser JSON';
  await page.locator('#import-input').setInputFiles({name: 'preset.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported))});
  await expect(page.getByLabel('Title', {exact: true})).toHaveValue('Imported from browser JSON');
  const before = await page.locator('#link-starting').inputValue();
  await page.locator('#import-input').setInputFiles({name: 'unsafe.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({...exported, password: 'synthetic-do-not-store'}))});
  await expect(page.locator('#editor-error')).toContainText('Import rejected');
  expect(await page.locator('#link-starting').inputValue()).toBe(before);
  expect(JSON.stringify(await context.storageState())).not.toContain('synthetic-do-not-store');
  expect(errors).toEqual([]);
});

test('invalid controls disable stale copying, and clipboard failure offers a selected manual-copy field', async ({page}) => {
  await prepare(page, {controlledFrames: true});
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', {configurable: true, value: undefined}));
  await page.goto('/project/editor.html'); await previewReady(page);
  const original = await page.locator('#scene-preview').getAttribute('src');
  const originalLink = await page.locator('#link-starting').inputValue();
  await page.locator('#top-input').fill('');
  await expect(page.getByRole('button', {name: 'Copy link for Starting scene', exact: true})).toBeDisabled();
  await expect(page.locator('#editor-status')).toContainText('last valid');
  expect(await page.locator('#scene-preview').getAttribute('src')).toBe(original);
  await page.locator('#top-input').fill('12');
  await expect(page.getByRole('button', {name: 'Copy link for Starting scene', exact: true})).toBeEnabled();
  await expect(page.locator('#editor-error')).toBeHidden();
  await expect(page.locator('#link-starting')).toHaveValue(originalLink);
  await page.getByRole('button', {name: 'Copy link for Starting scene', exact: true}).click();
  await expect(page.locator('#editor-status')).toContainText('Link selected');
  await expect(page.locator('#link-starting')).toBeFocused();
  expect(await page.locator('#link-starting').evaluate(el => el.selectionEnd - el.selectionStart)).toBe((await page.locator('#link-starting').inputValue()).length);
  await page.locator('#top-input').fill('-1');
  await expect(page.getByRole('button', {name: 'Copy link for Starting scene', exact: true})).toBeDisabled();
  await expect(page.locator('#link-starting')).toHaveValue('');
  await page.locator('#top-input').fill('13');
  await expect(page.getByRole('button', {name: 'Copy link for Starting scene', exact: true})).toBeEnabled();
  const corrected = await page.locator('#link-starting').inputValue();
  expect(snapshots.fromHash(new URL(corrected).hash).scenes.starting.topVh).toBe(13);
  const preview = await previewReady(page);
  expect(await preview.evaluate(() => window.STREAM_SNAPSHOT.scenes.starting.topVh)).toBe(13);
});

test('mobile editor has no horizontal overflow, labelled controls and uniformly sized Copy link buttons', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844}); await prepare(page, {controlledFrames: true});
  await page.goto('/project/editor.html'); await previewReady(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const buttons = page.locator('[id^="copy-"]'); expect(await buttons.allTextContents()).toEqual(['Copy link', 'Copy link', 'Copy link']);
  const widths = await buttons.evaluateAll(elements => elements.map(el => el.getBoundingClientRect().width));
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(1);
  await page.keyboard.press('Tab'); await expect(page.getByRole('link', {name: 'Skip to editor controls'})).toBeFocused();
  await page.keyboard.press('Enter');
  await page.getByLabel('Title', {exact: true}).fill('Mobile edit');
  await expect.poll(async () => snapshots.fromHash(new URL(await page.locator('#link-starting').inputValue()).hash).scenes.starting.title).toBe('Mobile edit');
});

test('public-origin Auto pages and local embedded previews never attempt an OBS connection or show credential fields', async ({page, baseURL}) => {
  await prepare(page); await page.goto('/project/editor.html'); const frame = await previewReady(page);
  expect(await frame.evaluate(() => window.__testObs.attempts)).toEqual([]);
  await expect(frame.locator('.obs-audio-session')).toHaveCount(0);
  const base = await candidateBase(page, baseURL), hosted = new URL(base); hosted.hostname = 'hosted.obs.test';
  const url = snapshots.toUrl({...preset(), audioMode: 'auto'}, 'starting', hosted.href);
  await page.goto(url); await ready(page);
  expect(await page.evaluate(() => window.__testObs.attempts)).toEqual([]);
  await expect(page.locator('.obs-audio-session')).toHaveCount(0);
  await page.goto(snapshots.toUrl({...preset(), audioMode: 'setup'}, 'starting', hosted.href)); await ready(page);
  expect(await page.evaluate(() => window.__testObs.attempts)).toEqual([]);
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
});

test('local Auto connects without a password when the mock OBS server has authentication disabled', async ({page, baseURL}) => {
  await prepare(page, {noAuthMock: true});
  const base = await candidateBase(page, baseURL);
  await page.goto(snapshots.toUrl({...preset(), audioMode: 'auto'}, 'starting', base)); await ready(page);
  await expect(page.locator('.obs-audio-session')).toBeHidden();
  const state = await page.evaluate(() => window.__testObs);
  expect(state.attempts).toEqual(['ws://127.0.0.1:4455']);
  expect(state.sent).toEqual([{op: 1, d: {rpcVersion: 1, eventSubscriptions: 65536}}]);
  await page.keyboard.press('Control+Alt+a');
  await expect(page.getByRole('dialog', {name: 'Local OBS audio setup'})).toBeVisible();
  expect(await page.locator('#obs-audio-password').inputValue()).toBe('');
  await page.getByRole('button', {name: 'Disable audio', exact: true}).click();
  await expect(page.locator('.obs-audio-session')).toContainText('Session credentials cleared');
});

test('authenticated local setup uses real browser crypto and session-only fields, then refresh requests a fresh password', async ({page, context, baseURL}) => {
  await prepare(page, {authenticatedMock: true});
  const base = await candidateBase(page, baseURL);
  await page.goto(snapshots.toUrl({...preset(), audioMode: 'auto'}, 'starting', base)); await ready(page);
  const panel = page.getByRole('dialog', {name: 'Local OBS audio setup'});
  await expect(panel).toBeVisible();
  expect(await page.evaluate(() => window.__testObs.sent)).toEqual([]);
  await page.getByLabel('Password — leave blank if OBS authentication is disabled', {exact: true}).fill('synthetic-browser-session-password');
  await page.getByRole('button', {name: 'Connect', exact: true}).click();
  await expect(panel).toBeHidden();
  expect(await page.locator('#obs-audio-password').inputValue()).toBe('');
  const sent = await page.evaluate(() => window.__testObs.sent);
  expect(sent).toHaveLength(1); expect(sent[0].d.eventSubscriptions).toBe(65536);
  expect(typeof sent[0].d.authentication).toBe('string'); expect(JSON.stringify(sent)).not.toContain('synthetic-browser-session-password');
  expect(JSON.stringify(await context.storageState())).not.toContain('synthetic-browser-session-password');
  expect(page.url()).not.toContain('synthetic-browser-session-password');
  await page.keyboard.press('Control+Alt+a'); await expect(panel).toBeVisible();
  await page.getByRole('button', {name: 'Disable audio', exact: true}).click();
  await expect(panel).toContainText('Session credentials cleared');
  await page.reload(); await ready(page); await expect(panel).toBeVisible();
  expect(await page.locator('#obs-audio-password').inputValue()).toBe('');
  expect(await page.evaluate(() => window.__testObs.sent)).toEqual([]);
});

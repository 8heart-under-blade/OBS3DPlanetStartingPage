import { defineConfig } from '@playwright/test';
const port = process.env.OBS3DSP_BROWSER_PORT || '4173';
if (!/^[1-9]\d{3,4}$/.test(port) || Number(port) > 65535) throw new Error('Use a browser-test port between 1000 and 65535');
export default defineConfig({
  testDir: './tests/browser',
  testMatch: '**/*.spec.mjs',
  timeout: 120000,
  expect: {timeout: 30000},
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['html', {open: 'never'}]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: {width: 1920, height: 1080},
    deviceScaleFactor: 1,
    locale: 'en-US', timezoneId: 'UTC', colorScheme: 'dark',
    trace: 'retain-on-failure', screenshot: 'only-on-failure',
    launchOptions: {
      ...(process.env.OBS3DSP_BROWSER_CHANNEL ? {channel: process.env.OBS3DSP_BROWSER_CHANNEL} : {}),
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-proxy-server', '--host-resolver-rules=MAP hosted.obs.test 127.0.0.1']
    }
  },
  webServer: {
    command: 'node scripts/browser-fixture.mjs',
    url: `http://127.0.0.1:${port}/health`,
    reuseExistingServer: false,
    timeout: 120000
  }
});

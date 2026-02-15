import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

// In CI, use vite preview (serves pre-built dist, instant startup)
// Locally, use vite dev (HMR, source maps)
const webServerCommand = isCI ? 'npm run preview' : 'npm run dev';
// vite dev uses port from vite.config.ts (5174), vite preview defaults to 4173
const webServerPort = isCI ? 4173 : 5174;

export default defineConfig({
  testDir: './e2e/specs',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: `http://localhost:${webServerPort}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: webServerCommand,
    url: `http://localhost:${webServerPort}`,
    reuseExistingServer: !isCI,
  },
});

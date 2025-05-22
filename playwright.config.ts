// Import the test setup file to handle environment variables
import 'dotenv/config';
import { defineConfig } from '@playwright/experimental-ct-react';
import { devices } from '@playwright/test';
import react from '@vitejs/plugin-react';

// Log VITE_API_BASE_URL to check if dotenv is working at this point
console.log('VITE_API_BASE_URL from process.env in playwright.config.ts:', process.env.VITE_API_BASE_URL);

/**
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests', // Main test directory
  /* Maximum time one test can run for */
  timeout: 30 * 1000,
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI ? 'html' : [
    ['html', { open: 'never' }],  // Never auto-open the report
    ['list']  // Also use list reporter for immediate console output
  ],
  /* Shared settings for all the projects below - primarily for E2E */
  use: {
    /* Base URL to use in actions like `await page.goto('/')` for E2E tests */
    baseURL: 'http://localhost:3000',
    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',
    /* Capture screenshot on failure */
    screenshot: 'only-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    // Setup for E2E tests
    {
      name: 'chromium-e2e',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /.*\.e2e\.spec\.ts/, // For specifically named E2E tests
    },
    
    // UI Tests (including auth tests)
    {
      name: 'ui-tests',
      testDir: './tests/ui',
      testMatch: /.*\.spec\.ts/,  // Match all .spec.ts files in tests/ui directory
      use: { ...devices['Desktop Chrome'] },
    },

    // Setup for React Component Tests
    {
      name: 'react-component-tests',
      testDir: './tests/ui', // Directory for component tests
      testMatch: /.*\.spec\.tsx/, // Match only .spec.tsx files for React components
      use: {
        ...devices['Desktop Chrome'],
        // No longer using ctViteConfig as it's not supported in this Playwright version
      },
    },
  ],

  /* Run your local dev server before starting E2E tests */
  webServer: {
    command: 'npm run server',
    url: 'http://localhost:3000',
    reuseExistingServer: true, 
    timeout: 180 * 1000, 
    stderr: 'pipe', 
    stdout: 'pipe', 
  },
});

import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// __filenameと__dirnameをESモジュールで使用するための設定
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_STATE = path.resolve(__dirname, 'playwright-results/.auth/user.json');

// .env.localが存在すればそれを読み込み、なければ.envを読み込む
dotenv.config({ path: path.resolve(__dirname, '.env.test') });
dotenv.config({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
  testDir: './tests',
  outputDir: 'playwright-results/test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-results/playwright-report' }],
    //['blob', { outputDir: 'playwright-results/blob-report' }],
  ],
  use: {
    baseURL: process.env.DOMAIN_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    bypassCSP: true, // Content Security Policyをバイパス
    extraHTTPHeaders: {
      'Accept': 'application/json',
    },
  },

  testIgnore: [
    '**/unit/**',               // ユニットテスト除外
    '**/integration/**',        // インテグレーションテスト除外
    '**/*.test.ts',             // vitest のテストファイル除外
    '**/*.spec.js',             // (もしあれば) js除外
    '**/vitest.setup.ts',       // vitest のセットアップを除外
  ],

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'setup',
      testMatch: /setup\/auth\.setup\.ts$/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-cors',
            '--disable-features=VizDisplayCompositor',
            '--disable-blink-features=AutomationControlled'
          ]
        }
      },
    },

    {
      name: 'auth_chromium',
      testMatch: /.*\.auth\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE,
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-cors',
            '--disable-features=VizDisplayCompositor'
          ]
        }
      },
      dependencies: ['setup'],
    },


    //{
    //  name: 'firefox',
    //  use: { ...devices['Desktop Firefox'] },
    //},

    //{
    //  name: 'webkit',
    //  use: { ...devices['Desktop Safari'] },
    //},

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});

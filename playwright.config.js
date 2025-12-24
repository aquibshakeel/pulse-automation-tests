require('dotenv').config();
const config = require('./config/environment.config');

/**
 * Playwright Test Configuration
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = {
  testDir: './tests',
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 1,
  
  reporter: [
    ['html', { 
      open: process.env.OPEN_REPORT || 'never',
      outputFolder: process.env.REPORT_PATH || 'reports'
    }],
    ['list'],
    ['json', { 
      outputFile: `${process.env.REPORT_PATH || 'reports'}/test-results.json` 
    }]
  ],

  use: {
    baseURL: config.apiBaseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'mf-order-management',
      testDir: './tests/mf-order-management',
      testMatch: '**/*.test.js',
    },
    {
      name: 'service-a',
      testDir: './tests/service-a',
      testMatch: '**/*.test.js',
    },
    {
      name: 'service-b',
      testDir: './tests/service-b',
      testMatch: '**/*.test.js',
    },
  ],
};

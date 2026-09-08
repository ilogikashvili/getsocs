const path = require('path');
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.js/,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm start',
      cwd: path.resolve(__dirname, '../server'),
      url: 'http://127.0.0.1:3001/health',
      reuseExistingServer: false,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        HOST: '127.0.0.1',
        PORT: '3001',
        USE_FILE_DB: 'true',
        TEST_DB_FILE: path.resolve(__dirname, 'e2e.test.json'),
        JWT_SECRET: 'e2e-only-secret-that-is-at-least-32-characters-long',
        ALLOWED_ORIGINS: 'http://127.0.0.1:3000,http://localhost:3000',
        SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: ''
      }
    },
    {
      command: 'npm start',
      cwd: path.resolve(__dirname, '../client'),
      url: 'http://127.0.0.1:3000',
      reuseExistingServer: false,
      env: {
        ...process.env,
        BROWSER: 'none',
        HOST: '127.0.0.1',
        PORT: '3000'
      }
    }
  ]
});

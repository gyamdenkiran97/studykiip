import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end configuration.
 *
 * Runs against a real server with a real database. Serial by default: the
 * tests buy things, and stock is shared state.
 *
 * CHROMIUM_PATH lets the suite use a browser already present on the machine
 * (the sandbox here ships one) instead of downloading its own.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const executablePath = process.env.CHROMIUM_PATH;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],

  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },

  projects: [
    // Signs in once and saves the session for everything that follows.
    { name: "setup", testMatch: /auth\.setup\.ts/ },

    // Specs that exercise signing in and out themselves start signed out.
    {
      name: "anonymous",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
      testMatch: /(auth|browse)\.spec\.ts/,
    },

    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        storageState: "tests/e2e/.auth/customer.json",
      },
      testIgnore: /(auth\.spec|browse\.spec|admin\.spec|mobile\.spec)\.ts/,
      dependencies: ["setup"],
    },

    {
      name: "admin",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        storageState: "tests/e2e/.auth/admin.json",
      },
      testMatch: /admin\.spec\.ts/,
      dependencies: ["setup"],
    },

    {
      name: "mobile",
      use: { ...devices["Pixel 7"], isMobile: true, hasTouch: true },
      testMatch: /mobile\.spec\.ts/,
    },
  ],

  // Reuse a running dev server when there is one; otherwise start it.
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});

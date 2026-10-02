import { defineConfig, devices } from "@playwright/test";

/**
 * One suite, two targets:
 *  - `demo`:   the static demo build's in-browser API (state lives in each browser context's localStorage);
 *  - `django`: the real Django API (e2e/serve-django.mjs, port 8100) behind a Vite dev server (port 4301).
 * A rule the two disagree on fails in exactly one project. Django is the source of truth.
 *
 * Ports 4300, 4301 and 8100 are reserved for these servers.
 */
const DEMO_URL = "http://localhost:4300";
const DJANGO_URL = "http://localhost:4301";
const API_URL = "http://127.0.0.1:8100";

const vite = "node node_modules/vite/bin/vite.js";

// `playwright test --project=demo` should not boot Django, and the demo project can use every worker.
const args = process.argv.slice(2);
const picked = args.flatMap((a, i) => (a.startsWith("--project=") ? [a.slice("--project=".length)] : a === "--project" ? [args[i + 1]] : []));
const demoOnly = picked.length > 0 && picked.every((p) => p === "demo");
const djangoOnly = picked.length > 0 && picked.every((p) => p === "django");

// globalSetup visits every route of the servers that are started, so Vite compiles them before the tests run.
process.env.E2E_WARM_URLS = [...(djangoOnly ? [] : [DEMO_URL]), ...(demoOnly ? [] : [DJANGO_URL])].join(",");

const demoServers = [
  {
    command: `${vite} --mode demo --port 4300 --strictPort`,
    url: DEMO_URL,
    reuseExistingServer: false,
    stdout: "ignore" as const,
    stderr: "pipe" as const,
    timeout: 120_000,
  },
];
const djangoServers = [
  {
    command: "node e2e/serve-django.mjs",
    url: `${API_URL}/api/categories`,
    reuseExistingServer: false,
    stdout: "ignore" as const,
    stderr: "pipe" as const,
    timeout: 180_000,
  },
  {
    command: `${vite} --port 4301 --strictPort`,
    url: DJANGO_URL,
    env: { API_PROXY_TARGET: API_URL },
    reuseExistingServer: false,
    stdout: "ignore" as const,
    stderr: "pipe" as const,
    timeout: 120_000,
  },
];

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env.CI,
  retries: 0,
  // Django state is shared by every test, so any run that includes it goes one test at a time.
  workers: demoOnly ? undefined : 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "en-US",
    timezoneId: "UTC",
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    { name: "demo", use: { baseURL: DEMO_URL } },
    { name: "django", use: { baseURL: DJANGO_URL } },
  ],
  webServer: [...(djangoOnly ? [] : demoServers), ...(demoOnly ? [] : djangoServers)],
});

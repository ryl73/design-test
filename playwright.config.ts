import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:55310",
    launchOptions: { chromiumSandbox: true },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run build && npm run preview -- --port 55310 --strictPort",
    url: "http://127.0.0.1:55310",
    timeout: 120000,
    reuseExistingServer: false,
  },
});

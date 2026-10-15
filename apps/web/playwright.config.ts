import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "../../tests/e2e",
  workers: 1,
  use: {
    baseURL: "http://localhost:55310",
    launchOptions: { chromiumSandbox: true },
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm run build -w @design-qa/api && node ../api/dist/main.js",
      url: "http://127.0.0.1:55309/api/v1/health/live",
      env: {
        ...process.env,
        PORT: "55309",
        HOST: "127.0.0.1",
        APP_ORIGIN: "http://localhost:55310",
        CAPTURE_PROFILES_METADATA: JSON.stringify([
          {
            id: "e2e-profile",
            version: 1,
            label: "Тестовый профиль",
            origin: "https://example.com",
          },
        ]),
      },
      timeout: 120000,
    },
    {
      command: "npm run dev -- --port 55310 --strictPort",
      url: "http://localhost:55310",
      env: { ...process.env, API_PROXY_TARGET: "http://127.0.0.1:55309" },
      timeout: 30000,
    },
  ],
});

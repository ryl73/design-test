import { defineConfig } from "@playwright/test";
const apiEnvironment = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  MINIO_BUCKET: process.env.MINIO_BUCKET ?? "",
  NODE_ENV: "test",
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
};
let databasePath: string | undefined;
try {
  databasePath = new URL(apiEnvironment.DATABASE_URL ?? "").pathname;
} catch {
  /* Rejected before any subprocess starts. */
}
if (
  databasePath !== "/design_qa_test" ||
  apiEnvironment.MINIO_BUCKET !== "design-qa-test"
) {
  throw new Error(
    "E2E requires isolated design_qa_test database and design-qa-test bucket",
  );
}
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
      env: apiEnvironment,
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

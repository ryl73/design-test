import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";
const configUrl = new URL("../../playwright.config.ts", import.meta.url).href;
function loadConfig(database: string, bucket: string) {
  // Import the exact Playwright config in a fresh process, never start its servers
  // or connect to a database. Inherit the same development mode as .env.example.
  return spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
    const {default:config}=await import(${JSON.stringify(configUrl)});
    const env=config.webServer[0].env;
    console.log(JSON.stringify({mode:env.NODE_ENV,database:new URL(env.DATABASE_URL).pathname,bucket:env.MINIO_BUCKET,sandbox:config.use.launchOptions.chromiumSandbox}));
  `,
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: "development",
        DATABASE_URL: `postgresql://local:local@127.0.0.1:55432/${database}`,
        MINIO_BUCKET: bucket,
      },
    },
  );
}
it.each([
  ["design_qa_dev", "design-qa-dev"],
  ["design_qa_test", "design-qa-dev"],
  ["design_qa_dev", "design-qa-test"],
])(
  "rejects effective E2E config with %s / %s before starting servers",
  (database, bucket) => {
    const result = loadConfig(database, bucket);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "E2E requires isolated design_qa_test database and design-qa-test bucket",
    );
  },
);
it("forces test mode after inherited development env with isolated resources and sandbox", () => {
  const result = loadConfig("design_qa_test", "design-qa-test");
  expect(result.status, result.stderr).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual({
    mode: "test",
    database: "/design_qa_test",
    bucket: "design-qa-test",
    sandbox: true,
  });
});

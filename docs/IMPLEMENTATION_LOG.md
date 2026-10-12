# Implementation log

## Task 01 — workspace/tooling bootstrap (2026-10-13)

Scope: npm workspaces, shared strict TypeScript, browser-safe contracts, React/Vite shell, Nest HTTP bootstrap and disabled capture entrypoint. Tasks 02 onward remain unimplemented.

Versions (exact direct pins + package-lock): Node 24.21.0 LTS, npm 11.19.0, TypeScript 5.9.3, React/React DOM 19.3.0, Vite 8.3.4, React plugin 6.1.2, Nest common/core/platform-express 12.1.3, Vitest 5.0.4, Playwright test 1.64.0, ESLint 10.12.0, @eslint/js 10.0.1, typescript-eslint 8.71.2. Registry metadata verified compatibility; TypeScript 7.0.2 was deliberately not selected because typescript-eslint supports <6.1.0. ESLint 9 is registry-deprecated, so supported 10 selected. Current setup APIs checked through Context7 official React, Vite, Nest, Vitest, typescript-eslint and Playwright documentation.

Verification on macOS with explicit Node 24.21.0 PATH:

- `npm ci`: exit 0, 240 packages installed, audit 0 vulnerabilities. npm notes optional fsevents install script not approved; no approval needed for these builds.
- `npm run typecheck`: exit 0 across all four workspaces.
- `npm run lint`: exit 0 across all four workspaces, warnings rejected.
- `npm run build`: exit 0, compiled contracts/API/capture and Vite production bundle (15 transformed modules).
- Compiled API smoke: started `node apps/api/dist/main.js`, verified GET /api returns HTTP 200 and `{service:"api",stage:"bootstrap"}`, terminated process cleanly.
- Compiled capture smoke: `node apps/capture/dist/server.js` returns exit 1 and explicit disabled message, launches no browser or listener.
- `npm run test:unit`, `npm run test:integration`, `npm run test:e2e`: each dispatches real Vitest/Playwright runner and exits 1 because no test files exist yet. These are NOT acceptance passes. Tests are added with subsequent domain/DB/UI tasks; no artificial bootstrap unit tests added.
- Self-review: exact direct pins and lockfile; strict shared compiler; contracts contain no Prisma/backend runtime import; no capture service/credentials/browser; ignored local IDE/env/storage/build files; only task 01 boxes checked.

Local use: `nvm use`, `npm ci`, `npm run build`. In separate terminals run `npm run start -w @design-qa/api` and `npm run dev -w @design-qa/web`. Vite forwards /api to localhost:3000. API binds loopback by default (HOST override supported), PORT defaults 3000. API dev script compiles in watch mode; restart API manually after recompilation. `.env.example` is documentation; automatic dotenv loading is not configured. No DB/storage readiness is claimed by /api; task 02 adds real readiness. Capture remains intentionally disabled until network isolation and policy are implemented.

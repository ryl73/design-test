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

## Task 02 — local infrastructure/configuration/health (2026-10-13)

Task 01 commit: `6b34368`. Task 02 commit is the commit containing this entry (see `git log -- docs/IMPLEMENTATION_LOG.md`). Added production/private Compose plus explicit local override, persistent PostgreSQL/MinIO volumes, real healthchecks, one-shot migrations and private bucket init, API/web images, same-origin `/api/v1` proxy, validated environment and bounded DB/storage readiness. Capture remains absent/disabled. Domain schema belongs to task 03; infrastructure baseline migration is `SELECT 1`.

Dependency pins: Prisma/client/adapter-pg 7.10.0, pg 8.23.1, MinIO JS 8.0.7. Context7 checked Prisma7 config/generator/adapter, MinIO async client and Nest providers; Docker Compose dependency conditions. Patched transitive overrides deepmerge-ts8.0.2/mysql2 3.24.5 validated by generate/migrate/build/tests. `npm audit`: initial8 (4high/4moderate), final4moderate inherited MinIO query-string/decode-uri-component/stream-json. Patched decoder0.5 and stream-json3.6 use ESM APIs incompatible with MinIO's CommonJS imports, so no unsafe major override/downgrade was made. Only private server responses enter these unused notification parsers at this stage; reassess before enabling notification or untrusted storage endpoints.

RED/GREEN: config/health test-first minimal stubs yielded7 expected assertion failures; final7 passed. Added stalled-dependency test timed out RED at4s; readiness2500ms limit GREEN makes8/8 pass. Real integration initial failure exposed local Docker Desktop internal-network host-port publishing; local override now non-internal, production stays internal. Final real integration1/1 passes and confirms test DB name plus no bucket public policy.

Verification (Node24.21.0 PATH): `npm run typecheck`, `npm run lint`, `npm run build` all exit0; generation reproducible with DATABASE_URL supplied. `npm run test:unit -w @design-qa/api`:8/8. Exact test environment/commands in `docs/LOCAL_SETUP.md`. `npm run test:integration -w @design-qa/api` with explicit test env:1/1 real PostgreSQL/MinIO. No test cleanup writes/deletes development data.

Docker Hub MinIO tag and Quay pull denied while Node/PostgreSQL/Go/nginx registry pulls worked. Reproducible fallback `infra/Dockerfile.minio` builds official RELEASE.2025-04-22T22-12-26Z source tag object f19c534b9f457773dcd043d977433e1a71525c3b (underlying commit0d7408fc9...) using digest-pinned Go1.24.2/Debian. All images built; API OpenSSL installed for Prisma migration. Migration applied once then reports no pending migrations on subsequent starts. Local ports: web58080, PostgreSQL55432, MinIO59000 on loopback. Production config inspection confirms api/postgres/minio publish no host ports; corporate gateway must supply HTTPS APP_ORIGIN.

Real `node scripts/smoke-health.mjs`: live200/ready200. Stop only project postgres; `--database-unavailable`: live200/ready503 with database=false/storage=true. Restart postgres; smoke live200/ready200. Persistent volumes retained. Nginx healthcheck originally used localhost resolving IPv6; corrected to explicit IPv4 loopback. Full Compose final wait verification recorded in task report. Linux capture/network policy remains later work; no browser/capture acceptance claimed.

Resume verification (2026-10-14): Docker Desktop was stopped after interruption; started it and resumed only the persisted dedicated Compose project, retaining all volumes. `up -d --wait --wait-timeout 60` exit0; unit8/8, real isolated integration1/1 and same-origin smoke live200/ready200 passed again. `git diff --check` clean. Narrowed root storage ignore to `/storage/` so the API storage source is committed. Earlier interrupted escalation was rejected because approval review's usage limit was exhausted, not because the action was unsafe; no action was executed then.

Review02 fix (2026-10-14): raw Compose interpolation broke PostgreSQL URLs with delimiters. Test-first raw implementation failed `Invalid URL` with a password containing whitespace/#/?/@/:/%/+. Shared launcher now percent-encodes raw credentials for API and migration; PostgreSQL still receives the identical raw secret. New unit test GREEN, total9/9. Real PostgreSQL temporary test login `task02_reserved_fixture` authenticated through PrismaPg using the encoded URL, confirmed current_user/current_database=design_qa_test, then removed the fixture role. No development records changed. Config/database/storage/health code expanded for readability. Full typecheck/lint/build exit0; dedicated Compose images rebuilt, migration/storage-init exit0 and all running services healthy; final smoke live200/ready200, real isolated integration1/1 pass. Fix commit is the commit containing this entry.

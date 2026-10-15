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


## Task 03 — domain schema and history (2026-10-14)

Commit `9c91049`. Added all TDD §3 tables, composite same-variant/issue foreign keys, partial unique active capture job index, viewport/finite geometry/placement CHECKs and immutable history triggers. Deferred constraints enforce reciprocal successful CaptureJob/ReviewRevision links at transaction commit. Prisma 7 schema validates and generates the backend-only client.

RED: 54 of 62 initial integration assertions failed because geometry/history invariants were not enforced. GREEN: 79 integration checks passed after constraints and expanded coverage; API unit 9/9 and typecheck/lint/build passed. Complete migration history deployed to an empty isolated test schema, second deploy reported no pending migrations. Fixtures use rollback/test-only resources; development data was not reset. A source-revision FK test was isolated from unrelated published-job constraints in `117c162`.

## Task 04 — participant and structure API (2026-10-14)

Commits `117c162`, `5d98239`. Implemented signed 30-day HttpOnly/SameSite=Strict participant cookie (Secure in production), exact-Origin mutation checks, safe error envelope/requestId, strict DTOs, cursor pagination and browser-safe contracts. Project/Page/Variant writes lock ancestors in order, enforce conditional versions and inherited archive, preserve child archive flags and reset incompatible current baseline on width changes. Public reads remain available inside the corporate gateway.

RED: HTTP routes absent (404), then derived archive fields absent; URL delimiter and safe error regressions also failed before fixes. GREEN: 18 API unit tests; initial integration 82, final structure suite 5 cases plus existing schema/storage checks. Covered concurrent PATCH one success/one409, invalid viewport/unknown fields, forged/expired cookie, exact Origin, archive inheritance and baseline history. Typecheck/lint/build and explicit integration lint passed. Review found retired URL/profile metadata blocked archival; `5d98239` limits revalidation to changed settings, with real HTTP regression coverage. Both task and scoped fix reviews approved.

## Task 05 — structure UI (2026-10-15)

Commits `cf1b504`, `a3bd9be`. Added MUI 9.5 theme, React Router 7.18.4, TanStack Query 5.104.2, typed same-origin client, participant forms, project/page/viewport lists and create/edit/archive forms, optional readiness/profile settings, pagination and real loading/empty/error states. Conflicts retain drafts and require explicit refresh. Changed-field PATCH preserves unchanged optional settings. All server state comes from API queries. Desktop and 375px screenshots were inspected; no clipping or overflow remained.

RED: sandboxed Chromium loaded the old shell and could not find the participant action; a later request assertion exposed unchanged fields being resubmitted. GREEN: five real API/PostgreSQL E2E scenarios cover creation and reload of 1440×900, 768×1024 and 375×812, own/inherited archive, keyboard/error focus, true409, optional settings, server policy errors and load-more.

Whole-branch review found E2E could inherit development mode. `a3bd9be` forces API test mode after inherited env and rejects non-test database/bucket before subprocess launch. Four exact-configuration regressions failed before the fix and passed afterward without network or development writes. Parent rerun also exposed a first-page assumption once retained test data exceeded30 records; creation now opens the returned project ID. Five E2E tests passed twice consecutively on retained test data, then passed in the parent final run. No fixture database cleanup or development seeding was used.

## Stage A final gate (2026-10-15)

Verified implementation commit `a3bd9be` on `codex/design-qa-stage-a`, forked from `main` at `298bba3`. All five task reviews and the final whole-branch scoped re-review approved. Parent independently ran root typecheck, lint, unit, integration, E2E and build successfully: 22 unit tests (18 API +4 exact-config web tests),84 real integration tests and5 sandboxed Chromium E2E tests. Detailed command output is in ignored `.superpowers/sdd/DEVELOPMENT_PLAN/verified-*.log`; reproducible environment/commands are in LOCAL_SETUP.md.

Dedicated Compose API/web were rebuilt with migrations; live200/ready200 and real-browser UI smoke passed at http://localhost:58080. Development records/volumes were preserved. The production-mode build was checked separately from test-mode verification. Root test runners execute actual suites; future empty packages have no fake-success unit commands.

AC-01 passes. The structural portion of AC-16 passes: archive denies structure writes, reads remain available, restoring a parent preserves child flags. New capture-job rejection and historical revision UI are not claimed here; capture does not exist/enabled at stage A and those checks belong to later capture/review tasks. MVP-wide AC-01–AC-19 acceptance and pilot are not complete.

Recorded decisions: save-time URL format/exact-origin checks are implemented now; full DNS/egress policy is task09 before any capture. Root unit scripts include only genuine suites; when adding a suite to a future workspace its test command must be added. These choices avoid claiming unimplemented network controls or artificial test coverage.

Known limitations: four moderate advisories remain in the existing MinIO SDK dependency chain; reassess before adding notification/untrusted-storage use. The production UI bundle exceeds Vite's500kB warning threshold (about575kB/179kB gzip), tracked for later splitting; the threshold was not suppressed. MinIO builds pinned official source because registry images were unavailable. Capture, baseline upload and review comparison are subsequent stages. No merge, push or public deployment performed.

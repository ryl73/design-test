# Local dependencies and health

Use Node 24.21.0 (`nvm use`) and `npm ci`. Copy `.env.example` to `.env`; its example secrets are local only. For host commands explicitly load `.env` into the shell or use Node's `--env-file=.env`; Prisma does not load it automatically.

Start the isolated project from repository root:

```
docker compose --env-file .env -f infra/compose.yml -f infra/compose.local.yml -p design-qa-stage-a up --build -d --wait
```

Open http://localhost:58080. Same-origin `/api/v1/health/live` checks the process, `/api/v1/health/ready` queries PostgreSQL and verifies the private MinIO bucket. Production Compose publishes only the loopback web port for a corporate HTTPS gateway; API/PostgreSQL/MinIO have no host ports. Supply an HTTPS APP_ORIGIN and a fresh signing key plus database/storage secrets. Use neither the local override nor example credentials in production. Gateway must preserve the origin and route all `/api/` traffic through web.

Local override exposes PostgreSQL `127.0.0.1:55432` and MinIO `127.0.0.1:59000`. Persistent named volumes belong only to `design-qa-stage-a`. Migration service runs once before API; `npm run db:migrate` is also an explicit one-shot command. `storage-init` creates private buckets without public policy. Capture/worker are deliberately absent until their later tasks.

Integration tests use only `design_qa_test` and `design-qa-test`; startup rejects other database/bucket names in test mode. On a fresh local volume PostgreSQL init creates the test database, and storage-init creates the test bucket. Existing volumes are never deleted or reset automatically: if test database is missing, create it explicitly with `docker compose ... exec postgres createdb -U design_qa design_qa_test`.

```
NODE_ENV=test DATABASE_URL=postgresql://design_qa:local-database-password@127.0.0.1:55432/design_qa_test MINIO_ENDPOINT=http://127.0.0.1:59000 MINIO_BUCKET=design-qa-test MINIO_ACCESS_KEY=local-minio-access MINIO_SECRET_KEY=local-minio-secret-password SESSION_SIGNING_KEY=local-only-signing-key-32-characters APP_ORIGIN=http://localhost:58080 CAPTURE_ALLOWED_ORIGINS=https://example.com npm run test:integration -w @design-qa/api
```

Run `npm run db:generate`, `npm run typecheck`, `npm run lint`, `npm run build` with DATABASE_URL set. Generated Prisma files are ignored and rebuilt from schema. Test commands do not delete development objects or database records.

Read-only smoke: `node scripts/smoke-health.mjs`. To verify database loss, stop only this project's postgres with the same Compose arguments, run `node scripts/smoke-health.mjs --database-unavailable` (live 200 / ready 503), then restart postgres and rerun smoke. Do not run `down -v` against development data.

MinIO registry images could not be pulled in this environment. `Dockerfile.minio` builds official upstream release source at immutable tag object `f19c534b9f457773dcd043d977433e1a71525c3b` (commit `0d7408fc9...`); Go base and Debian runtime are pinned by digest. First build downloads Go dependencies and takes longer. MinIO remains the real server, with persistent private storage.

The local override sets the data network to non-internal so Docker Desktop can publish its loopback test ports. Production retains `data.internal=true` and no dependency ports.

Compose uses one raw `POSTGRES_PASSWORD` for the PostgreSQL server and both application launchers. `scripts/run-with-database.mjs` percent-encodes username/password/database when constructing DATABASE_URL for API and migration, preserving whitespace and reserved characters. Host commands still accept an explicit DATABASE_URL, whose credentials must be percent-encoded.

## Structure URL and profile configuration

Set `CAPTURE_ALLOWED_ORIGINS` to a comma-separated list of exact origins, including scheme and non-default port (for example `https://staging.example.org,http://localhost:58080`). An empty list denies all page/variant URL saves. Explicit HTTP entries are operator-approved exceptions. Save validation canonicalizes URLs and rejects userinfo, fragments, control characters, backslashes and credential/token query parameters. Saving a URL performs no network requests. DNS, redirect and capture egress enforcement belongs to stage 09.

`CAPTURE_PROFILES_METADATA` defaults to `[]`. Each optional entry has only `{id,version,label,origin}`; unknown fields and secrets are rejected. Origins must be on the allowlist. The API returns only these safe fields from `GET /api/v1/capture-profiles`; a variant references `{profileId,version}` and must use the same effective URL origin. This metadata does not enable capture or load profile credentials.

Integration tests compile the API immediately before starting a separate loopback HTTP process on port 55304. They create persistent fixtures only in `design_qa_test` and never reset development records.

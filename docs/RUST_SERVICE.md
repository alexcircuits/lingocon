# Rust platform service (`lingocon-api`)

An Axum service in `rust/crates/api` that takes CPU- and data-heavy work off the
Next.js workers. It is **optional**: when it is not configured, not running or
slow, Next.js uses its TypeScript implementations, so a deploy without Rust (or a
rollback) changes performance, never behaviour.

```
browser ──https──▶ nginx ──▶ Next.js (PM2 cluster, :3000)
                                │  1. authenticates the user (Auth.js) and authorizes
                                │     the action (canViewLanguage, …)
                                │  2. POST http://127.0.0.1:3040/v1/internal/…
                                │     Authorization: Bearer $LINGOCON_API_TOKEN
                                ▼
                         lingocon-api (PM2 fork, 1 process, loopback only)
                                │  parameterized SQL, read-only snapshot
                                ▼
                            PostgreSQL
```

- `rust/crates/core` (`lingocon-core`) is pure language logic with no I/O. It must
  produce exactly what main's TypeScript produces (parity tests live there).
- `rust/crates/api` (`lingocon-api`) owns I/O: config, PostgreSQL, auth, HTTP.
  Source is organised by domain: `config`, `db/` (pool, TLS, `DATABASE_URL`,
  per-table queries), `auth/` (token, Auth.js session cookie, extractors,
  `canViewLanguage`), `routes/`, `middleware`, `error`, `telemetry`, `server`.

**Trust model.** `/v1/internal/*` trusts Next.js: it checks only the shared token,
so Next must authorize the user *before* calling (the client in `lib/rust-api`
says so on every function). For pages that may later be served by Rust directly,
the service can verify the Auth.js session cookie itself (`OptionalUser` /
`RequireUser`) and apply the same authorization rules (`auth::access`).

## Endpoints

| Method & path | Auth | Purpose |
| --- | --- | --- |
| `GET /healthz` | none | Liveness. Never touches the DB and is exempt from the concurrency limit. `{"status":"ok"}` |
| `GET /readyz` | none | Readiness: DB round trip within 2 s, also exempt from the concurrency limit. 200 `{"status":"ready"}` / 503 |
| `GET /v1/me` | session cookie | Example session endpoint: `{"userId": "…"}` or 401 |
| `POST /v1/internal/lexicon-analysis` | bearer token | Body `{"languageId": "…"}` → `{"warnings":[{"type","message","severity"}] (≤ 50), "total", "matchedIds"}`; 400 bad body, 404 unknown language, 413 body > 1 MiB, 415 not JSON |
| `GET /v1/languages/{languageId}/lexicon-analysis` | session cookie | Same analysis for the signed-in user if `canViewLanguage` allows it: 401 when signed out, 404 when missing or not viewable (like the studio) |

Every error is `{"error": "<generic message>"}` (details go to the log only).
503 means "try later / fall back": DB unavailable or timed out, the service is
saturated (`LINGOCON_API_MAX_INFLIGHT`), or the request exceeded 10 s. Every
response carries `x-request-id` (an incoming one is kept, so Next can pass its own).

Lexicon analysis loads the language, its script symbols, paradigm ids and entries
(ordered by `id`, like main) in one read-only `REPEATABLE READ` snapshot,
streaming entries row by row, then runs `lingocon_core::analysis::analyze_lexicon`
on the blocking thread pool. At most `cores − 1` (minimum 1) analyses load and run
at once, so only that many lexicons are in memory. Lexicons above 500,000
entries are refused with 422 (Next then falls back to TypeScript).

### Session cookies (Auth.js)

`auth::session` decodes the cookie exactly like `@auth/core` 0.41 `jwt.decode`:
compact JWE, `alg: "dir"`, `enc: "A256CBC-HS512"`, key =
HKDF-SHA256(`AUTH_SECRET`, salt = cookie name, info = `Auth.js Generated Encryption
Key (<cookie name>)`, 64 bytes), `kid` = JWK SHA-512 thumbprint when present,
`exp`/`nbf` with 15 s tolerance, chunked cookies (`name.0`, `name.1`, …) joined in
order. Cookie names: `authjs.session-token` (http) and
`__Secure-authjs.session-token` (https; preferred when both are present). The user
id is the `id` claim (main's `jwt` callback), falling back to `sub`; the user must
exist and not be suspended (main's `getUserId`). Without `AUTH_SECRET` every
session route answers 401. `DEV_MODE`'s synthetic session is a Next.js-only
feature and is not honoured.

Deliberate difference: Auth.js `decode` also accepts `enc: "A256GCM"`, which its
`encode` never emits; Rust accepts only A256CBC-HS512.

## Configuration

The service reads the environment, after loading `.env` from its working
directory **without overriding** variables that are already set (PM2/systemd/
Docker win). Only `.env` is read — values kept in `.env.local` or
`.env.production` must be exported or moved there. Invalid configuration stops
the process at startup with a message naming the variable.

| Variable | Default | Notes |
| --- | --- | --- |
| `LINGOCON_API_TOKEN` | — (required) | 32–256 printable ASCII, no spaces (`openssl rand -hex 32`). Also read by Next. |
| `DATABASE_URL` | — (required) | The Prisma URL. `schema=` → `search_path` (default `public`); Prisma-only parameters (`connection_limit`, `pool_timeout`, …) are ignored and listed in the startup log; `pgbouncer=true` is refused (startup options and prepared statements need a direct connection); `sslmode=require` → TLS via rustls (certificate verified only with `sslaccept=strict`, like Prisma; `sslcert`/`sslrootcert` add a CA); `disable`/`prefer`/absent → plain. |
| `AUTH_SECRET` | unset | Enables session verification. Must equal the Next.js value. |
| `LINGOCON_API_BIND` | `127.0.0.1:3040` | Non-loopback refused unless `LINGOCON_API_ALLOW_PUBLIC_BIND=1`. |
| `LINGOCON_API_DB_POOL` | `8` | Connections for this process; budget them against `max_connections` with the Prisma pools. |
| `LINGOCON_API_STATEMENT_TIMEOUT_MS` | `5000` | Set per connection (`-c statement_timeout`); 1–9000, below the 10 s request timeout. Connections are verified when they return to the pool, so one left busy by a timed-out request is replaced. |
| `LINGOCON_API_MAX_INFLIGHT` | `32` | Concurrent requests (except `/healthz`) before answering 503. |
| `RUST_LOG` | `info` | e.g. `info,lingocon_api=debug`. |

Next.js side (`lib/rust-api`): `LINGOCON_API_URL` (e.g. `http://127.0.0.1:3040`),
`LINGOCON_API_TOKEN`, `LINGOCON_API_TIMEOUT_MS` (default 3000). If URL or token is
missing, no request is made.

Fixed limits: request timeout 10 s, body 1 MiB, DB pool wait 2 s / connect 5 s,
graceful drain ≤ 20 s.

## Operations

- **What the server needs** — only the Rust toolchain, to compile. Axum, tokio,
  rustls and the other crates are compiled into the one binary; nothing else is
  installed or run. `rust/scripts/setup-vps.sh` does the one-time setup on the VPS:
  rustup with Rust 1.88 (minimal profile), `LINGOCON_API_TOKEN` and
  `LINGOCON_API_DB_POOL=4` in `.env`, a first low-priority build, and starting the
  service under PM2. Measured cost of a cold build on 2 CPUs / 4 GB: see
  docs/VPS_DEPLOY_RUNBOOK.md.
- **Deploy** — `deploy.sh` builds `cargo build --release --locked` (at `nice 10`,
  ≤ 2 jobs, incremental) when `cargo` is on `PATH` (or in `~/.cargo/bin`) right
  after migrations; a failed build aborts before activation, like a failed Next
  build. `ecosystem.config.js` registers `lingocon-api` (fork mode, 1 instance,
  `kill_timeout` 30 s) only when `rust/target/release/lingocon-api` exists **and**
  `LINGOCON_API_TOKEN` is set (environment or `.env`) — a built but unconfigured
  service does not crash-loop — and `pm2 startOrReload` (re)starts it.
  After the reload the script checks `/healthz` on the port from
  `LINGOCON_API_BIND` (environment, else `.env`; non-fatal; override with
  `RUST_API_HEALTH_URL`). Without cargo the step is skipped with a message.
- **First enablement** — run `bash rust/scripts/setup-vps.sh` once (or put
  `LINGOCON_API_TOKEN` in `.env` and deploy with cargo installed), check
  `curl -s 127.0.0.1:3040/readyz`, then add `LINGOCON_API_URL=http://127.0.0.1:3040`
  to `.env` and `pm2 reload lingocon`.
- **Logs** — JSON lines: `pm2 logs lingocon-api`. Each request logs method, path
  (never query strings, headers or cookies), `request_id`, status and latency.
- **Health** — `/healthz` (process), `/readyz` (database). `pm2 status` shows
  restarts; a configuration error exits immediately and PM2 backs off
  (`max_restarts` 10).
- **Shutdown** — SIGTERM/SIGINT stop accepting connections and drain in-flight
  requests (each ≤ 10 s; hard stop after 20 s).
- **Rollback** — remove `LINGOCON_API_URL` from `.env` and `pm2 reload lingocon`:
  Next stops calling the service immediately. Optionally `pm2 delete lingocon-api`
  (PM2 keeps an app that is no longer in the config until it is deleted).
- **Docker** — `Dockerfile.api` (multi-stage, distroless, non-root). Compose:
  `LINGOCON_API_TOKEN=… LINGOCON_API_URL=http://api:3040 docker compose --profile rust-api up`.
  The port is not published; nginx must never proxy `/v1/internal/`.

## Development

```bash
cd rust
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
# DB integration tests (skipped when unset; refuses anything but a local
# lingocon_rewrite_test_* database without query string):
LINGOCON_API_TEST_DATABASE_URL=postgresql://me@localhost:5432/lingocon_rewrite_test_x \
  cargo test -p lingocon-api --test db
# Run locally:
LINGOCON_API_TOKEN=$(openssl rand -hex 32) DATABASE_URL=postgresql://… cargo run -p lingocon-api
npx vitest run lib/rust-api      # Next.js client
```

Session test vectors come from the installed Auth.js. After upgrading
`next-auth`/`@auth/core`, regenerate and re-run the tests (the script cross-checks
every expectation against Auth.js's own `getToken`):

```bash
node rust/crates/api/tests/fixtures/make-session-vectors.mjs > rust/crates/api/tests/fixtures/session-vectors.json
```

## Adding an endpoint or a page

1. **Logic** that must match TypeScript goes in `lingocon-core` (pure functions +
   parity tests). The API crate only loads data and calls it.
2. **Queries** go in `db/<table>.rs`: `prepare_cached`, `$n` parameters, quoted
   camelCase columns (`"languageId"`), `ORDER BY` whenever output order matters.
   Stream large result sets with `query_raw`.
3. **Handler** in `routes/<domain>.rs`, returning `Result<Json<T>, ApiError>`.
   Validate input (use `Result<Json<T>, JsonRejection>` so bad bodies become 400),
   run CPU-heavy work through `spawn_blocking` with a `state.cpu_permits()` permit,
   and keep responses bounded.
4. **Route** in `app::build_router`: internal endpoints under `/v1/internal`
   (token-guarded), session endpoints elsewhere with `RequireUser`/`OptionalUser`
   plus an `auth::access` check. Session endpoints that change data also need CSRF
   protection (e.g. an `Origin` check) before they are exposed.
5. **Next.js** — add a function in `lib/rust-api/` built on `postInternal` with a
   zod schema; it returns `null` on any failure. The caller authorizes first and
   falls back to the TypeScript implementation on `null`.
6. **Tests** — router tests with `tower::ServiceExt::oneshot` (`tests/http.rs`),
   DB tests in `tests/db.rs` (create and delete only your own `rsapi-it-*` rows),
   vitest for the client.
7. **Serving a page from Rust** — keep the service on loopback and proxy only
   that public path from nginx; never proxy `/v1/internal/`.

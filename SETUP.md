# Local setup

Get LingoCon running on your machine in **one command** (recommended) or follow the manual steps below.

## Quick start (one script)

**Requirements:** [Node.js 18+](https://nodejs.org) and [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for PostgreSQL). Docker is optional if you already run Postgres locally.

```bash
git clone https://github.com/alexcircuits/lingocon.git
cd lingocon
npm run setup
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

That’s it. With `DEV_MODE=true` (set automatically from `.env.example`), you are logged in as **dev@localhost** — no GitHub OAuth required.

### Setup script options

```bash
npm run setup                  # install deps, start Docker Postgres, migrate
npm run setup:full             # same + sample language + official modules
./scripts/setup.sh --help      # all flags
```

| Flag | Description |
|------|-------------|
| `--docker` | Force start PostgreSQL via `docker compose up -d db` |
| `--no-docker` | Skip Docker; use the `DATABASE_URL` already in `.env` |
| `--seed` | Load `prisma/seed.ts` (test user + sample language) |
| `--seed-modules` | Load official modules into `/modules` |
| `--full` | `--seed` and `--seed-modules` |
| `--skip-install` | Skip `npm install` (re-apply migrations/seeds only) |

Examples:

```bash
# You already have Postgres running
./scripts/setup.sh --no-docker

# Fresh clone with demo content
npm run setup:full

# Re-run migrations after pulling main
./scripts/setup.sh --skip-install --no-docker
```

## What the script does

1. Checks Node 18+ and npm
2. Copies `.env.example` → `.env` if missing (Docker-friendly `DATABASE_URL` when using compose)
3. Starts **PostgreSQL 16** in Docker (`docker compose up -d db`) when Docker is available
4. Runs `npm install`
5. Runs `prisma generate` and `prisma migrate deploy`
6. Optionally runs seed scripts

## Manual setup

If you prefer not to use the script:

```bash
npm install
cp .env.example .env
# Edit .env — set DATABASE_URL and DEV_MODE="true"

# Start Postgres (pick one):
docker compose up -d db
# …or use your own PostgreSQL instance

npm run db:generate
npx prisma migrate deploy
npm run dev
```

### Database URL

**Docker Compose (default in setup script):**

```
DATABASE_URL="postgresql://langua:langua@localhost:5432/langua?schema=public"
```

**Custom local Postgres:**

```
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/langua?schema=public"
```

Create the database first if it does not exist:

```bash
createdb langua
```

## Environment variables

Minimum for local development (already in `.env.example`):

| Variable | Value | Purpose |
|----------|-------|---------|
| `DEV_MODE` | `"true"` | Skip OAuth; auto-login as dev user |
| `DATABASE_URL` | see above | PostgreSQL connection |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Canonical URL for links/metadata |

**Never set `DEV_MODE=true` in production** — the app throws on startup if you try.

### Optional (not needed for basic local work)

| Variable | Purpose |
|----------|---------|
| `AUTH_SECRET` | Required when `DEV_MODE` is off |
| `GITHUB_*` / `GOOGLE_*` | OAuth providers |
| `RESEND_API_KEY` / `EMAIL_FROM` | Email verification & password reset |
| `AWS_*` | IPA pronunciation via Polly (`/api/pronounce`) |

See `.env.example` for the full list.

## Demo data

| Command | What you get |
|---------|----------------|
| `npm run db:seed` | User `test@example.com`, language **Test Language** at `/lang/test-language` |
| `npm run db:seed-modules` | Official modules in `/modules` (conjugator, themes, exporters, …) |

With `DEV_MODE`, your session user is `dev@localhost` — create languages from the dashboard or run seeds to populate content owned by other fixture users.

## Useful commands

```bash
npm run dev              # development server (http://localhost:3000)
npm run build            # production build
npm run lint             # ESLint
npm run db:studio        # Prisma Studio (visual DB browser)
npm run db:migrate       # create/apply migrations while developing schema
docker compose down      # stop Docker Postgres
docker compose down -v   # stop Postgres and delete data volume
```

## Troubleshooting

### `PrismaClientInitializationError` / can't reach database

- Is Postgres running? `docker compose ps` or check your local server.
- Does `DATABASE_URL` in `.env` match your credentials and port?
- After `docker compose up -d db`, wait a few seconds and retry.

### Port 5432 already in use

Another Postgres is bound to 5432. Either:

- Point `.env` at that instance and run `./scripts/setup.sh --no-docker`, or
- Change the compose port mapping in `docker-compose.yml` (e.g. `"5433:5432"`) and update `DATABASE_URL`.

### OAuth / “Unauthorized” errors

Enable dev mode in `.env`:

```
DEV_MODE="true"
```

Restart `npm run dev`.

### Migrations failed after pulling latest

```bash
git pull
./scripts/setup.sh --skip-install --no-docker
```

If you changed schema locally, use `npm run db:migrate` instead of `migrate deploy`.

### Docker not installed

Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) **or** install PostgreSQL locally and run:

```bash
./scripts/setup.sh --no-docker
```

## Next steps

- [README.md](README.md) — project overview
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) — scripts, troubleshooting, optional features
- [docs/CODEBASE.md](docs/CODEBASE.md) — where code lives
- [CONTRIBUTING.md](CONTRIBUTING.md) — how to send changes

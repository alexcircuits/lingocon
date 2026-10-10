#!/bin/bash
#
# Production deploy script. Runs migrations, builds a new release, and reloads PM2.
#
# Each build goes into its own directory under .next-releases/ (Next's distDir is
# taken from NEXT_DIST_DIR, see next.config.js). Running workers keep serving
# their own release until PM2 replaces them, so:
#   - a failed build never touches the files the live app is serving (building
#     into the live .next used to empty it while PM2 kept serving from it);
#   - pages are never served half-built while `next build` runs;
#   - tabs opened before the deploy can still download their code-split chunks,
#     because recent static files from the previous release are carried forward.
# The active release name is recorded in .next-release, which next.config.js reads
# when `next start` boots, so a plain PM2 reload moves each worker to it.

set -euo pipefail

# Report which step failed instead of dying silently.
trap 'echo "❌ Deployment FAILED at line $LINENO — previous running app left untouched." >&2' ERR

RELEASES_DIR=".next-releases"
CURRENT_FILE=".next-release"
KEEP_RELEASES=3
# Old clients rarely stay open longer than this; older chunks are not carried over.
CARRY_STATIC_DAYS=7
APP_PORT="${PORT:-3000}"
TSCONFIG_BACKUP="$RELEASES_DIR/.tsconfig.before-build"

# `next build` adds "<distDir>/types/**/*.ts" to tsconfig.json for every new dist
# directory. Put the tracked file back however the build ends (success, failure,
# Ctrl-C) so the checkout stays clean and the next `git pull` can update it.
restore_tsconfig() {
  if [ -f "$TSCONFIG_BACKUP" ]; then
    mv "$TSCONFIG_BACKUP" tsconfig.json
  fi
}
trap 'restore_tsconfig' EXIT

echo "🚀 Starting deployment..."

# Pull latest changes if using git. Non-fatal: a push-to-deploy setup may have
# already updated the working tree, so a failed/skipped pull must not abort.
if [ -d .git ]; then
  echo "📥 Pulling latest changes from Git..."
  git pull origin main || echo "⚠️  git pull skipped/failed — continuing with current checkout"
fi

# Install dependencies.
echo "📦 Installing dependencies..."
npm install

# Generate Prisma client.
echo "💎 Generating Prisma client..."
npx prisma generate

# Run migrations.
echo "🗄️  Running migrations..."
npx prisma migrate deploy

# ── Rust platform service (lingocon-api) — build ─────────────────────────────
# Optional. Built only when cargo is installed; without it Next.js keeps using its
# TypeScript implementations (they are also the fallback whenever LINGOCON_API_URL
# is unset or the service is down). A failed Rust build aborts here, before
# anything is activated, exactly like a failed Next build. ecosystem.config.js
# registers the binary with PM2 once it exists, and the `pm2 startOrReload` below
# (re)starts it. See docs/RUST_SERVICE.md.
RUST_API_BINARY="rust/target/release/lingocon-api"
CARGO_BIN="$(command -v cargo || true)"
if [ -z "$CARGO_BIN" ] && [ -n "${HOME:-}" ] && [ -x "$HOME/.cargo/bin/cargo" ]; then
  CARGO_BIN="$HOME/.cargo/bin/cargo"
fi
if [ -n "$CARGO_BIN" ]; then
  echo "🦀 Building Rust platform service..."
  # Low priority and at most 2 jobs: the VPS has 2 CPUs and other apps on it. Rebuilds
  # are incremental (rust/target is kept between deploys).
  if ! CARGO_BUILD_JOBS="${CARGO_BUILD_JOBS:-2}" nice -n 10 "$CARGO_BIN" build --release --locked --manifest-path rust/Cargo.toml; then
    echo "❌ Rust build failed — previous running app left untouched." >&2
    exit 1
  fi
elif [ -x "$RUST_API_BINARY" ]; then
  echo "⚠️  cargo not found — Rust service NOT rebuilt; PM2 keeps running the existing $RUST_API_BINARY."
else
  echo "ℹ️  cargo not found — Rust service skipped; Next.js falls back to its TypeScript implementations."
fi
# ── end Rust platform service build ──────────────────────────────────────────

PREVIOUS_RELEASE=".next"
if [ -f "$CURRENT_FILE" ]; then
  PREVIOUS_RELEASE="$(cat "$CURRENT_FILE")"
fi
RELEASE="$RELEASES_DIR/$(date -u +%Y%m%d%H%M%S)"
mkdir -p "$RELEASES_DIR"

# Reuse the previous build cache (webpack, image optimizer) so builds and the first
# requests after a deploy are not cold. `next build` keeps <distDir>/cache.
if [ -d "$PREVIOUS_RELEASE/cache" ]; then
  mkdir -p "$RELEASE"
  cp -a "$PREVIOUS_RELEASE/cache" "$RELEASE/cache"
fi

# Build into the new release directory. If this fails, the script aborts before
# anything points at it.
echo "🏗️  Building release $RELEASE..."
cp tsconfig.json "$TSCONFIG_BACKUP"
if ! NEXT_DIST_DIR="$RELEASE" npm run build; then
  restore_tsconfig
  # A partial release must never count as one of the kept releases below.
  rm -rf "$RELEASE"
  echo "❌ Build failed — previous running app left untouched." >&2
  exit 1
fi
restore_tsconfig

# Carry recent hashed static assets forward so clients still running the previous
# build can lazy-load their chunks. Hashed names never collide with new content;
# existing files are never overwritten.
if [ -d "$PREVIOUS_RELEASE/static" ]; then
  echo "♻️  Carrying recent static chunks forward from $PREVIOUS_RELEASE..."
  (cd "$PREVIOUS_RELEASE/static" && find . -type f -mtime "-$CARRY_STATIC_DAYS" -print0) |
    while IFS= read -r -d '' file; do
      target="$RELEASE/static/$file"
      if [ ! -e "$target" ]; then
        mkdir -p "$(dirname "$target")"
        cp -p "$PREVIOUS_RELEASE/static/$file" "$target"
      fi
    done
fi

# Ensure uploads directory exists and has correct permissions.
echo "📁 Setting up uploads directory..."
mkdir -p public/uploads
chmod -R 755 public/uploads

# Reload the application with PM2 (zero downtime). `startOrReload` reloads
# already-running apps with zero downtime AND starts apps newly added to the
# config — plain `reload` would silently skip a new app (e.g. lingocon-worker)
# on its first deploy.
# Activate the release: record it atomically, then reload PM2. Each restarted web
# worker reads .next-release in next.config.js. `startOrReload` reloads running
# apps with zero downtime AND starts apps newly added to the config.
echo "$RELEASE" > "$CURRENT_FILE.tmp"
mv "$CURRENT_FILE.tmp" "$CURRENT_FILE"
# From here on the new release is live; a failure no longer leaves the old app untouched.
trap 'echo "❌ Deployment FAILED at line $LINENO after activating $RELEASE (previous: ${PREVIOUS_RELEASE:-none}) — inspect pm2 status and logs." >&2' ERR
echo "🔄 Reloading application on $RELEASE..."
# A rolling reload cannot move the web cluster to new `args` such as a new listen
# address (`start` → `start -H 127.0.0.1`): the old workers keep the *:3000 socket
# open in the PM2 master, every new worker dies with EADDRINUSE, PM2 marks the app
# "errored" after its quick restarts and then stops the old workers anyway — a full
# outage (reproduced in the deploy rehearsal). When the running args differ from
# ecosystem.config.js, replace the cluster once instead (about 1 s without a
# listener). Start it right away: the startOrReload below first waits for
# lingocon-worker's reload, which would otherwise all be downtime.
WANTED_ARGS="$(node -e 'const a = require("./ecosystem.config.js").apps.find((x) => x.name === "lingocon"); process.stdout.write(a ? JSON.stringify(String(a.args).split(/\s+/).filter(Boolean)) : "")')"
RUNNING_ARGS="$(pm2 jlist 2>/dev/null | node -e 'let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => { try { const p = JSON.parse(s).find((x) => x.name === "lingocon"); process.stdout.write(p ? JSON.stringify(p.pm2_env.args) : "") } catch { /* unreadable list: plain reload below */ } })')"
if [ -n "$RUNNING_ARGS" ] && [ -n "$WANTED_ARGS" ] && [ "$RUNNING_ARGS" != "$WANTED_ARGS" ]; then
  echo "⚠️  lingocon args change $RUNNING_ARGS → $WANTED_ARGS: replacing the cluster (brief gap) instead of a rolling reload."
  pm2 delete lingocon
  pm2 start ecosystem.config.js --only lingocon
fi
pm2 startOrReload ecosystem.config.js

# Verify the workers really serve the new build (its BUILD_ID is in every page):
# 5 consecutive answers from the new build (requests spread over the cluster
# workers), allowing up to 30 s for stragglers of the rolling reload. The page is
# captured first: piping curl into `grep -q` under pipefail fails the check
# whenever grep exits early and curl dies of SIGPIPE.
EXPECTED_BUILD_ID="$(cat "$RELEASE/BUILD_ID")"
CONSECUTIVE=0
for attempt in $(seq 1 30); do
  PAGE="$(curl -fsS "http://127.0.0.1:$APP_PORT/" 2>/dev/null || true)"
  if [[ "$PAGE" == *"$EXPECTED_BUILD_ID"* ]]; then
    CONSECUTIVE=$((CONSECUTIVE + 1))
    [ "$CONSECUTIVE" -ge 5 ] && break
  else
    CONSECUTIVE=0
  fi
  sleep 1
done
if [ "$CONSECUTIVE" -lt 5 ]; then
  echo "❌ The workers did not settle on build $EXPECTED_BUILD_ID from $RELEASE within 30 s — rolling back to $PREVIOUS_RELEASE." >&2
  # PM2's reload stops the old workers even when the new ones never come up, so
  # nothing may be serving now. Point back at the previous build and restart:
  # `reload` ignores "errored" (stopped) instances, `restart` brings them back.
  echo "$PREVIOUS_RELEASE" > "$CURRENT_FILE.tmp"
  mv "$CURRENT_FILE.tmp" "$CURRENT_FILE"
  pm2 restart lingocon || true
  echo "↩️  Rolled back to $PREVIOUS_RELEASE — inspect 'pm2 logs lingocon' for why $RELEASE did not start." >&2
  exit 1
fi

# ── Rust platform service (lingocon-api) — health ────────────────────────────
# Non-fatal: Next.js serves the TypeScript fallback while the service is down.
if [ -x "$RUST_API_BINARY" ]; then
  # Same precedence as the service: environment, then the first definition in .env
  # (dotenvy never overwrites), then the default port.
  RUST_API_BIND="${LINGOCON_API_BIND:-}"
  if [ -z "$RUST_API_BIND" ] && [ -f .env ]; then
    RUST_API_BIND="$(sed -n 's/^[[:space:]]*\(export[[:space:]]\{1,\}\)\{0,1\}LINGOCON_API_BIND=["'\'']\{0,1\}\([^"'\''[:space:]#]*\).*/\2/p' .env | head -n 1 || true)"
  fi
  RUST_API_PORT="${RUST_API_BIND##*:}"
  RUST_API_HEALTH_URL="${RUST_API_HEALTH_URL:-http://127.0.0.1:${RUST_API_PORT:-3040}/healthz}"
  RUST_API_HEALTHY=0
  for attempt in 1 2 3 4 5 6 7 8 9 10; do
    if curl -fsS "$RUST_API_HEALTH_URL" >/dev/null 2>&1; then
      RUST_API_HEALTHY=1
      break
    fi
    sleep 1
  done
  if [ "$RUST_API_HEALTHY" -eq 1 ]; then
    echo "🦀 lingocon-api is healthy ($RUST_API_HEALTH_URL)."
  else
    echo "⚠️  lingocon-api did not answer $RUST_API_HEALTH_URL — Next.js falls back to TypeScript. Check 'pm2 logs lingocon-api' (missing LINGOCON_API_TOKEN?)." >&2
  fi
fi
# ── end Rust platform service health ─────────────────────────────────────────

# Save PM2 state.
pm2 save

# Keep the newest releases (the active one is always the newest).
echo "🧹 Pruning old releases..."
ls -1d "$RELEASES_DIR"/*/ 2>/dev/null | sort -r | tail -n "+$((KEEP_RELEASES + 1))" |
  while IFS= read -r old; do
    # Never delete the release the workers were just pointed at.
    [ "${old%/}" = "$RELEASE" ] && continue
    rm -rf "$old"
  done

echo "✅ Deployment complete! Active release: $RELEASE"

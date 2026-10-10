#!/usr/bin/env bash
# One-time setup so the VPS can build and run the Rust platform service (lingocon-api).
#
#   cd /var/www/lingocon && bash rust/scripts/setup-vps.sh
#
# Axum, tokio and the other crates are compiled into the binary — nothing is installed
# system-wide besides the Rust toolchain (rustup, in ~/.cargo, minimal profile). The
# VPS already has what the build needs (gcc for `ring`, glibc 2.39).
#
# Safe to re-run: it keeps an existing toolchain, token and pool size. It does NOT
# route any page to the service: that is a separate, reversible switch
# (LINGOCON_API_URL in .env, see docs/RUST_SERVICE.md → First enablement).
set -euo pipefail

TOOLCHAIN="${RUST_TOOLCHAIN:-1.88.0}"   # the workspace's rust-version
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO"
[ -f .env ] || { echo "❌ $REPO/.env not found — run this from the app directory." >&2; exit 1; }

CARGO="$HOME/.cargo/bin/cargo"
RUSTUP="$HOME/.cargo/bin/rustup"

# 1. Toolchain (official rustup installer, pinned version, minimal profile).
if [ ! -x "$RUSTUP" ]; then
  echo "🦀 Installing rustup + Rust $TOOLCHAIN (minimal profile)..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- -y --profile minimal --default-toolchain "$TOOLCHAIN" --no-modify-path
fi
"$RUSTUP" toolchain install "$TOOLCHAIN" --profile minimal
"$RUSTUP" default "$TOOLCHAIN"
"$CARGO" --version

# 2. Service settings in .env (existing values win; the token is generated once).
if ! grep -Eq '^[[:space:]]*(export[[:space:]]+)?LINGOCON_API_TOKEN=[^[:space:]]' .env; then
  printf '\n# Rust platform service (docs/RUST_SERVICE.md)\nLINGOCON_API_TOKEN=%s\n' "$(openssl rand -hex 32)" >> .env
  echo "🔑 Added LINGOCON_API_TOKEN to .env"
fi
if ! grep -Eq '^[[:space:]]*(export[[:space:]]+)?LINGOCON_API_DB_POOL=' .env; then
  # 2 CPUs: a small pool, counted against PostgreSQL's max_connections with Prisma's.
  echo 'LINGOCON_API_DB_POOL=4' >> .env
  echo "🗄️  Added LINGOCON_API_DB_POOL=4 to .env"
fi

# 3. First build, gently (the box is shared). Later deploys rebuild incrementally.
echo "🏗️  Building lingocon-api (low priority)..."
CARGO_BUILD_JOBS="${CARGO_BUILD_JOBS:-2}" nice -n 10 "$CARGO" build --release --locked --manifest-path rust/Cargo.toml

# 4. Start it under PM2 (ecosystem.config.js registers it now that binary + token exist).
pm2 startOrReload ecosystem.config.js --only lingocon-api
pm2 save
for _ in $(seq 1 15); do
  if curl -fsS http://127.0.0.1:3040/readyz >/dev/null 2>&1; then
    echo "✅ lingocon-api is ready on 127.0.0.1:3040 (not used by pages yet)."
    echo "   To route the studio overview to it: add LINGOCON_API_URL=http://127.0.0.1:3040 to .env, then 'pm2 reload lingocon'."
    exit 0
  fi
  sleep 1
done
echo "⚠️  lingocon-api did not become ready — check 'pm2 logs lingocon-api'." >&2
exit 1

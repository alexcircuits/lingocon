#!/bin/bash
#
# Production deploy script. Runs migrations, builds, and reloads PM2.
#
# Fails fast: `set -euo pipefail` means any failed step (npm install, prisma
# generate, migrate deploy, or build) aborts the script BEFORE PM2 reloads, so a
# broken build can never replace a working one. The previous PM2 process keeps
# serving until a clean build succeeds.

set -euo pipefail

# Report which step failed instead of dying silently.
trap 'echo "❌ Deployment FAILED at line $LINENO — previous running app left untouched." >&2' ERR

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

# Build the application. If this fails, set -e aborts before the PM2 reload below.
echo "🏗️  Building application..."
npm run build

# Ensure uploads directory exists and has correct permissions.
echo "📁 Setting up uploads directory..."
mkdir -p public/uploads
chmod -R 755 public/uploads

# Reload the application with PM2 (zero downtime). `startOrReload` reloads
# already-running apps with zero downtime AND starts apps newly added to the
# config — plain `reload` would silently skip a new app (e.g. lingocon-worker)
# on its first deploy.
echo "🔄 Reloading application..."
pm2 startOrReload ecosystem.config.js

# Save PM2 state.
pm2 save

echo "✅ Deployment complete!"

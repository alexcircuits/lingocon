#!/bin/bash

echo "🚀 Starting deployment..."

# Pull latest changes if using git
if [ -d .git ]; then
  echo "📥 Pulling latest changes from Git..."
  git pull origin main
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Generate Prisma client
echo "💎 Generating Prisma client..."
npx prisma generate

# Run migrations
echo "🗄️ Running migrations..."
npx prisma migrate deploy

# Build the application
echo "🏗️ Building application..."
npm run build

# Ensure uploads directory exists and has correct permissions
echo "📁 Setting up uploads directory..."
mkdir -p public/uploads
chmod -R 755 public/uploads

# Reload the application with PM2 (Zero Downtime)
echo "🔄 Reloading application..."
pm2 reload ecosystem.config.js || pm2 start ecosystem.config.js

# Save PM2 state
pm2 save

echo "✅ Deployment complete!"

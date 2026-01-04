# Production Environment Variables checklist

Create a `.env` file in your VPS app directory (`/var/www/lingocon/.env`) with these values:

```env
# --- DATABASE ---
# Format: postgresql://USER:PASSWORD@localhost:5432/DATABASE
DATABASE_URL="postgresql://lingocon:YOUR_SECURE_PASSWORD@localhost:5432/lingocon"

# --- NEXT AUTH SECURITY ---
# Generate a secret with: openssl rand -base64 32
AUTH_SECRET="your-32-character-secret"

# The base URL of your site
AUTH_URL="https://lingocon.com"

# Set to true if you are behind a proxy (like Nginx)
AUTH_TRUST_HOST="true"

# --- OAUTH PROVIDERS ---
# Get these from GitHub Developer Settings
GITHUB_CLIENT_ID="xxx"
GITHUB_CLIENT_SECRET="xxx"

# Get these from Google Cloud Console
GOOGLE_CLIENT_ID="xxx"
GOOGLE_CLIENT_SECRET="xxx"

# --- APP CONFIG ---
# Disable dev-only mock auth
DEV_MODE="false"

# Node environment
NODE_ENV="production"
```

### Steps to get secrets:

1. **AUTH_SECRET**: Run `openssl rand -base64 32` in your terminal.
2. **GitHub**: Create an OAuth app at https://github.com/settings/developers
   - Homepage: `https://lingocon.com`
   - Callback: `https://lingocon.com/api/auth/callback/github`
3. **Google**: Create credentials at https://console.cloud.google.com/
   - Authorized Origins: `https://lingocon.com`
   - Authorized Redirects: `https://lingocon.com/api/auth/callback/google`

const fs = require('fs');
const path = require('path');

// Rust platform service (rust/crates/api). Optional: it is only managed by PM2 once
// deploy.sh has built the release binary, and Next falls back to TypeScript while
// LINGOCON_API_URL is unset or the service is down. See docs/RUST_SERVICE.md.
const RUST_API_BINARY = path.join(__dirname, 'rust/target/release/lingocon-api');

/** LINGOCON_API_TOKEN from the environment or the repo's .env (what the service reads). */
function rustApiTokenConfigured() {
    if (process.env.LINGOCON_API_TOKEN) return true;
    try {
        const env = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
        return /^\s*(?:export\s+)?LINGOCON_API_TOKEN\s*=\s*["']?[^\s"'#]+/m.test(env);
    } catch {
        return false;
    }
}

const apps = [
    {
        name: 'lingocon',
        script: 'node_modules/next/dist/bin/next',
        // Loopback only: nginx (and deploy.sh's checks) reach it on 127.0.0.1. Listening
        // on every interface let anyone bypass nginx and forge X-Real-IP, the address
        // the login rate limits key on.
        args: 'start -H 127.0.0.1',
        instances: 'max',
        exec_mode: 'cluster',
        env: {
            NODE_ENV: 'production',
            PORT: 3000
        }
    },
    {
        name: 'lingocon-worker',
        script: 'node_modules/.bin/tsx',
        args: 'scripts/worker.ts',
        instances: 1,
        exec_mode: 'fork',
        // PM2's default ~1.6s SIGKILL window is too short to let an
        // in-flight job finish. 30s covers Wave 0 handlers; anything
        // beyond that is protected by the queue's stale-claim reclaim.
        kill_timeout: 30000,
        env: {
            NODE_ENV: 'production'
        }
    }
];

// Built but not configured (no token) would only crash-loop: start it once both exist.
if (fs.existsSync(RUST_API_BINARY) && rustApiTokenConfigured()) {
    apps.push({
        name: 'lingocon-api',
        script: RUST_API_BINARY,
        interpreter: 'none',
        // Reads LINGOCON_API_*, DATABASE_URL and AUTH_SECRET from the repo's .env
        // (real environment variables win). Logs are JSON lines on stdout.
        cwd: __dirname,
        instances: 1,
        exec_mode: 'fork',
        // SIGTERM starts a graceful drain (requests are capped at 10s and the
        // service exits after at most 20s); SIGKILL only after 30s.
        kill_timeout: 30000,
        // A configuration error exits immediately: back off instead of hot-looping.
        exp_backoff_restart_delay: 1000,
        max_restarts: 10,
        min_uptime: 5000
    });
}

module.exports = { apps };

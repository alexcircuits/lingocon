# Deploying LingoCon to the VPS

How to ship this codebase to the production VPS safely, what it changes there, and how
to roll back. Based on a read-only audit of the server and a full deploy rehearsal in a
container that mirrors it (2026-10-10).

## The server today (read-only audit, 2026-10-10)

| | |
|---|---|
| Host | Ubuntu 24.04.3, x86_64, **2 CPUs**, 7.9 GB RAM (~2.7 GB free), 4 GB swap (1.4 GB used), 53 GB free disk |
| Shared with | statler, flokzy (api, website, workers, bots, Kotlin API), noir-eco — keep their CPU/RAM/ports untouched |
| Runtime | Node 22.22.0 (Unicode 16), npm 10.9.4, PM2 6.0.14, PostgreSQL 16 on localhost, nginx 1.24 |
| App | `/var/www/lingocon` — **not a git checkout**: a bare repo `/var/git/lingocon.git` (the `vps` git remote) has a post-receive hook that checks `main` out into it and runs `./deploy.sh`, so **`git push vps main` deploys immediately**. Files equal GitHub `main` @ `b3309af` plus `.env`, `public/uploads` (548 MB) and 4 untracked scripts |
| PM2 | `lingocon` (cluster, 2 workers, `next start`, PORT 3000, ~1.2 GB each), `lingocon-worker` (tsx) |
| Build | `.next` 2.1 GB, of which 2.0 GB is `.next/cache` |
| nginx | proxies everything (including `/_next/static`) to `127.0.0.1:3000`; caches cookie-less GETs 30 s and serves stale on upstream errors; `/uploads/` served from disk |
| Database | `lingocon`, 663 MB, 53 migrations — **identical to this branch's**; 21 of 100 connections in use |
| Rust | no toolchain |

Pre-existing risks found (not changed by deploying):

- **No automatic backup of the LingoCon database.** The newest dump in `/root/backups` is
  from January. Always take one before a deploy (below), and consider a nightly cron.
- **Firewall inactive** (`ufw` off, INPUT ACCEPT): every port a process binds on all
  interfaces is public. Next on `*:3000` answered from the internet, bypassing nginx and
  TLS and letting clients forge `X-Real-IP` (the login rate-limit key). This codebase now
  binds Next to `127.0.0.1` (see below); other apps on the box (e.g. ports 3002, 44873)
  are still exposed until a firewall allows only 22/80/443.
- Production still serves the old service worker (`lingocon-v1`) that cached studio
  pages — the stale-UI bug. Deploying replaces it (v2 purges v1's caches).

## What a deploy of this branch changes

- **No database change**: `prisma migrate deploy` has nothing to apply.
- **Framework upgrade (security)**: Next 14.2.35 (end of life; critical advisories incl.
  RCE in the image optimizer, which this site uses) → **Next 15.5.27 + React 19**, plus
  patched Auth.js, sharp (re-encodes uploads), Tiptap/ProseMirror. `npm audit --omit=dev`
  reports nothing. `npm install` downloads the new packages and its `postinstall` applies
  `patches/next+15.5.27.patch` (a React hydration fix, see `patches/README.md`); if the
  patch does not apply, `npm install` fails and `deploy.sh` stops before building. Needs
  Node ≥ 20.9 (the VPS has 22.22).
- **Deploy this one in a quiet window.** `npm install` replaces `node_modules` in place
  before the build: for the few build minutes the running Next 14 workers serve from
  already-loaded code, but a worker that restarts in that window (crash, OOM) would boot
  the Next 14 release on the Next 15 packages and fail until the deploy reloads it. If the
  deploy fails after `npm install`, restore consistency before any restart: put back the
  previous `package.json` and `package-lock.json` and run `npm install` (or finish the
  deploy). Later deploys without dependency changes are unaffected.
- **Tabs left open across this deploy** run the Next 14 client against the Next 15
  server: their next in-app navigation may fall back to a full page load (or, rarely,
  show an error that a reload fixes). Later deploys are not affected.
- **Release directories**: `deploy.sh` builds into `.next-releases/<timestamp>` while the
  old build keeps serving, records the live one in `.next-release`, reloads PM2, checks
  that every worker serves the new `BUILD_ID`, and **rolls back automatically** if not.
  Static chunks of the previous build are carried over (open tabs keep working); the 3
  newest releases are kept (~0.9 GB each).
- **Next listens on `127.0.0.1:3000` only** (`ecosystem.config.js`). A rolling reload
  cannot change a listen address, so `deploy.sh` notices the changed arguments and
  replaces the cluster once: **about 1 second without a listener** (nginx keeps serving
  cached anonymous pages; a signed-in request in that second can get a 502). Later
  deploys are rolling reloads with no gap.
- The manual habit still works: `npm run build && pm2 reload lingocon` builds `.next`
  and, if the build succeeds, makes it the served build again (a failed build leaves the
  running release in place).
- `lingocon-worker` now exits promptly on reload instead of being killed after 30 s.
- The Rust service stays off (no binary, `LINGOCON_API_URL` unset); every page uses the
  TypeScript implementations.

## Rehearsal results (container: Ubuntu 24.04, 2 CPUs, 4 GB, Node 22.22, PM2 6.0.14)

| Drill | Result |
|---|---|
| First deploy over today's production state (with the cluster replacement) | ~1 s gap at the switch, then 0 failed requests; deploy 185 s (build 138 s cold, 61 s warm) |
| Rollback by pointer (`.next` ↔ release) | 0 failed requests |
| Manual `npm run build && pm2 reload lingocon` | new build served, 0 failed requests |
| Repeated deploys, chunk carry-over, pruning | old chunks still served, 3 releases kept |
| Failing build | aborted before activation, old build kept serving, nothing left behind |
| Release that crashes at boot | rolled back automatically (`.next-release` restored, `pm2 restart`) |
| Peak build memory | ~2.4 GB largest process, 3.3–3.9 GB whole build tree — same as today's manual builds; on the VPS this swaps ~0.7–1.2 GB, so other apps slow down for a few minutes |

## Runbook

All commands on the VPS run in `/var/www/lingocon` as root, as today.

1. **Pre-flight (read-only).**
   ```bash
   pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const p of JSON.parse(s))if(p.name.startsWith("lingocon"))console.log(p.name,p.pm2_env.status,JSON.stringify(p.pm2_env.args))})'
   free -m && df -h /
   grep -n "proxy_pass" /etc/nginx/sites-available/lingocon   # must be http://127.0.0.1:3000
   ```
   Continue only if both apps are `online`, ≥2 GB RAM + swap and ≥10 GB disk are free.
2. **Back up** the database and the code (not `node_modules`/builds):
   ```bash
   mkdir -p /root/backups
   su - postgres -c "pg_dump --no-owner --no-privileges lingocon" | gzip > /root/backups/lingocon-$(date -u +%Y%m%dT%H%M%SZ).sql.gz
   tar --exclude=node_modules --exclude=.next --exclude=.next-releases --exclude=public/uploads -czf /root/backups/lingocon-code-$(date -u +%Y%m%dT%H%M%SZ).tgz -C /var/www lingocon
   ```
3. **Deploy** the approved, merged `main` (keeps `.env`, uploads and untracked files;
   deletes nothing):
   ```bash
   git push vps main
   ```
   The server's post-receive hook checks it out and runs `deploy.sh` (3–5 minutes),
   streaming its output back. It stops with `❌` and the reason if any step fails;
   before activation nothing changes for users, after activation it rolls back by
   itself. (Equivalent by hand: `git archive <commit> | ssh vps 'tar -x -C
   /var/www/lingocon'`, then `bash deploy.sh` there. Never copy `rust/target`, `.next*`
   or `node_modules` from a laptop.)
4. **Verify**:
   ```bash
   ss -ltnp | grep ':3000'                       # 127.0.0.1:3000 only
   curl -s https://lingocon.com/sw.js | grep -o 'lingocon-static-v2'
   curl -s -o /dev/null -w '%{http_code}\n' https://lingocon.com/donate   # 200, page renders
   pm2 status
   ```
   Then sign in, open a studio dictionary, add a word (it appears without reloading).
5. **Roll back** if needed:
   - Build only: `echo .next > .next-release && pm2 reload lingocon` (the first deploy's
     previous build is `.next`; later ones are listed in `.next-releases/`).
   - Code too: unpack the code backup from step 2 over `/var/www/lingocon`, run
     `npm run build && pm2 reload lingocon`.
   - Going back to listening on all interfaces needs `pm2 delete lingocon && pm2 start
     ecosystem.config.js --only lingocon` with the old `ecosystem.config.js` (~1 s gap).

## Running the Rust service on the VPS

"Axum" is not installed on the server: it is a library compiled into the
`lingocon-api` binary. The server needs the Rust toolchain to compile it, once
(after that, every `deploy.sh` rebuilds incrementally at low priority).

Measured in a VPS-sized container (2 CPUs, 4 GB, Rust 1.88): a cold release build
takes **57 s** with a **0.67 GB** peak (far below a Next build), a rebuild after a
source change **12 s**; the binary is 4.7 MB and `rust/target` ~270 MB. The toolchain
(minimal profile) adds a few hundred MB under `~/.cargo` and `~/.rustup`.

1. After the deploy above: `cd /var/www/lingocon && bash rust/scripts/setup-vps.sh`.
   It installs rustup + Rust 1.88 (minimal profile, `~/.cargo`), adds
   `LINGOCON_API_TOKEN` (generated) and `LINGOCON_API_DB_POOL=4` to `.env`, builds the
   binary at low priority, starts `lingocon-api` under PM2 on `127.0.0.1:3040` and
   waits for `/readyz`. Pages do not use it yet.
2. Route the studio overview to it: add `LINGOCON_API_URL=http://127.0.0.1:3040` to
   `.env`, then `pm2 reload lingocon`. Check `pm2 logs lingocon-api` shows requests.
3. Rollback: remove `LINGOCON_API_URL` from `.env` and `pm2 reload lingocon`
   (optionally `pm2 delete lingocon-api && pm2 save`). Details: `docs/RUST_SERVICE.md`.

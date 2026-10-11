# Deploying LingoCon to the VPS

How to ship this codebase to the production VPS safely, what it changes there, and how
to roll back. Based on a read-only audit of the server and a full deploy rehearsal in a
container that mirrors it (2026-10-10), re-checked on 2026-10-11 for the anonymous
statistics update (below).

## Re-check before the first deploy (read-only, 2026-10-11)

- **Still live:** GitHub `main` @ `b3309af`. The deploy repo's index is from that
  checkout, so `git push vps main` fast-forwards, and the checkout deletes the 6 files the
  update removes. Those are code only; all 7 git-tracked files under `public/uploads` are
  kept. Server-side edits since then are mode changes only, plus an `npm install`
  rewrite of `package-lock.json`, which the checkout replaces.
- **Host:** 3.5 GB RAM available, 2.7 GB swap free, 52 GB disk free, load ~0.3. Node
  22.22.0 and npm 10.9.4, PM2 6.0.14 with `pm2-root` enabled at boot, cargo 1.88.0 in
  `/root/.cargo`. Nothing listens on 3040.
- **Database:** 667 MB, server time zone UTC, 38 of 100 connections in use.
  - `_prisma_migrations` has 56 rows. Three are January attempts that failed, were
    marked rolled back, and were then applied again successfully. Prisma treats them as
    resolved and does not block `migrate deploy`.
  - Pre-existing cosmetic drift: lower-case FK and index names on `slug_reservations`.
    Harmless.
- **`.env`:** has `LINGOCON_API_TOKEN`, `LINGOCON_API_DB_POOL` **and
  `LINGOCON_API_URL=http://127.0.0.1:3040`**, added with the Rust setup on 2026-10-10.
  So this deploy starts `lingocon-api` *and* routes the studio overview to it at once (see
  below). It also has three `NEXT_PUBLIC_*PLAUSIBLE*`/analytics variables that no code
  reads since Plausible was removed (`fd2ac34`); the live pages load no analytics script.
- **nginx (live config):**
  - `/api/` is proxied uncached with `Host` and `X-Real-IP`, which is what the
    statistics beacon's origin check and rate limits need.
  - The 30 s anonymous cache only stores cookie-less GETs.
  - There is no `client_max_body_size`, so the default 1 MB applies and CSV imports over
    1 MB get a 413 (pre-existing).
- **Rehearsal on a copy of the 2026-10-10 production dump:**
  - `migrate status` lists only `20261011120000_add_anonymous_visitor_stats`, and
    `migrate deploy` applies it cleanly.
  - The production build served all 59 smoke requests with 200 and logged no errors
    (home, browse, search, families, learn, docs, modules, `/cookies`, the three
    most-favourited public languages' reader and learn pages, a profile).
  - Beacons stored a public language's slug, dropped a private one's, kept only the
    referrer domain, stored no IP, and refused a cross-site POST with 403.

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

- **One additive migration**: `20261011120000_add_anonymous_visitor_stats` creates four
  new `stats_*` tables (anonymous visitor statistics) and touches nothing else. Rolling
  the code back leaves them in place, unused and harmless.
- **New on the site:**
  - Anonymous visitor statistics: a beacon to `/api/stats`, an admin Traffic page, and
    an hourly `stats_rollup` worker job at :10 UTC.
  - A cookie notice, and a `/cookies` page.
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
- **The Rust service starts with this deploy.** The toolchain and binary were prepared on
  2026-10-10 and `.env` has `LINGOCON_API_TOKEN`, so `deploy.sh` rebuilds it
  incrementally, and `ecosystem.config.js` registers `lingocon-api` on 127.0.0.1:3040.
  Because `LINGOCON_API_URL` is also set, the studio overview uses it immediately. When
  the service is down, Next falls back to the TypeScript implementation. To ship the Next
  upgrade on its own first, comment `LINGOCON_API_URL` out of `.env` before pushing, and
  put it back later followed by `pm2 reload lingocon`.

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
   Optional, any time (it limits a route only the new code has):
   - Rate-limit the statistics beacon in nginx. Create
     `/etc/nginx/conf.d/lingocon-ratelimit.conf` with the `limit_req_zone` line from
     `nginx.conf.example`.
   - Add its `location = /api/stats { … }` block to `/etc/nginx/sites-available/lingocon`
     inside the 443 server, before `location /api/`.
   - Then `nginx -t && systemctl reload nginx`.
4. **Verify**:
   ```bash
   ss -ltnp | grep -E ':(3000|3040)\b'           # 127.0.0.1:3000 and 127.0.0.1:3040 only
   curl -s https://lingocon.com/sw.js | grep -o 'lingocon-static-v2'
   curl -s -o /dev/null -w '%{http_code}\n' https://lingocon.com/donate    # 200, page renders
   curl -s -o /dev/null -w '%{http_code}\n' https://lingocon.com/cookies   # 200
   curl -s -o /dev/null -w '%{http_code}\n' -X POST https://lingocon.com/api/stats -H 'sec-fetch-site: cross-site' --data '{}'   # 403
   pm2 status                                    # lingocon ×2, lingocon-worker, lingocon-api online
   su - postgres -c "psql -d lingocon -Atc 'select count(*) from stats_presence'"   # > 0 once people browse
   ```
   Then:
   - Sign in, open a studio dictionary and add a word. It should appear without reloading.
   - Open `/admin/traffic`. "Online now" should count a visit you make in a private window
     within about 25 s.
   - After the next :10 past the hour, `pm2 logs lingocon-worker --lines 50` should show
     `[worker] completed stats_rollup`.
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

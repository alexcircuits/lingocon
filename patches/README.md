# Dependency patches

Applied by `patch-package --error-on-fail --error-on-warn` on every `npm install` / `npm ci`
(the `postinstall` script; the Dockerfile copies `patches/` before `npm ci`). If a patch no longer
applies, or was made for another version, the install fails and `deploy.sh` stops before
building. `deploy.sh` also drops the reused webpack cache when `patches/` changes (webpack
assumes `node_modules` never changes in place). `lib/__tests__/vendored-react-patches.test.ts`
checks that the fixes are present.

## `next+15.5.27.patch`

Backports two React fixes into the React 19.2 canary that Next 15.5.27 vendors
(`next/dist/compiled/react-dom`, the copy the App Router uses — not the `react-dom` package).
Both are upstream code that ships in `react-dom` 19.3 and in the React that Next 16 vendors;
the patch adds only those lines, to the four stable client builds.

### 1. Hydration replay of a suspended host component (`replaySuspendedUnitOfWork`)

**Bug:** when a host element's child suspends while hydrating (typically a client component
whose JavaScript chunk has not loaded yet, which happens under load or on slow devices), React
replays the element with its hydration cursor already inside it. It reports a hydration
mismatch (error #418), client-renders the tree, and the streamed Suspense reveal script then
fails (`Cannot read properties of null (reading 'parentNode')`), leaving a hidden duplicate of
the page content.

**Fix:** on replay, rewind the hydration cursor to the host element (host component case).

### 2. Pings during render while suspended with delay (`pingSuspendedRoot`)

**Bug:** a router transition (`router.refresh()`, a `<Link>` or `router.push/replace`
navigation, a Server Action's redirect) renders the new RSC payload while it is still
streaming in. When the render suspends on a chunk that has in fact already arrived, the
chunk resolves *synchronously* inside React's ping listener, i.e. during the render. If the
render was "suspended with delay" (a transition that would otherwise show a fallback), the
vendored React neither restarted the render nor recorded the ping, so the transition stayed
suspended forever: the click, refresh or redirect never updated the page (e.g. the language
switch, renames, sign-out). It only happens when the response streams in slowly — a busy
server or network — which is why it showed up under load.

**Fix:** record the ping (`workInProgressRootPingedLanes |= pingedLanes`) when it arrives during
render, so React retries the lane. Regression test: `e2e/public/locale.spec.ts` ("the switch is
applied even when the server answers the refresh slowly"), which holds the refresh response back
600 ms; it failed 5/5 before the fix.

**Removing it:** upgrading to a Next release that vendors these fixes (any Next 16) makes the
patch unnecessary — delete it together with the `postinstall` script, the exact `next` pin in
`package.json` and `lib/__tests__/vendored-react-patches.test.ts`.

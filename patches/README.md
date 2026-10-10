# Dependency patches

Applied by `patch-package --error-on-fail --error-on-warn` on every `npm install` / `npm ci`
(the `postinstall` script; the Dockerfile copies `patches/` before `npm ci`). If a patch no longer
applies, or was made for another version, the install fails and `deploy.sh` stops before
building. `deploy.sh` also drops the reused webpack cache when `patches/` changes (webpack
assumes `node_modules` never changes in place).

## `next+15.5.27.patch`

Backports a React fix into the React 19.2 canary that Next 15.5.27 vendors
(`next/dist/compiled/react-dom`, the copy the App Router uses — not the `react-dom` package).

**Bug:** when a host element's child suspends while hydrating (typically a client component
whose JavaScript chunk has not loaded yet, which happens under load or on slow devices), React
replays the element with its hydration cursor already inside it. It reports a hydration
mismatch (error #418), client-renders the tree, and the streamed Suspense reveal script then
fails (`Cannot read properties of null (reading 'parentNode')`), leaving a hidden duplicate of
the page content.

**Fix:** on replay, rewind the hydration cursor to the host element (`replaySuspendedUnitOfWork`,
host component case). The same code ships in `react-dom` 19.3 and in the React that Next 16
vendors; this patch adds only those lines, to the four stable client builds.

**Removing it:** upgrading to a Next release that vendors the fix (any Next 16) makes the patch
unnecessary — delete it together with the `postinstall` script and the exact `next` pin in
`package.json`.

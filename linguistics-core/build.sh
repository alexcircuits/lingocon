#!/usr/bin/env bash
# Builds the linguistics core to WebAssembly and stages it under public/wasm/
# so Next.js serves it as a static asset.
#
# Prefers TinyGo (≈30× smaller binary) when available, falling back to the
# standard Go toolchain. The matching wasm_exec.js runtime glue is copied
# alongside the binary either way.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT="$ROOT/../public/wasm"
mkdir -p "$OUT"
cd "$ROOT"

if command -v tinygo >/dev/null 2>&1; then
  echo "Building sound-change.wasm with TinyGo…"
  tinygo build -o "$OUT/sound-change.wasm" -no-debug -target wasm ./wasm
  cp "$(tinygo env TINYGOROOT)/targets/wasm_exec.js" "$OUT/wasm_exec.js"
else
  echo "Building sound-change.wasm with the Go toolchain (install TinyGo for a ~30× smaller binary)…"
  GOOS=js GOARCH=wasm go build -trimpath -ldflags="-s -w" -o "$OUT/sound-change.wasm" ./wasm
  WASM_EXEC="$(go env GOROOT)/lib/wasm/wasm_exec.js"
  [ -f "$WASM_EXEC" ] || WASM_EXEC="$(go env GOROOT)/misc/wasm/wasm_exec.js"
  cp "$WASM_EXEC" "$OUT/wasm_exec.js"
fi

echo "✓ $OUT/sound-change.wasm ($(du -h "$OUT/sound-change.wasm" | cut -f1))"
echo "✓ $OUT/wasm_exec.js"

#!/usr/bin/env bash
# Install, build and test. The last stdout line is the verdict.
cd "$(dirname "$0")/.." || exit 1
gates=0
fail() { echo "VERIFY {\"verdict\":\"fail\",\"failed\":\"$1\"}"; exit 1; }
step() { name=$1; shift; echo "== $name"; "$@" >&2 || fail "$name"; gates=$((gates + 1)); }

build() { for f in index.js posix.js lib/*.js scripts/*.mjs; do node --check "$f" || return 1; done; }
smoke() {
  d=$(mktemp -d) || return 1
  node scripts/vendor.mjs sync "$d" && node scripts/vendor.mjs check "$d" --offline || { rm -rf "$d"; return 1; }
  echo ' ' >> "$d/vendor/picomatch-extglob-guard/lib/utils.js"
  if node scripts/vendor.mjs check "$d" --offline 2>/dev/null; then rm -rf "$d"; echo "drift was not detected" >&2; return 1; fi
  rm -rf "$d"
}

step install npm install --no-audit --no-fund --ignore-scripts
step build build
step test npm test --silent
step vendor-smoke smoke
echo "VERIFY {\"verdict\":\"pass\",\"gates\":$gates}"

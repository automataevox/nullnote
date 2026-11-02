#!/usr/bin/env bash
# Build the nullnote desktop app on this computer.
#   ./electron/build.sh            -> app for this computer's system
#   ./electron/build.sh all        -> Windows, macOS (Intel + Apple Silicon) and Linux
set -euo pipefail
cd "$(dirname "$0")/.."
npm install
npx vite build --config electron/vite.config.ts
STAGE=electron-release/stage
rm -rf "$STAGE" && mkdir -p "$STAGE"
cp electron/main.cjs "$STAGE/"
cp electron/icon.ico "$STAGE/icon.ico"
mkdir -p "$STAGE/dist"
cp -r electron-release/client "$STAGE/dist/client"
echo '{"name":"nullnote","version":"1.0.1","main":"main.cjs"}' > "$STAGE/package.json"
if [ "${1:-}" = "all" ]; then TARGETS="win32:x64 darwin:x64 darwin:arm64 linux:x64"; else TARGETS="current"; fi
for t in $TARGETS; do
  if [ "$t" = "current" ]; then ARGS=""; else ARGS="--platform=${t%%:*} --arch=${t##*:}"; fi
  case "$t" in win32*|current*) ARGS="$ARGS --icon=icon.ico";; esac
  npx --yes @electron/packager "$STAGE" nullnote $ARGS --electron-version=38.2.0 --out=electron-release --overwrite
done
echo "Done. Your app is in electron-release/"

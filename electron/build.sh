#!/usr/bin/env bash
# Build updater-capable desktop packages.
#   ./electron/build.sh win        -> Windows NSIS installer
#   ./electron/build.sh linux     -> Linux AppImage
#   ./electron/build.sh mac       -> macOS x64 and arm64 ZIPs (manual updates)
set -euo pipefail
cd "$(dirname "$0")/.."
TARGET="${1:-linux}"
VERSION="${NULLNOTE_VERSION:-0.0.0-dev}"
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]]; then
  echo "Invalid NULLNOTE_VERSION: $VERSION" >&2
  exit 1
fi
bun install --frozen-lockfile
export NULLNOTE_VERSION="$VERSION"
npx vite build --config electron/vite.config.ts
STAGE=electron-release/stage
rm -rf "$STAGE" && mkdir -p "$STAGE"
cp electron/main.cjs "$STAGE/"
cp electron/preload.cjs "$STAGE/"
cp electron/icon.ico "$STAGE/icon.ico"
cp public/icons/icon-512.png "$STAGE/icon.png"
mkdir -p "$STAGE/dist"
cp -r electron-release/client "$STAGE/dist/client"
printf '{"name":"nullnote","version":"%s","main":"main.cjs","desktopName":"com.electron.nullnote","dependencies":{"electron-updater":"%s"}}\n' \
  "$VERSION" "$(node -p 'require("./package.json").dependencies["electron-updater"]')" > "$STAGE/package.json"
npm install --prefix "$STAGE" --omit=dev --no-audit --no-fund
case "$TARGET" in
  win) npx electron-builder --config electron-builder.yml --win nsis --x64 --publish never ;;
  linux) npx electron-builder --config electron-builder.yml --linux AppImage --x64 --publish never ;;
  mac) npx electron-builder --config electron-builder.yml --mac zip --x64 --arm64 --publish never ;;
  *) echo "Unknown desktop target: $TARGET" >&2; exit 1 ;;
esac
echo "Done. Desktop packages and update metadata are in electron-release/packages/"

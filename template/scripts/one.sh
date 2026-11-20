#!/bin/bash
# scripts/one.sh frame [lang] -> out/qa/<lang>-<frame>.jpg
cd "$(dirname "$0")/.."
export REMOTION_CHROME=~/.cache/remotion-chrome/mac-arm64/chrome-headless-shell-mac-arm64/chrome-headless-shell
node scripts/stills.mjs "$1" "${2:-en}" out/qa

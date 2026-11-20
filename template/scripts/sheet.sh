#!/bin/bash
# scripts/sheet.sh "f1,f2,..." lang name  -> out/qa/<name>.png (3 columns, frame number burned in)
set -e
cd "$(dirname "$0")/.."
export REMOTION_CHROME=~/.cache/remotion-chrome/mac-arm64/chrome-headless-shell-mac-arm64/chrome-headless-shell
node scripts/stills.mjs "$1" "${2:-en}" out/qa >/dev/null
args=(); fl=""; i=0
for f in ${1//,/ }; do p=$(printf "out/qa/%s-%04d.jpg" "${2:-en}" $f); args+=(-i "$p"); fl+="[$i]scale=640:360[v$i];"; i=$((i+1)); done
n=$i; cols=3; rows=$(( (n+cols-1)/cols ))
lay=""; for ((k=0;k<n;k++)); do lay+="$(( (k%cols)*640 ))_$(( (k/cols)*360 ))|"; done
ins=""; for ((k=0;k<n;k++)); do ins+="[v$k]"; done
ffmpeg -v error -y "${args[@]}" -filter_complex "${fl}${ins}xstack=inputs=$n:layout=${lay%|}:fill=black" "out/qa/${3:-sheet}.png"
echo "out/qa/${3:-sheet}.png"

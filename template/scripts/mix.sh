#!/bin/bash
# scripts/mix.sh video.mp4 out.mp4 [music.mp3 music_start_s music_gain_db]
# SFX (out/sfx.wav) + optional music, mastered to -14 LUFS, muxed onto the video.
set -e
cd "$(dirname "$0")/.."
V="$1"; O="$2"; M="$3"; SS="${4:-0}"; G="${5:--3}"
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$V")
if [ -n "$M" ]; then
  ffmpeg -v error -y -i "$V" -i out/sfx.wav -ss "$SS" -t "$D" -i "$M" -filter_complex \
    "[2:a]volume=${G}dB,afade=t=out:st=$(echo "$D-2.5" | bc):d=2.5[m];[1:a][m]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1:LRA=11[a]" \
    -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 256k -ar 48000 -t "$D" "$O"
else
  ffmpeg -v error -y -i "$V" -i out/sfx.wav -filter_complex "[1:a]loudnorm=I=-16:TP=-1[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 256k -ar 48000 -t "$D" "$O"
fi
echo "$O"

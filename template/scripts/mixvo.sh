#!/bin/bash
# scripts/mixvo.sh video.mp4 out.mp4 vo.wav [music.mp3 music_start_s music_gain_db]
# Voice + SFX (out/sfx.wav) + optional music that ducks under the voice, mastered to -14 LUFS.
set -e
cd "$(dirname "$0")/.."
V="$1"; O="$2"; VO="$3"; M="$4"; SS="${5:-0}"; G="${6:--15}"
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$V")
if [ -n "$M" ]; then
  ffmpeg -v error -y -i "$V" -i out/sfx.wav -i "$VO" -ss "$SS" -t "$D" -i "$M" -filter_complex \
    "[2:a]asplit[vo][key];[3:a]volume=${G}dB,afade=t=out:st=$(echo "$D-2.5" | bc):d=2.5[mu];[mu][key]sidechaincompress=threshold=0.03:ratio=2.5:attack=40:release=500:makeup=1[duck];[1:a]volume=-2dB[fx];[vo]volume=4dB[v];[duck][fx][v]amix=inputs=3:normalize=0,loudnorm=I=-14:TP=-1:LRA=11[a]" \
    -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 256k -ar 48000 -t "$D" "$O"
else
  ffmpeg -v error -y -i "$V" -i out/sfx.wav -i "$VO" -filter_complex \
    "[1:a]volume=-2dB[fx];[2:a]volume=4dB[v];[fx][v]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1:LRA=11[a]" \
    -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 256k -ar 48000 -t "$D" "$O"
fi
echo "$O"

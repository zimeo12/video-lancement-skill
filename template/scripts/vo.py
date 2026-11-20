#!/usr/bin/env python3
"""Cut a one-take voice-over into its 15 lines and place each on its shot.

python3 scripts/vo.py <voice.mp3> <words.json> <out.wav> <starts>
  words.json : [[start, end, word], ...] from the transcription
  starts     : comma-separated time (s, in the take) where each line's first word starts, 15 values;
               'join' keeps a line glued to the previous one
The cuts land in the real pauses (ffmpeg silencedetect) nearest to those times.
"""
import json, re, subprocess, sys

DUR = 55.0
# when each line starts in the film (s); the shots are in src/film.tsx (beats * 0.5 s)
AT = [0.35, 4.05, 6.7, 10.65, 12.65, 14.85, 17.05, 19.6, 23.45, 27.9, 32.7, 36.45, 42.15, 47.55, 52.0]

src, words_json, out, starts = sys.argv[1], sys.argv[2], sys.argv[3], [None if x == 'join' else float(x) for x in sys.argv[4].split(',')]
assert len(starts) == len(AT), f'{len(starts)} starts for {len(AT)} lines'
total = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src]))
log = subprocess.run(['ffmpeg', '-hide_banner', '-i', src, '-af', 'silencedetect=noise=-40dB:d=0.12', '-f', 'null', '-'], capture_output=True, text=True).stderr
sil = list(zip(map(float, re.findall(r'silence_start: ([\d.]+)', log)), map(float, re.findall(r'silence_end: ([\d.]+)', log))))

def pause_near(t):
    """the pause just before a line that starts near t: (end of previous line, start of this one)"""
    near = [s for s in sil if s[0] - 0.3 <= t <= s[1] + 0.3]
    assert near, f'no pause near {t:.2f}s'
    return min(near, key=lambda s: abs((s[0] + s[1]) / 2 - t))

bounds = [(0.0, 0.0)] + [None if t is None else pause_near(t) for t in starts[1:]] + [(total, total)]
parts, labels = [], []
for i, at in enumerate(AT):
    if bounds[i] is None: continue               # glued to the previous line
    j = i + 1
    while bounds[j] is None: j += 1
    a = max(0.0, bounds[i][1] - 0.04)          # a hair before the voice comes in
    e = min(total, bounds[j][0] + 0.12)    # let the last word ring out
    parts.append(f'[0:a]atrim={a:.3f}:{e:.3f},asetpts=PTS-STARTPTS,afade=t=out:st={max(0, e - a - 0.06):.3f}:d=0.06,adelay={int(at * 1000)}:all=1[l{i}]')
    labels.append(f'[l{i}]')
    end_at = at + e - a
    nxt = AT[j] if j < len(AT) else DUR
    print(f'{i + 1:2d}  take {a:6.2f}-{e:6.2f}  film {at:6.2f}-{end_at:6.2f}' + ('  OVERLAPS next' if end_at > nxt else ''))
graph = ';'.join(parts) + f';{"".join(labels)}amix=inputs={len(labels)}:normalize=0,highpass=f=70,apad=whole_dur={DUR}[v]'
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-filter_complex', graph, '-map', '[v]', '-ar', '48000', '-ac', '2', '-t', str(DUR), out], check=True)
print(out)

# /// script
# dependencies = ["faster-whisper"]
# ///
import sys, json
from faster_whisper import WhisperModel
m = WhisperModel("small", device="cpu", compute_type="int8")
segs, info = m.transcribe(sys.argv[1], word_timestamps=True, vad_filter=False)
words = []
for s in segs:
    for w in s.words: words.append([round(w.start, 2), round(w.end, 2), w.word])
print(info.language)
json.dump(words, open(sys.argv[2], 'w'), ensure_ascii=False)
print(' '.join(f"{w[2].strip()}[{w[0]}]" for w in words))

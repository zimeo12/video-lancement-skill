# /// script
# dependencies = ["librosa", "numpy"]
# ///
import sys, librosa, numpy as np
y, sr = librosa.load(sys.argv[1], sr=22050, mono=True)
tempo, beats = librosa.beat.beat_track(y=y, sr=sr, units='time')
print('tempo', tempo)
print('first beats', np.round(beats[:12], 3))
# loudness per 2 s window, to find intro / drop
rms = librosa.feature.rms(y=y, hop_length=sr)[0]
print('rms per second', ' '.join(f'{int(i)}:{v:.2f}' for i, v in enumerate(rms)))
on = librosa.onset.onset_strength(y=y, sr=sr)

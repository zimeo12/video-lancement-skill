# /// script
# dependencies = ["librosa", "numpy"]
# ///
import sys, librosa, numpy as np
y, sr = librosa.load(sys.argv[1], sr=22050, mono=True)
_, bt = librosa.beat.beat_track(y=y, sr=sr, units='time')
n = np.arange(len(bt)); A = np.vstack([n, np.ones_like(n)]).T
per, t0 = np.linalg.lstsq(A, bt, rcond=None)[0]
print('bpm %.3f t0 %.3f  maxdev %.3f' % (60/per, t0, np.abs(bt - (t0 + per*n)).max()))
# low-band energy per beat (kick/bass) to see sections
S = np.abs(librosa.stft(y, n_fft=2048, hop_length=512)); fr = librosa.fft_frequencies(sr=sr)
low = S[fr < 150].sum(0); high = S[fr > 4000].sum(0); tt = librosa.frames_to_time(np.arange(S.shape[1]), sr=sr, hop_length=512)
a, bnd = float(sys.argv[2]), float(sys.argv[3])
k = int(np.ceil((a - t0)/per))
while t0 + k*per < bnd:
    s = t0 + k*per; m = (tt >= s) & (tt < s + per)
    print('beat %d t=%.2f low %.0f high %.0f' % (k, s, low[m].mean(), high[m].mean()))
    k += 1

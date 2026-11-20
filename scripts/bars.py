# /// script
# dependencies = ["librosa", "numpy"]
# ///
import sys, librosa, numpy as np
y, sr = librosa.load(sys.argv[1], sr=22050, mono=True)
per, t0 = 0.5, float(sys.argv[2])
S = np.abs(librosa.stft(y, n_fft=2048, hop_length=512)); fr = librosa.fft_frequencies(sr=sr)
tt = librosa.frames_to_time(np.arange(S.shape[1]), sr=sr, hop_length=512)
bands = {'kick': fr < 120, 'mid': (fr > 300) & (fr < 2000), 'hi': fr > 5000}
k = 0
while t0 + (k+1)*4*per < tt[-1]:
    s = t0 + k*4*per; m = (tt >= s) & (tt < s + 4*per)
    print('bar %3d t=%6.2f ' % (k, s) + ' '.join('%s %4.0f' % (n, S[b][:, m].sum(0).mean()) for n, b in bands.items()))
    k += 1

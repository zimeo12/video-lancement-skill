# Musique, bruitages, voix, mixage

## Musique

1. **Choisir le morceau.** Il doit être tendance et énergique, autour de 120 BPM, avec un drop net. Sur Pixabay Music, les morceaux sont gratuits, sans compte et utilisables commercialement. Avant de télécharger, demande l'accord de l'utilisateur.
2. **L'analyser :**
   - `uv run scripts/grid.py music.mp3 <début_s> <fin_s>` → BPM exact, t0 (premier temps) et énergie grave et aiguë par temps ;
   - `uv run scripts/bars.py music.mp3 <t0>` → énergie par mesure. Le drop est la mesure où le grave double.
   - `uv run scripts/beat.py music.mp3` → aperçu rapide.
3. **Caler le morceau.** Mets le BPM dans `src/timing.json`. Choisis `music_start` (la seconde du morceau où commence la vidéo) pour que : `music_start + T.LOGO × 60/BPM` = la seconde du drop, en restant aligné sur un temps (t0 + k × période).

   Exemple de SlideShift : morceau Jupiter, 119,96 BPM, drop à 32,5 s, logo au beat 25 (12,5 s), donc `music_start` = 20,0 s.

## Bruitages

- **`hits.json`** : `[[beat, "label", "son", {options}], ...]`. Le son est soit un nom de la palette (`keys`, `ticks`, `pop`, `click`, `whoosh`, `riser`, `sub`, `impact`, `bell`, `blip`…), soit un son Kenney `k:<nom>` (`k:mouseclick1`, `k:maximize_004`, `k:drop_002`, `k:glass_005`…). Plusieurs sons se combinent avec `+`.
- **Options** : `gain`, `rate` (hauteur du son Kenney), `len`, `n`, `pan`, `verb`, `anchor`.
- **Génération** : `node scripts/sfx.mjs <durée_s>` → `out/sfx.wav`. La durée par défaut est de 45 s : **passe la vraie durée**.
- **Où mettre un son** : sur chaque événement visuel (frappe, clic puis relâchement 0,07 beat après, carte qui se pose, puce, bulle). Gain de 0,25 à 0,45.
- **Retimer** : si tu écartes la timeline, déplace les beats de `hits.json` du même facteur.

## Voix off (ElevenLabs)

1. **Écrire le script.** Une phrase par plan, avec son heure de début (`voix/script.md`). Le ton est calme et sûr, pas « pub radio ».
2. **Enregistrer.** L'utilisateur colle **tout le script d'un coup** dans ElevenLabs, avec une phrase par ligne, et t'envoie le mp3 pour chaque langue. Ne demande jamais la clé API.
3. **Transcrire.** `uv run scripts/stt.py voix.mp3 voix.words.json` donne les mots avec leurs temps. Vérifie la phrase finale à l'oreille : faster-whisper se trompe parfois.
4. **Repérer les débuts de phrase.** Note, dans la prise, le début de chaque phrase en secondes : 15 valeurs, ou `join` pour coller une phrase à la précédente.
5. **Découper et placer.** Lance `python3 scripts/vo.py voix.mp3 voix.words.json out/vo-en.wav "0,3.78,4.8,..."`.
   - Le script coupe dans la **vraie pause** (détection de silence ffmpeg à -40 dB, sur au moins 0,12 s) la plus proche de chaque début.
   - Il place chaque phrase à `AT[i]`, l'heure de son plan dans la vidéo. **Mets `AT` et `DUR` à jour en haut de `vo.py`.**
   - Chaque phrase a 60 ms de fondu de sortie et **aucun fondu d'entrée** : un `afade=in:d=0` vaut un fondu de 1 s par défaut dans ffmpeg et rend l'attaque inaudible.
   - Le script signale `OVERLAPS next` quand une phrase déborde sur la suivante.
6. **Si deux phrases sont enchaînées sans pause** (par exemple « It reads your site and learns your product ») :
   - **Ne coupe pas au milieu d'un mot.** Mesure l'énergie : le mot finit là où le niveau retombe.
   - Utilise la micro-pause qui suit.
   - Si elle n'existe pas, demande à l'utilisateur de régénérer la phrase avec une vraie pause, ou de l'enregistrer séparément.

## Mixage

`bash scripts/mixvo.sh out/video-en.mp4 final-en.mp4 out/vo-en.wav music.mp3 <music_start> <gain_dB>`

- **Musique** : `volume` de -15 dB, avec un fondu de sortie de 2,5 s.
- **Ducking** : `sidechaincompress=threshold=0.03:ratio=2.5:attack=40:release=500` fait baisser la musique d'environ 6 dB sous la voix. L'utilisateur a jugé qu'une baisse de 11 à 13 dB était trop forte.
- **Niveaux** : bruitages à -2 dB, voix à +4 dB, puis `loudnorm` à -14 LUFS avec un pic vrai à -1 dB.
- **Version sans musique** : relance sans les 3 derniers arguments.

Vérifie avec `ffprobe` (durée, 60 i/s, piste audio présente) et écoute le début, chaque phrase et la fin.

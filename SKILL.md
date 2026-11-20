---
name: video-lancement
description: Crée une vidéo de présentation ou de lancement de produit (Product Hunt, X, LinkedIn, landing) animée en code avec Remotion, dans le style de la vidéo de lancement SlideShift. Elle est en 16:9, à 60 i/s, en anglais et en français, avec des animations fluides, des zooms caméra sur l'action, une timeline calée sur le tempo de la musique, des bruitages, et une voix off découpée et placée automatiquement, sous laquelle la musique baisse. À utiliser quand l'utilisateur demande une vidéo de lancement, une vidéo de démo, une vidéo promo, une vidéo produit, un teaser ou une vidéo de présentation, ou veut refaire ou modifier une vidéo dans ce style.
---

# Vidéo de lancement en Remotion

Ce skill produit une vidéo de produit de 45 à 60 s, à partir d'un modèle Remotion qui marche déjà. Toute la vidéo est une fonction de la frame : pas d'état, pas de `Math.random`, pas de minuteries. Les temps sont en **temps musicaux (beats)** : on change le tempo, toute la vidéo suit.

- **Le modèle** : `template/`. On le copie dans le projet, il fait le rendu tel quel.
- **L'exemple complet** : `examples/slideshift/`. C'est la vraie vidéo SlideShift : `film.tsx` (791 lignes), le fond WebGL `bg.tsx`, `copy.ts`, `hits.json` et le script de la voix. Lis-le pour voir les techniques en situation : une carte qui devient la carte suivante, les zooms qui suivent un formulaire qui se remplit, le logo qui s'agrandit en carte.
- **Les techniques d'animation** : `references/animation.md`.
- **Musique, bruitages, voix, mixage** : `references/audio.md`.
- **Les sons enregistrés** : `assets/sfx/`, packs Kenney sous licence CC0.
- **Les scripts d'analyse** à lancer avec `uv run` : `scripts/` (tempo, sections de la musique, transcription).

## Déroulé

1. **Brief.** Il te faut :
   - le produit et son site ;
   - la durée (55 s par défaut) ;
   - les langues (EN + FR par défaut) ;
   - les captures ou écrans réels du produit ;
   - les couleurs et polices de la marque ;
   - la musique (fournie, ou je propose) ;
   - la voix off (oui / non).

   Les écrans montrés doivent être **ceux du vrai produit** : reproduis-les en JSX d'après les captures. N'invente jamais un écran.

2. **Structure.** Problème → « Et si… » → logo → cas d'usage (la partie la plus longue, une étape par plan) → bénéfices → appel à l'action → carte de fin.

   Écris chaque texte à l'écran dans `src/copy.ts`, en EN et en FR. Un texte doit rester lisible : compte **au moins 2 temps (1 s) par ligne de 6 mots**. L'utilisateur a trouvé la première version trop rapide.

3. **Musique.** Analyse le morceau : `uv run scripts/grid.py musique.mp3 0 60` donne le BPM, le premier temps (t0) et l'énergie par temps.
   - `bars.py` montre les sections (intro, montée, drop).
   - Mets le BPM dans `src/timing.json`.
   - Choisis le point de départ dans le morceau (`music_start`) pour que **le drop tombe sur l'apparition du logo**.

4. **Installation.** Copie `template/` dans un dossier du projet (par exemple `video-launch/studio/`), puis lance `npm i`.
   - Si le chemin du projet contient une espace, le Chrome de Remotion plante. Copie `node_modules/.remotion/chrome-headless-shell` hors du chemin, par exemple dans `~/.cache/remotion-chrome/`, et exporte `REMOTION_CHROME=<chemin du binaire>`. Les scripts le lisent.
   - Pour écrire la vidéo, lance `npm run studio` : l'aperçu se met à jour en direct.

5. **Timeline.** Mets un objet `T` en beats dans `film.tsx`, un repère par plan. Tout se place par rapport à ces repères (`b(T.U2 + 1.5)`). Ainsi, ralentir la vidéo revient à écarter les repères, sans rien retoucher d'autre.

6. **Construction des plans.** Utilise les briques de `src/kit.tsx`, détaillées dans `references/animation.md` :
   - `Headline` : les mots montent d'une ligne masquée en se défloutant ;
   - `Typed` : texte tapé avec curseur ;
   - `Roll` : compteur à rouleaux qui tombe pile sur la valeur ;
   - `Callout` : bulle d'annotation ;
   - `Cursor`, `path`, `press` et `ringAt` : souris, trajet et clic ;
   - `rectAt` : une carte qui se transforme en la carte suivante ;
   - `camAt` et `camTransform` : zooms.

7. **Contrôle visuel**, à chaque passe :
   - Lance `bash scripts/sheet.sh 120,300,480,... en planche` et **regarde la planche** dans `out/qa/planche.png`.
   - Vérifie chaque transition sur 4 à 6 frames rapprochées : pas de carte vide, pas d'élément qui saute, pas de flou qui arrive d'un coup.
   - Vérifie la lisibilité du texte sur le fond.

8. **Bruitages.** Chaque événement visuel est listé dans `hits.json` sous la forme `[beat, "label", "son", {options}]`. Lance `node scripts/sfx.mjs <durée_s>` pour produire `out/sfx.wav`. La palette est dans `node scripts/sfx.mjs --list`, et `k:<nom>` désigne un son Kenney de `assets/sfx`.

9. **Rendu**, une langue à la fois (environ 5 min pour 55 s sur un Mac M) :
   ```bash
   npx remotion render src/index.ts Launch out/video-en.mp4 --props='{"lang":"en"}' --browser-executable "$REMOTION_CHROME" --concurrency 8 --muted
   ```

10. **Voix off et mixage.** Suis `references/audio.md` :
    - l'utilisateur enregistre tout le script d'une traite dans ElevenLabs ;
    - `stt.py` donne le temps de chaque mot ;
    - `scripts/vo.py` découpe la prise dans les vraies pauses et place chaque phrase sur son plan ;
    - `scripts/mixvo.sh` mélange musique, bruitages et voix, fait baisser la musique d'environ 6 dB sous la voix, et ramène le tout à -14 LUFS.

11. **Livraison.** Pour chaque langue, livre une version avec musique et une version sans musique (pour mettre un son tendance sur TikTok). Les fichiers vont dans le dossier vidéo du projet, et l'utilisateur les reçoit avec SendUserFile.

## Ce que l'utilisateur a demandé de corriger sur la première vidéo (à faire d'emblée)

- **Aucune transition brusque.**
  - Le flou du fond (`soft`) passe d'une valeur à l'autre avec un easing, sur au moins 2 temps.
  - Un élément ne doit jamais apparaître pendant une demi-seconde sans raison. Cette vidéo avait un logo et un nom en flash : on les a supprimés.
- **Un compteur doit tomber exactement sur sa valeur finale et s'y arrêter**, sans changer de chiffre. Il doit rester lisible : encre foncée sur un fond clair, jamais blanc sur un fond pâle.
- **Le passage du logo à la première carte doit être fluide.**
  - Le logo s'efface en se floutant (0,8 temps).
  - La tuile grandit jusqu'à devenir la carte, avec le contenu de la carte déjà visible dedans.
  - Il ne doit jamais y avoir de tuile vide noire.
- **Un zoom = une seule cadence par action** : zoom avant, maintien pendant l'action, zoom arrière.
  - Pas de zoom, puis panoramique, puis dézoom dans le même petit laps de temps.
  - Garde 1 temps pour zoomer, au moins 1 temps de maintien et 1 temps pour dézoomer.
  - Dézoome toujours avant que la carte se transforme.
- **Les zooms doivent suivre le fil de l'action.** Exemples : le champ où l'on tape, les champs d'un formulaire un par un, le bouton cliqué. Ne zoome jamais pour décorer.
- **Fond** : contraste modéré, surtout à la fin. Quand du texte est posé dessus, le fond se floute et pâlit (`soft` 0,5–0,7). Il redevient net seulement sur les moments forts (logo, carte de fin).
- **Voix** :
  - les phrases restent séparées comme dans le script, même quand l'acteur les enchaîne ;
  - les coupes tombent dans les vraies pauses, jamais au milieu d'un mot ;
  - aucun fondu d'entrée sur les phrases, qui doivent garder leur attaque ;
  - la musique baisse un peu sous la voix (environ 6 dB), pas plus.
- **Rythme** : laisse le temps de lire. Si l'utilisateur trouve ça rapide, écarte les repères de `T` d'environ 10–15 % plutôt que de raccourcir les animations.
- **Musique** : prends un morceau tendance et énergique, pour X et Product Hunt. Pixabay est gratuit, sans compte et autorisé pour un usage commercial. Cale le drop sur le logo et fais un fondu de 2,5 s à la fin.

## Règles

- **Exemple et voix** : ne copie jamais d'images d'une vidéo de référence ; recrée le style en code. Ne demande jamais la clé ElevenLabs dans la conversation : c'est l'utilisateur qui génère la voix et qui t'envoie le fichier.
- **Téléchargements** : télécharger une musique ou un son demande l'accord de l'utilisateur. Les sons Kenney fournis avec le skill sont déjà là.
- **Dépôt** : les dossiers vidéo ne vont pas dans git (leurs fichiers sont lourds), sauf si l'utilisateur le demande.

# Animations fluides : les techniques

Tout est dans `template/src/kit.tsx`, et `template/src/film.tsx` montre chaque technique sur 8 s. L'exemple réel se trouve dans `examples/slideshift/film.tsx`.

## Temps et courbes

- **Tempo** : `B` est le nombre de frames par beat (`60/BPM*60`). `b(n)` convertit n beats en frames. À 120 BPM, 1 beat = 0,5 s = 30 frames.
- **Interpolation** : `tw(t, t0, durée, a, b, easing)` est une interpolation bornée. Toutes les apparitions et disparitions passent par elle.
- **Easings** :
  | Easing | Usage |
  |---|---|
  | `EASE` (0.16,1,0.3,1) | Arrivées : rapide puis se pose. |
  | `EASE_IN` | Départs. |
  | `EASE_IO` (0.65,0,0.35,1) | Déplacements, morphings, caméra. |
  | `EASE_SOFT` | Fondus de contenu. |
- **Ressorts** : `sp(t, t0, BOUNCE | SNAP | CALM)`. `BOUNCE` sert aux puces et aux boutons, `CALM` amortit sans rebond.
- **Règle d'entrée** : un élément entre avec une direction (il monte de 120 % dans un masque) **et** un flou de 8 px qui se résorbe. Il sort de la même manière, vers le haut, avec un `EASE_IN` plus court (22 frames contre 32 à l'entrée). Évite le simple fondu d'opacité.
- **Décalage entre mots** : 3 frames d'un mot au suivant (`Headline`). Un mot entouré de `*…*` passe en serif italique, couleur d'accent. `{chip}` insère une pastille (`Chip`) qui arrive avec un ressort.

## Compteur qui tombe juste (`Roll`)

Les colonnes de chiffres tournent comme une machine à sous :
- chaque colonne fait `(chiffre + 10×tours)` × un easing cubique de sortie, puis `% 10` ;
- elle arrive donc **exactement** sur le chiffre final, sans jamais le dépasser ni changer après ;
- les colonnes de poids fort démarrent plus tard (`appear = place/nbChiffres × 0,5`) et apparaissent par la droite.

Passe-lui un `p` **linéaire** de 0 à 1 : `tw(f, b(0.6), b(3.6), 0, 1, x => x)`. Le compteur gère son easing lui-même.

Écris-le en encre foncée sur le fond clair, assez grand (170 px), avec `tabular-nums`.

## Une carte qui devient la carte suivante (`rectAt`)

- **Le principe** : un seul rectangle `{x, y, w, h, r}` (centre, taille, arrondi) traverse la vidéo. Les clés `Key[] = {f, r, ease}` donnent sa forme plan par plan. On garde la forme du plan précédent jusqu'à `début − 18 frames`, puis on passe à la nouvelle forme à `début + 18 frames`, avec `EASE_IO`.
- **Le contenu du nouveau plan** se dessine **à sa taille native**, puis est mis à l'échelle `sqrt((w/W)*(h/H))` pour remplir le rectangle pendant qu'il change de forme. Il entre en fondu avec un flou de 8 px qui se résorbe.
- **Logo → carte** :
  1. la tuile apparaît (de 1 px à 210 px en 22 frames, avec `EASE`) ;
  2. le logo s'efface en 0,8 beat avec du flou ;
  3. la tuile grandit jusqu'à la taille de la carte, en passant de l'encre au verre ;
  4. le contenu de la carte apparaît **dans** la tuile pendant qu'elle grandit.

  Il n'y a jamais de tuile vide.

## Caméra (`camAt`, `camTransform`)

- **Les clés** : `[beat, x, y, zoom]`. Le point (x, y) est amené au centre de l'image.
- **Le zoom se fait en espace logarithmique** (`z0*(z1/z0)**p`). Ça donne un travelling régulier : un zoom linéaire traîne quand l'image est grande.
- **La transformation** s'applique au calque du premier plan (`transformOrigin: 0 0`). Le fond suit à 12 % (`scale(1+(z-1)*0.12)`), ce qui donne de la profondeur.
- **Le motif d'une action**, sur 4 clés :
  ```ts
  [T.X + 0.9, 960, 540, 1], [T.X + 1.9, fx, fy, 1.45], [T.X + 3.4, fx, fy, 1.45], [T.X + 4.4, 960, 540, 1]
  ```
  Pour suivre un formulaire qui se remplit, enchaîne des maintiens sur chaque champ (glissement de 0,5 beat d'un champ au suivant), puis dézoome à la fin.
- **Zoom typique** : entre 1,4 et 1,5. Dézoome toujours avant un morphing de carte.

## Fond et flou

- **`soft`, de 0 à 1** : il pilote le flou du fond (`soft*16 px`), une légère désaturation et un voile clair. Ses clés sont en beats, avec un `interpolate` en `EASE_IO`.
  - 0 sur les moments forts (logo, carte de fin) ;
  - 0,45–0,7 derrière du texte et des cartes.
- **Pousser l'image sur les temps forts (`punch`)** : `+0.028 × exp(-(f-hit)/14)` d'échelle, sur 3 ou 4 moments structurants seulement.
- **Dérive « caméra à la main »** : `sin(f/70)*4 px` et `sin(f/90+1)*3 px`, sur le premier plan, et à 40 % sur le fond.
- **Flou de mouvement** : `CameraMotionBlur` avec 6 échantillons **seulement autour des moments rapides**, 1 échantillon ailleurs. Le rendu va 6 fois plus vite.
- **Fond WebGL** (collines en LED, ciel, nuages) : `examples/slideshift/bg.tsx`. Il fait le rendu dans un `useLayoutEffect` à partir de `t`, sans aucun état.

## Souris et clics

- **Trajet** : `path(t, [[frame, x, y], ...])` donne une trajectoire adoucie et légèrement courbée.
- **Clic** : `press(t, at)` enfonce en 4 frames et relâche en 12 ; `ringAt(t, at)` dessine l'onde du clic.
- **Bouton** : il s'enfonce de 6 % au clic (`press`), puis rebondit (`sp(..., BOUNCE)`).
- **Ordre** : le `Callout` qui explique le résultat arrive environ 20 frames après le clic.

## Contrôle

- **Planche** : `bash scripts/sheet.sh f1,f2,... en nom` produit `out/qa/nom.png`, en 3 colonnes.
- **Image unique** : `bash scripts/one.sh frame en`.
- **Transitions** : vérifie chacune avec des frames rapprochées (par exemple `b(T.X)-20, -10, 0, +10, +20`).
- **Mouvement** : quand il est impossible à juger sur des images fixes, rends un extrait avec `--frames=a-b`.

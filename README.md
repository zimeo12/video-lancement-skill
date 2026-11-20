# video-lancement : skill Claude Code

Crée des vidéos de lancement / présentation de produit animées en code (Remotion, 16:9, 60 i/s, EN + FR) : animations fluides, zooms caméra sur l'action, timeline calée sur le tempo de la musique, bruitages, voix off découpée et placée automatiquement, musique qui baisse sous la voix.

## Installation

```bash
git clone https://github.com/zimeo12/video-lancement-skill ~/.claude/skills/video-lancement
```

Prérequis : Node, ffmpeg, uv (`brew install node ffmpeg uv`).

Puis dans Claude Code : « fais une vidéo de lancement pour … » ou `/video-lancement`.

## Contenu

- `SKILL.md` : le déroulé et les règles
- `template/` : un studio Remotion prêt à l'emploi
- `examples/slideshift/` : une vraie vidéo de lancement complète
- `references/` : techniques d'animation, musique, voix et mixage
- `scripts/` : analyse du tempo, transcription
- `assets/sfx/` : sons Kenney (licence CC0)

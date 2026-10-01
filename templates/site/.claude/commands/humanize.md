---
description: Relire et humaniser tous les textes du site
---
Lis `.claude/skills/humanizer/SKILL.md` puis applique-le à **tous** les textes visibles (`src/**/*.astro`, `src/**/*.md` hors `src/content/legal/`).

En plus des règles du skill :
- vérifie la liste d'expressions interdites de `CLAUDE.md` ;
- vérifie la typographie française (espaces insécables, guillemets « », apostrophes ’) ;
- vérifie qu'aucun fait n'est inventé : tout ce qui n'est pas dans `brief.json`/`assets/` devient `[À COMPLÉTER: …]` ;
- lis chaque page à voix haute mentalement : si une phrase sonne comme une plaquette commerciale, réécris-la comme le patron la dirait au téléphone.

Liste ensuite les modifications importantes.

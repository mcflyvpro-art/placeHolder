---
description: Proposer 3 directions visuelles contrastées (mini-maquettes HTML)
---
Lis `.claude/skills/frontend-design/SKILL.md`, `brand-dna.md` et `brief.json`.

Crée `directions/a.html`, `directions/b.html`, `directions/c.html` : chacune est un fichier HTML autonome (CSS inline, polices système ou @font-face local) montrant le haut de la page d'accueil + une section, avec les vrais textes du client.

Les trois directions doivent être réellement différentes (composition, typographie, traitement de l'image, densité), toutes fidèles à l'ADN. Donne à chacune un nom court et une phrase d'intention dans un commentaire HTML en tête de fichier.

Prends des captures : `npx playwright screenshot --viewport-size=1440,900 directions/a.html .shots/dir-a.png` (idem b, c, et en 390x844 pour le mobile), regarde-les, corrige ce qui est faible.

Puis arrête-toi et demande : « A, B, C, ou un mélange ? »

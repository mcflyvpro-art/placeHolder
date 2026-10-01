---
description: Construire le site complet dans la direction choisie, avec boucle de revue visuelle
---
Direction retenue : $ARGUMENTS

1. Relis `CLAUDE.md`, `brand-dna.md`, `brief.json`, la direction retenue dans `directions/`, et `.claude/skills/frontend-design/SKILL.md`.
2. Installe les polices choisies (`npm i @fontsource-variable/...` ou `@fontsource/...`), définis les tokens (couleurs, typo, espacements) dans `src/styles/`.
3. Construis les pages listées dans `brief.json > pages` + les 4 pages légales existantes (ne pas les recréer), en-tête, pied de page (coordonnées + liens légaux), bouton d'appel mobile fixe.
4. Remplace `src/pages/index.astro`.
5. Boucle de revue visuelle décrite dans `CLAUDE.md` jusqu'à satisfaction complète de la grille.
6. Termine par `npm run quality:static` et corrige.

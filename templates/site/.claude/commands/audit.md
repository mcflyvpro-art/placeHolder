---
description: Build + contrôle qualité complet, puis corrections
---
1. `npm run build`
2. `npx playwright install chromium` (si nécessaire) puis `npm run quality`
3. Pour chaque échec : corrige la cause (pas le contrôle), puis recommence jusqu'à « Qualité OK ».
4. Liste les `[À COMPLÉTER]` restants : ce sont les questions à poser au client.

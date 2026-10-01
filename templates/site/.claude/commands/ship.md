---
description: Commit + push → mise en ligne automatique
---
1. `npm run build && npm run quality:static` doit passer.
2. `git add -A && git commit -m "<message court en français décrivant le changement>"` puis `git push`.
3. GitHub Actions publie sur Cloudflare Pages et prévient placeHolder (version, scores qualité). Indique au propriétaire de regarder l'Atelier.

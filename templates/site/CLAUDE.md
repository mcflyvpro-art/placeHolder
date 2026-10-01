# Site client placeHolder — règles de fabrication

Tu fabriques le site vitrine d'un petit business français réel. Ce site sera vendu. Il doit avoir l'air conçu par un studio exigeant qui connaît ce métier et cette entreprise, jamais par une IA ni à partir d'un thème.

Sources de vérité, dans cet ordre : `brief.json` (données vérifiées), `brand-dna.md` (identité), `assets/` (logo, photos, anciens textes), puis ce que le propriétaire dit dans la conversation.

## Déroulé obligatoire

Ne saute aucune étape. Chaque étape a sa commande.

1. `/brand` : lis tout, écris `brand-dna.md`. Pas de code.
2. `/directions` : trois mini-maquettes de haut de page dans `directions/a.html`, `b.html`, `c.html`. Arrête-toi et demande laquelle garder (ou quel mélange).
3. `/build` : construis le site complet dans la direction choisie, puis boucle de revue visuelle jusqu'à ce que la grille soit entièrement satisfaite.
4. `/humanize` : relecture de tous les textes.
5. `/audit` : build + qualité. Corrige tout ce qui échoue.
6. `/ship` : commit + push. La mise en ligne est automatique (GitHub Actions → Cloudflare Pages), le résultat remonte dans placeHolder.

Pour une modification demandée par le client, va directement à l'étape concernée puis `/audit` et `/ship`.

## Zéro invention

- N'invente jamais un fait : chiffre, année, diplôme, certification (RGE, Qualibat…), garantie, avis, nom de client, zone d'intervention, tarif, horaire, prénom de salarié.
- Une information absente du brief s'écrit `[À COMPLÉTER: ce qui manque]`. Le contrôle qualité bloque la production tant qu'il en reste. C'est voulu : le propriétaire les remplit avec le client.
- Les avis clients affichés sont uniquement ceux fournis dans `brief.json` ou `assets/`, cités tels quels, avec prénom et initiale seulement.
- Pas de fausses photos d'équipe ni de faux portraits. Pas d'images générées présentées comme des photos réelles de l'entreprise. Si aucune photo n'est fournie : composition typographique, illustration abstraite sobre, ou emplacement `[À COMPLÉTER: photo de …]` clairement visible.

## Anti-slop : textes

Interdits (le contrôle qualité les détecte) : « Bienvenue sur notre site », « votre partenaire de confiance », « n'hésitez pas à nous contacter », « nous mettons tout en œuvre », « une équipe de passionnés », « qualité et professionnalisme », « solutions sur mesure », « alliant tradition et modernité », « au cœur de », « plongez dans », « découvrez notre univers », « dans un monde où », « que vous soyez un particulier ou un professionnel », « à la pointe de », « faites confiance à », « n'attendez plus ».

Règles d'écriture :
- Phrases courtes, concrètes, au présent. Un artisan parle de ce qu'il fait, d'où, pour qui, en combien de temps.
- Le vocabulaire vient du métier et des avis Google réels (ce que les clients remercient vraiment : ponctualité, propreté du chantier, devis clair…).
- Pas de triades en série (« rapide, efficace et fiable »). Pas d'adjectifs vides (exceptionnel, unique, incomparable, inégalé).
- Tirets cadratins : trois au maximum par page.
- Pas d'emoji décoratifs.
- Titres qui disent quelque chose (« Dépannage plomberie à Villeurbanne, en moins de 2 h » plutôt que « Nos services »).
- Le tutoiement ou vouvoiement suit `brand-dna.md`. Par défaut : vouvoiement.

Typographie française obligatoire : espace insécable avant `:` et espace fine insécable avant `; ! ?` (`&nbsp;` / `&#8239;`), guillemets « » avec espaces insécables, apostrophe typographique ’, nombres `12 000`, prix `1 250 €`, heures `8 h 30`.

## Anti-slop : design

Interdits sauf justification écrite dans `brand-dna.md` :
- dégradés violets/indigo ou bleu-violet génériques, blobs flous, fonds « mesh gradient » ;
- la grille de trois cartes icône + titre + paragraphe comme section par défaut ;
- glassmorphism décoratif, ombres portées molles partout, boutons pilules dégradés ;
- hero centré « grand titre + sous-titre + 2 boutons » sur fond uni sans aucune image ni idée ;
- icônes génériques en guise d'illustration ; photos de banque d'images reconnaissables ;
- animations au scroll sur chaque bloc ; parallaxe gratuite ;
- palette Tailwind par défaut, police Inter par défaut sans raison.

À faire :
- Une idée visuelle forte par site, tirée du métier, du lieu ou de l'histoire de l'entreprise (matière, outil, geste, quartier, couleur de la devanture, carte, menu manuscrit, plan de chantier…).
- Une grille et un rythme vertical assumés ; des tailles de texte contrastées ; beaucoup de respiration.
- Deux polices au maximum, auto-hébergées via `@fontsource` (jamais d'appel à Google Fonts : RGPD).
- Couleurs issues du logo / de la devanture, contraste AA vérifié pour tout texte.
- Mobile d'abord : l'artisan est cherché depuis un téléphone. Bouton d'appel visible en permanence sur mobile.
- Mouvement : rare et utile (`prefers-reduced-motion` respecté).

Lis `.claude/skills/frontend-design/SKILL.md` avant `/directions` et `/build`.

## Boucle de revue visuelle (pendant /build)

Après chaque passe significative :
1. `npm run build && npm run shots -- / /contact` (ajoute les pages créées).
2. Ouvre les captures `.shots/*.png` (375, 768, 1440) et note chaque point de la grille :
   - hiérarchie : on comprend en 3 secondes qui, quoi, où, comment appeler ;
   - rythme vertical régulier, alignements nets, aucun élément orphelin ou collé ;
   - contraste et lisibilité, tailles tactiles ≥ 44 px ;
   - cohérence avec `brand-dna.md` (personnalité et anti-traits) ;
   - « pourrait-on deviner que c'est généré ? » — si oui, identifie pourquoi et corrige ;
   - rien ne déborde, rien ne casse entre 320 et 1920 px.
3. Corrige, recommence. Arrête-toi seulement quand tout est satisfait, puis montre les captures finales.

## Légal (déjà généré, ne pas supprimer)

`src/content/legal/*.md` sont générés par placeHolder depuis le registre officiel : mentions légales (LCEN art. 6), confidentialité, cookies (aucun cookie → pas de bandeau), CGU. Tu peux corriger une donnée fausse, jamais retirer une rubrique. Les liens vers ces 4 pages sont dans le pied de page de toutes les pages.

Aucun cookie, aucun traceur, aucun script tiers hors Cloudflare Web Analytics et Turnstile. Pas d'embed Google Maps (dépose des cookies) : lien « Itinéraire » vers `brief.contact.mapsUrl` ou carte statique.

## SEO

- Un `<h1>` unique par page, titres et descriptions uniques (`<Base title description>`), 50–60 / 140–160 caractères.
- Ville et métier dans le titre de la page d'accueil.
- `LocalBusinessJsonLd` est déjà inclus ; ne le duplique pas.
- Images : `astro:assets` (`<Image>`/`<Picture>`), `alt` descriptif réel, dimensions fixées, AVIF/WebP.
- Nom, adresse, téléphone identiques partout (pied de page).
- Pages recommandées dans `brief.json > pages`.

## Accessibilité

WCAG 2.2 AA : contraste, ordre de focus, `:focus-visible` visible, labels de formulaire, `lang="fr"`, liens explicites, navigation clavier, zoom 200 % sans perte.

## Technique

- Astro statique, pas de framework client sauf besoin réel. JavaScript minimal.
- Formulaire : `src/components/ContactForm.astro` (déjà branché sur placeHolder). Ne le remplace pas par un service tiers.
- Contrôle : `npm run quality` doit passer (Lighthouse ≥ 95 sur les 4 catégories, 0 erreur axe, 0 lien cassé, 0 expression interdite, pages légales présentes).
- Ne modifie pas `.github/workflows/`, `scripts/quality/`, `astro.config.mjs` sans demande explicite.

# placeHolder — Design spec

Date : 2026-10-01 · Statut : validé (sections 1 à 5 approuvées en session)

Outil personnel pour prospecter des petits business français, leur fabriquer un site vitrine sur mesure avec Claude Code, et conclure la vente (devis, contrat, paiement, domaine, mise en ligne). Un seul utilisateur. Budget d'exploitation : 0 € hors noms de domaine.

## 1. Contraintes et décisions

| Sujet | Décision | Raison |
|---|---|---|
| Où tourne l'outil | Web app Next.js sur Vercel (Hobby) | Accessible Mac + téléphone. Données dans Supabase : migrable en minutes si besoin. |
| Base de données | Supabase (free) : Postgres, Auth, Storage | Gratuit. Pause après 7 j sans activité → cron quotidien Vercel qui ping la base. |
| Sites clients | Cloudflare Pages | Vercel Hobby interdit l'usage commercial ; Cloudflare l'autorise gratuitement. |
| IA | Claude Code local (abonnement) via CLI `ph worker` (`claude -p`) | Pas de budget API Anthropic. |
| Scoring | Règles déterministes dans l'app | Instantané, gratuit, explicable. |
| Registrar | Porkbun API v3 (register, DNS, email forwarding, dryRun) | API complète, mode dry-run, .fr supporté. |
| Paiement | Stripe (Payment Links + Subscriptions + Customer Portal) | 0 € fixe, commission par transaction. |
| Prospection | Téléphone uniquement, pas de script | Choix utilisateur. |
| Zone | Toute la France | Choix utilisateur. |
| Statut | Micro-entreprise (à créer) | Devis/factures bloqués tant que SIRET absent. |
| Offres | 3 modèles chiffrés pour chaque prospect | Création seule / création + abonnement / abonnement seul. |

## 2. Architecture

```
placeHolder web (Next.js 16, Vercel)
  ├─ UI : Aujourd'hui · Radar · Tri · Fiche · Atelier · Pipeline · Closing · Réglages
  ├─ API routes : sourcing, enrichissement, scoring, webhooks (GitHub, Stripe), lien de présentation
  └─ Supabase (Postgres + Storage + Auth magic link, 1 utilisateur autorisé)

Sources : Google Places API (New) · API Recherche d'entreprises · BODACC (opendatasoft) · PageSpeed Insights · fetch HTML
Sites   : GitHub (1 repo privé / client, depuis template) → GitHub Actions (qualité + wrangler pages deploy) → Cloudflare Pages
Local   : CLI `ph` (Node) — `ph site <slug>`, `ph worker`, `ph login`
```

Monorepo (npm workspaces) :

```
apps/web            Next.js — l'outil
packages/core       Logique pure partagée : scoring, pricing, slug, NAF, mentions légales, numérotation
packages/cli        CLI `ph`
templates/site      Template Astro des sites clients (poussé comme repo template GitHub)
supabase/           Migrations SQL
```

`packages/core` ne dépend d'aucun service : testable unitairement, utilisé par web et CLI.

## 3. Modèle de données (Postgres)

- `settings` (1 ligne) : identité micro-entreprise (nom, SIRET, adresse, email, téléphone, IBAN optionnel), seuils de scoring, grilles de prix par secteur, préfixe de numérotation, domaine de preview, durée de rétention.
- `searches` : requête Radar (secteurs, zone, statut, progression, compteurs).
- `prospects` : identité (nom, siren, siret, naf, nature juridique, adresse, coordonnées, dirigeants jsonb, finances jsonb, date création, tranche effectif), Google (place_id, téléphone, site, note, nb avis, horaires, maps_url, `google_fetched_at`), audit site (jsonb), scores (`need_score`, `pay_score`, `priority`, `score_reasons` jsonb), `status` (pipeline), `triage` (`pending|kept|dropped|hot`), `next_action_at`, `lost_reason`, `slug`, `brand_dna` (markdown), `ai_analysis` jsonb, `pricing` jsonb, timestamps, `purge_at`.
- `blacklist` : siren / place_id hachés (sha256) + date — empêche la réapparition sans garder de donnée personnelle.
- `activities` : journal par prospect (appel, statut, note, ouverture lien, retour client).
- `ai_jobs` : file d'attente (`type`: analyse | brand_dna | directions ; `status`; `payload`; `result`; `error`; `claimed_at`).
- `sites` : prospect_id, repo GitHub, projet Cloudflare, preview_url, domaine prod, statut.
- `site_versions` : commit sha, message, url de déploiement, résultats qualité (lighthouse ×4, axe, liens, slop, légal), créé le.
- `share_links` : token, prospect_id, expire_le, mot de passe hash (option), vues, dernières vues, actif.
- `share_events` : vue / like / demande de modif (+ texte), user agent réduit (mobile/desktop), date. Pas d'IP stockée.
- `quotes` : numéro (séquence sans trou `D-AAAA-NNN`), offre choisie, lignes jsonb, total, validité, statut, PDF (storage), signature (nom, date, IP, sha256 PDF).
- `invoices` : numéro (séquence sans trou `F-AAAA-NNN`), quote_id, lignes, total, statut, PDF, stripe ids. Jamais supprimable (trigger) ; annulation = `credit_notes`.
- `subscriptions` : stripe ids, montant, statut, prochaine échéance, impayés.
- `domains` : nom, registrar id, statut, expiration, titulaire (client), redirections mail.
- `legal_register` : registre des traitements RGPD (généré, éditable).

Numérotation : fonction SQL `next_number(kind)` avec verrou sur une table `counters` → pas de trou, pas de doublon.

RLS : toutes les tables accessibles uniquement à l'utilisateur authentifié dont l'email = `OWNER_EMAIL`. Routes publiques (lien de présentation, signature de devis, webhooks) passent par le service role côté serveur uniquement.

## 4. Prospection

### 4.1 Radar (sourcing)

Entrée : secteurs (presets NAF + mots-clés Google, ex. « Plombier » → `43.22A` + `plombier`), zone (départements, régions ou France entière). Pour la France entière, l'outil découpe par préfecture / villes > 20 k habitants (liste embarquée) pour rester pertinent.

Pipeline par (mot-clé × ville) :
1. **Google Text Search (New)** `"<mot-clé> <ville>"`, field mask Enterprise (`id, displayName, formattedAddress, location, nationalPhoneNumber, websiteUri, rating, userRatingCount, businessStatus, types, googleMapsUri, regularOpeningHours`), jusqu'à 3 pages de 20. ~1 000 requêtes/mois gratuites ⇒ ~20 000 business/mois. Compteur mensuel dans `settings` + arrêt dur à 950 pour ne jamais payer.
2. **Matching SIREN** : API Recherche d'entreprises `q=<nom>&code_postal=<cp>` → meilleur match (similarité nom + distance géo < 300 m ou même CP). Non trouvé ⇒ prospect gardé avec flag `unverified`.
3. **Exclusions dures** : `businessStatus != OPERATIONAL`, `etat_administratif != A`, association (`nature_juridique` 92xx), service public, professions réglementées (médecins 86.21Z/86.22*/86.23Z, avocats 69.10Z, notaires, pharmacies 47.73Z) → exclues, chaînes/franchises (nom présent dans > 3 villes du lot ou liste de marques), procédure collective BODACC active, blacklist, déjà en pipeline.
4. **Audit du site existant** (si `websiteUri`) : fetch HTML (timeout 8 s), détection : HTTPS, statut HTTP, `<meta viewport>`, `<title>`/meta description, année du copyright, générateur (Wix, Jimdo, WordPress, PagesJaunes/Solocal, Site123, Google Sites), domaine gratuit, présence mentions légales, liens réseaux sociaux, couleurs (meta theme-color + CSS inline), logo (og:image, favicon). Puis PageSpeed mobile (performance, SEO, accessibilité). Site = Facebook/Instagram/PagesJaunes ⇒ compté « pas de vrai site ».
5. **Scoring** (packages/core) puis insertion `triage=pending`.

Exécution : chaque recherche est découpée en tâches ; le client UI appelle `/api/radar/step` en boucle (chaque appel < 10 s) avec progression en direct. Pas de dépendance aux crons pour le travail interactif.

### 4.2 Scores (0–100, réglables)

**Besoin** : pas de site / réseau social seul = 100. Sinon on part de 0 et on additionne : site injoignable +60, pas HTTPS +20, pas responsive +25, PageSpeed mobile < 50 +15 (< 30 +25), copyright < 2020 +15, constructeur gratuit / domaine gratuit +20, pas de mentions légales +10, pas de title/description +10 ; plafonné à 100.

**Capacité à payer** : base 30. Effectif ≥ 1 salarié +20 (≥ 3 : +30). CA publié > 100 k€ +20 (> 300 k€ +30). Ancienneté ≥ 2 ans +10 (≥ 5 : +15). Avis Google ≥ 20 +10 (≥ 80 : +15). Panier moyen secteur (haut : BTP, rénovation, auto, beauté premium, immobilier) +10. Entrepreneur individuel sans salarié et < 1 an −25. Note Google < 3,5 avec ≥ 10 avis −10. Plafonné 0–100.

**Priorité** = round(Besoin × Capacité / 100). `score_reasons` liste chaque règle déclenchée (affichée en puces courtes sur la carte).

### 4.3 Tri

Pile de cartes plein écran triée par priorité. Geste : drag 1:1 avec offset de saisie, projection de momentum (d=0.998), seuil de décision sur position projetée, spring de sortie avec la vélocité du geste, rubber-band vertical. Clavier : `→` garder, `←` jeter, `↑` chaud, `Z` annuler (undo 10 s). Garder ⇒ enrichissement complet + `status=a_appeler`. Jeter ⇒ hash en blacklist, `purge_at = now + 30 j`.

Carte : nom, ville, secteur, 2 jauges de score, capture/vignette de l'ancien site (screenshot via PageSpeed `final-screenshot`) ou « Aucun site », 3 raisons principales, note Google, bouton appel `tel:`.

### 4.4 Appel

`C` ou bouton → `tel:` + feuille de résultat en un geste : Intéressé · Rappeler (date rapide : demain, +3 j, +1 sem, choix) · Pas intéressé · Injoignable (×3 ⇒ suggestion Perdu). Chaque résultat crée une `activity` et déplace le statut.

## 5. Pipeline (CRM)

Statuts : `a_appeler → rappeler → interesse → maquette_en_cours → maquette_envoyee → negociation → signe → paye → en_ligne → abonnement_actif`, plus `perdu` (raison obligatoire). Kanban avec drag & drop (springs, réordonnancement fluide). Vue Aujourd'hui : rappels échus, liens ouverts < 48 h, maquettes à finir, retours clients, impayés, CA du mois, MRR.

## 6. Analyse IA (via Claude Code local)

`ai_jobs` créés depuis la Fiche (« Analyser », « ADN de marque », « Directions »). `ph worker` : poll toutes les 5 s (Supabase, clé service stockée dans le trousseau macOS via `ph login`), prend un job (`claimed_at`), lance `claude -p` avec un prompt versionné + les données du prospect en JSON, attend un JSON validé (zod), écrit `result`. Échec ⇒ `error` + 2 retries.

- **analyse** : positionnement, cible, arguments d'appel (3 max, factuels), pages recommandées, options, fourchette de prix (sert d'ajustement à la grille).
- **brand_dna** : personnalité (traits + anti-traits), valeurs, voix, cible, registre émotionnel, palette dérivée du logo (contraste AA vérifié par `core`), duo typographique, direction photo, niveau de motion.
- **directions** : 3 directions visuelles nommées et contrastées (décrites ; les mini-maquettes HTML sont produites dans le repo du site par Claude Code).

## 7. Tarification

`core/pricing` : `pages × prix_page_secteur + options` = base création. Multiplicateur capacité (0,85 → 1,25 selon `pay_score`). Trois offres :
- **Création seule** : base arrondie à 10 €. Domaine + hébergement transférés.
- **Création + abonnement** : 60 % de la base + mensualité (hébergement, domaine, mail, modifs mineures) 25–45 €.
- **Abonnement seul** : (base / 24) + mensualité, arrondi, engagement 12 mois.

Prix final saisi ⇒ stocké ; les grilles par secteur s'ajustent (moyenne glissante des prix acceptés, pondération 0,3).

## 8. Fabrique de sites

### 8.1 Template `templates/site` (Astro 7, statique)

```
brief.json / brief.md      générés par l'outil
brand-dna.md               généré par le worker
assets/                    logo, photos, textes récupérés
CLAUDE.md                  règles de génération
.claude/commands/          /brand, /directions, /build, /humanize, /audit, /ship
.claude/skills/            frontend-design, humanizer (copies vendorées)
src/                       layouts, composants de base (SEO, Legal, Contact, Analytics)
src/pages/legal/           mentions-legales, confidentialite, cookies, cgu (générés depuis brief.json)
scripts/quality/           slop-lint, legal-check, todo-check, links
.github/workflows/deploy.yml
```

### 8.2 Règles `CLAUDE.md` (extraits normatifs)

- Étapes obligatoires : `/brand` (ADN) → `/directions` (3 mini-maquettes dans `directions/a|b|c.html`) → choix utilisateur → `/build` → boucle de revue visuelle Playwright (375/768/1440, grille : hiérarchie, rythme vertical, alignements, contraste, cohérence ADN, « pourrait-on deviner que c'est généré ? ») → `/humanize` → `/audit` → `/ship`.
- Anti-slop : liste d'expressions bannies (FR), motifs visuels bannis (dégradés violet/bleu génériques, blobs, grille 3 cartes icône+titre+texte par défaut, emojis en puces, glassmorphism décoratif, stock photos génériques), tirets cadratins limités, pas de triades rhétoriques en série.
- Zéro invention : toute donnée absente du brief = `[À COMPLÉTER: ...]` ; bloque `/ship` en mode prod.
- Typographie française : espaces insécables fines avant `; ! ?` et insécable avant `:`, guillemets « », nombres `12 000`.
- Polices auto-hébergées (fontsource), pas d'appel Google Fonts.
- Accessibilité WCAG 2.2 AA, `prefers-reduced-motion` respecté.

### 8.3 Légal généré

- Mentions légales (LCEN art. 6 III) : dénomination, forme, capital, siège, SIREN + RCS/RM, TVA intracom si applicable, directeur de publication, contact, hébergeur Cloudflare, Inc. (101 Townsend St, San Francisco, CA 94107, USA), conception (placeHolder, mention optionnelle).
- Confidentialité : formulaire de contact (finalité, base légale intérêt légitime/pré-contractuel, conservation 3 ans max, destinataire, droits, CNIL), statistiques Cloudflare Web Analytics sans cookie.
- Cookies : « aucun cookie déposé » ⇒ pas de bandeau (aucun traceur soumis à consentement).
- CGU courtes. Médiateur de la consommation exigé dans le brief si clientèle particuliers (champ obligatoire, sinon `[À COMPLÉTER]`).

### 8.4 SEO

JSON-LD `LocalBusiness` (sous-type selon secteur), sitemap, robots, canonical, OG/Twitter, title/description uniques, NAP identique partout, images AVIF/WebP dimensionnées, `lang="fr"`, liens Google Maps. Preview : `noindex` + `robots.txt Disallow` (variable `SITE_MODE=preview|production`).

### 8.5 Formulaire de contact

Le formulaire poste vers l'outil (`/api/forms/<site_id>`, CORS limité au domaine du site) → vérification Turnstile → message stocké (`form_messages`, purge 3 ans) → transfert à l'email du client via SMTP Gmail de l'utilisateur (mot de passe d'application, 500/jour, gratuit). La politique de confidentialité mentionne placeHolder comme sous-traitant. Liens `tel:` et itinéraire en complément.

### 8.6 Cycle de vie

1. Fiche → « Créer le site » : l'outil crée `ph-site-<slug>` (privé) depuis le repo template `placeholder-site-template`, commit `brief.json`, `brand-dna.md`, assets (API GitHub contents), crée le projet Cloudflare Pages `ph-<slug>` (API), ajoute le domaine `<slug>.<preview_domain>`. Secrets Actions hérités du compte (secret par repo posé via API, chiffré libsodium).
2. Bouton « Ouvrir dans Claude Code » → copie `ph site <slug>` (clone ou pull, puis `claude`).
3. Chaque push : Action `deploy.yml` → `npm ci` → build → qualité (Lighthouse CI sur build local, axe, liens, slop, légal) → `wrangler pages deploy` → POST webhook signé HMAC vers l'outil (`/api/webhooks/site`) avec résultats ⇒ `site_versions`.
4. Atelier : iframe mobile + desktop côte à côte, versions, scores, rollback (redeploy d'un sha).

## 9. Lien de présentation

`/voir/<token>` (page publique de l'app, `noindex`) : cadre élégant, bascule mobile/desktop, signature « placeHolder », expiration (défaut 14 j), mot de passe optionnel. Événements `view` (dédupliqués 30 min par token+device, pas de cookie : `sessionStorage` côté client uniquement pour dédup), `like`, `change_request` (texte). Notification dans Aujourd'hui + push navigateur (Web Push, optionnel). Statut → `maquette_envoyee` à la première vue si antérieur.

## 10. Closing

- **Fiche entreprise obligatoire** (SIRET, adresse, mentions) avant tout devis/facture.
- **Devis** PDF (`@react-pdf/renderer`) : numéro `D-AAAA-NNN`, date, validité 30 j, client (dénomination, SIREN, adresse), lignes, total, « TVA non applicable, art. 293 B du CGI », conditions de paiement, acompte 30 %, renvoi CGV. Lien de signature `/signer/<token>` : affichage PDF, nom + case « Bon pour accord » ⇒ `signature` (nom, date, IP, sha256 du PDF), statut `signe`.
- **Contrat / CGV** générés avec le devis : objet, livrables, délais, cession des droits patrimoniaux à paiement complet (reproduction, représentation, adaptation, monde, durée légale), abonnement (durée, résiliation préavis 1 mois après engagement, inclus/exclus), suspension après 30 j d'impayé, propriété du domaine au client, responsabilité, droit applicable.
- **Paiement** Stripe : Checkout pour acompte/solde ; abonnement via Checkout `mode=subscription` ; webhook `/api/webhooks/stripe` ⇒ facture interne générée automatiquement à chaque paiement réussi ; échec ⇒ relance (Stripe Smart Retries) + alerte ; 30 j ⇒ suggestion de suspension (déploiement d'une page « site suspendu »).
- **Facture** PDF : mentions obligatoires (numéro, date, identité vendeur EI + SIRET, client, désignation, quantités, prix, total, date de paiement, pénalités de retard, indemnité forfaitaire 40 €, mention 293 B). Immuable (trigger SQL refuse UPDATE/DELETE hors statut). Suivi du seuil de franchise TVA (prestations de services) dans Réglages.
- **Domaine** Porkbun : vérification dispo + prix ⇒ confirmation explicite ⇒ `register` (contact titulaire = client). DNS : CNAME vers `ph-<slug>.pages.dev` + ajout domaine personnalisé dans Pages. Email forwarding `contact@` → email du client.
- **Mise en ligne** : `SITE_MODE=production` (variable Pages) ⇒ redeploy sans `noindex`. Checklist : HTTPS OK, sitemap soumis (lien Search Console), lien du site sur la fiche Google (à faire par le client, guide fourni).
- **Remise** : PDF de livraison (accès, inclus, support). Offre « création seule » : transfert repo (API GitHub transfer), transfert domaine (code auth Porkbun), export du site.

## 11. RGPD de l'outil

- Base légale : intérêt légitime (prospection B2B téléphonique).
- Rétention : prospects jetés purgés à 30 j (cron), prospects « perdu » purgés à 12 mois, blacklist hachée.
- Données Google re-fetchées si > 30 j (pas d'archivage), `place_id` seul conservé.
- Registre des traitements prérempli dans Réglages.
- Droit d'opposition : bouton « Ne plus contacter » ⇒ blacklist + purge immédiate.

## 12. Interface (apple-design)

- Respond on press, springs interruptibles (Motion : `bounce 0` par défaut, `0.2` après un geste avec élan), drag 1:1 + projection, rubber-band, matériaux translucides (`backdrop-filter`) pour sidebar/toolbar/tab bar, scroll edge effects, typographie système avec tracking par taille, thème clair/sombre suivant le système, `prefers-reduced-motion/transparency/contrast`.
- Zéro texte explicatif : libellés directs, icônes (lucide), états vides actionnables.
- Navigation : sidebar (desktop) / tab bar (mobile). `⌘K` palette. Raccourcis `1–7`, `J/K`, `C`, `E`, `/`.
- Logo : wordmark `placeHolder` en texte, emplacement prévu pour le futur logo.

## 13. Sécurité

- Auth Supabase magic link limitée à `OWNER_EMAIL` (middleware + RLS).
- Secrets en variables d'env Vercel : `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_PLACES_KEY`, `PAGESPEED_KEY`, `GITHUB_TOKEN`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `PORKBUN_API_KEY/SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SITE_WEBHOOK_SECRET`, `OWNER_EMAIL`.
- Webhooks signés (Stripe, HMAC site). Tokens de partage/signature : 32 octets aléatoires.
- Achat de domaine et paiements : jamais automatiques, toujours une confirmation explicite.
- Fetch de sites tiers : timeout, taille max 2 Mo, pas de suivi vers IP privées (anti-SSRF).

## 14. Tests

- `packages/core` : Vitest, couverture des scores, pricing, numérotation, légal, slug, contraste, matching.
- Web : tests d'API routes avec mocks des fournisseurs ; e2e Playwright sur Tri, Pipeline, lien de présentation.
- Template : `npm run quality` sur un brief d'exemple en CI.

## 15. Hors périmètre v1

Envoi d'emails de prospection, scripts d'appel, multi-utilisateur, édition visuelle du site dans l'outil, application mobile native.

## 16. Actions manuelles requises (une fois)

Créer : compte Google Cloud + clé Places (carte requise, plafond de quota posé à 950/mois), compte Stripe, compte Porkbun + clé API, `wrangler login` (Cloudflare), achat du domaine placeHolder, création de la micro-entreprise. Tout le reste est automatisé.

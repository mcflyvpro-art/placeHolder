# placeHolder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire l'outil placeHolder (prospection → fabrique de sites → CRM → closing) décrit dans la spec.

**Architecture:** Monorepo npm workspaces. `packages/core` = logique pure testée (scoring, pricing, numérotation, légal, contraste, matching). `apps/web` = Next.js 16 App Router + Supabase + intégrations (Google, gouv, BODACC, PageSpeed, GitHub, Cloudflare, Porkbun, Stripe). `packages/cli` = `ph`. `templates/site` = Astro statique + règles Claude Code + CI qualité/déploiement.

**Tech Stack:** Node 22+, TypeScript 5, Next.js 16, React 19, Motion 12+, Supabase JS 2, Zod, @react-pdf/renderer, Stripe Node, Vitest, Playwright, Astro 5+, wrangler.

**Spec:** `docs/superpowers/specs/2026-10-01-placeholder-design.md`

## Global Constraints

- Budget 0 € : aucun service payant hors domaines ; quota Google Text Search Enterprise coupé à 950 req/mois.
- Interface : apple-design (`.claude/skills/apple-design/SKILL.md`) — springs interruptibles `bounce 0` par défaut, feedback au press, matériaux translucides, reduced motion/transparency/contrast, zéro texte explicatif.
- Langue UI et documents : français. Typographie française.
- Factures/devis : numérotation sans trou `D-AAAA-NNN` / `F-AAAA-NNN`, mention « TVA non applicable, art. 293 B du CGI », bloqués sans SIRET.
- Achats (domaine) et paiements : jamais automatiques, confirmation explicite.
- RLS : toutes les tables réservées à `OWNER_EMAIL`.
- Sites clients : Cloudflare Pages, `noindex` en preview, zéro cookie.

---

## File Structure

```
package.json                     workspaces
packages/core/src/
  naf.ts            presets secteurs (NAF + mots-clés + panier) ; professions réglementées
  cities.ts         villes FR > 20k hab (nom, cp, dept, région, lat, lng)
  audit.ts          parseSiteHtml(html,url) -> SiteAudit
  scoring.ts        needScore, payScore, priority, reasons
  matching.ts       nameSimilarity, haversine, pickSirenMatch
  exclusions.ts     exclusionReason(candidate) -> string|null
  pricing.ts        computeOffers(input) -> Offers ; adjustGrid
  numbering.ts      formatNumber(kind, year, n)
  legal.ts          mentionsLegales/confidentialite/cookies/cgu (markdown) ; cgvContrat
  contrast.ts       contrastRatio, ensureAA
  slug.ts           slugify
  hash.ts           sha256Hex
  pipeline.ts       STATUSES, transitions, callOutcome -> status
  index.ts
packages/core/test/*.test.ts
supabase/migrations/0001_init.sql
apps/web/
  app/(app)/{today,radar,triage,prospects/[id],atelier/[id],pipeline,closing,settings}/page.tsx
  app/login/page.tsx, app/auth/callback/route.ts
  app/voir/[token]/page.tsx, app/signer/[token]/page.tsx
  app/api/radar/{start,step}/route.ts
  app/api/prospects/[id]/{triage,call,status,enrich,ai,site,share,quote,pricing}/route.ts
  app/api/quotes/[id]/pdf/route.ts, app/api/invoices/[id]/pdf/route.ts
  app/api/domains/{check,register}/route.ts
  app/api/stripe/checkout/route.ts
  app/api/webhooks/{stripe,site}/route.ts
  app/api/forms/[siteId]/route.ts
  app/api/share/[token]/event/route.ts
  app/api/sign/[token]/route.ts
  app/api/cron/daily/route.ts
  lib/supabase/{server,client,admin}.ts, lib/auth.ts, lib/env.ts
  lib/sources/{google,gouv,bodacc,pagespeed,fetchsite}.ts
  lib/radar.ts, lib/enrich.ts
  lib/integrations/{github,cloudflare,porkbun,stripe,mailer}.ts
  lib/pdf/{quote,invoice}.tsx
  components/ui/* (Button, Sheet, Gauge, Segmented, Toast, CommandPalette, Shell, TabBar, Sidebar)
  components/triage/CardStack.tsx, components/pipeline/Board.tsx, components/atelier/Preview.tsx
  styles/tokens.css, app/globals.css
  middleware.ts
packages/cli/src/{index,site,worker,login,prompts}.ts
templates/site/ (Astro + CLAUDE.md + .claude + scripts/quality + workflow)
```

## Task 1: Monorepo + core (logique pure, TDD)

**Files:** `package.json`, `tsconfig.base.json`, `packages/core/**`
**Produces:**
- `needScore(a: NeedInput): {score:number; reasons:string[]}` — `NeedInput = {website:string|null; audit:SiteAudit|null; pagespeed:number|null}`
- `payScore(p: PayInput): {score; reasons}` — `PayInput = {trancheEffectif:string|null; ca:number|null; dateCreation:string|null; reviews:number|null; rating:number|null; sectorTier:'high'|'mid'|'low'; entrepreneurIndividuel:boolean; now?:Date}`
- `priority(need,pay) = Math.round(need*pay/100)`
- `computeOffers({pages, options[], sector, payScore, grid}) -> {oneOff:{price}, hybrid:{setup, monthly}, subscription:{monthly, commitmentMonths:12}}`
- `formatNumber('D'|'F'|'A', year, n) -> "D-2026-001"`
- `parseSiteHtml(html, finalUrl) -> SiteAudit {https, viewport, title, description, copyrightYear, generator, freeDomain, legalPage, socials[], themeColor, ogImage, favicon, isSocialOnly}`
- `pickSirenMatch(place, candidates) -> {siren, confidence} | null`
- `exclusionReason(c) -> string | null`
- `contrastRatio(hexA, hexB)`, `ensureAA(fg, bg) -> hex`
- `legalDocs(brief) -> {mentions, confidentialite, cookies, cgu}` (markdown, `[À COMPLÉTER: x]` pour les manques)
- `STATUSES`, `callOutcomeToStatus(outcome)`

- [ ] Tests (Vitest) : besoin = 100 sans site ; site social-only = 100 ; somme plafonnée ; pay base 30 + règles ; EI <1 an −25 ; priorité ; offres arrondies à 10 € et cohérentes (hybrid.setup = 60 % arrondi) ; numérotation `D-2026-007` ; parse HTML (viewport, ©2017, Wix generator, mentions légales) ; matching (même CP + similarité > 0.6) ; exclusions (86.21Z → réglementée, nature 9220 → association) ; contraste (#000/#fff = 21) ; legal docs contient SIREN et `[À COMPLÉTER` si capital absent.
- [ ] Implémenter, `npm test -w packages/core` vert, commit.

## Task 2: Schéma Supabase

**Files:** `supabase/migrations/0001_init.sql`
Tables de la spec §3 + `counters`, `form_messages`, `credit_notes`. Fonction `next_number(kind text) returns text` (verrou `for update`). Trigger `invoices_immutable`. RLS : policy `owner_all` sur chaque table `using (auth.jwt()->>'email' = current_setting('app.owner_email', true))` — owner email stocké dans `app_config` et lu par une fonction `is_owner()`. Bucket storage `assets`, `documents` (privés).
- [ ] Écrire SQL, appliquer sur le projet Supabase (MCP `apply_migration`), vérifier `list_tables`, commit.

## Task 3: Web app socle + design system

**Files:** `apps/web/**` (package, next.config, tokens.css, globals.css, Shell/Sidebar/TabBar, CommandPalette, ui/*, login, middleware, lib/supabase, lib/env)
- Tokens : couleurs sémantiques clair/sombre, matériaux (`--material-thin/regular/thick`), rayons, ombres, échelle typo avec tracking par taille, springs (`spring.default = {type:'spring', bounce:0, duration:0.4}`, `spring.momentum = {bounce:0.2, duration:0.4}`, `spring.sheet`).
- Shell : sidebar translucide (≥ 900 px) / tab bar (mobile), raccourcis `1–7`, `⌘K`.
- Auth magic link ; middleware redirige si non connecté ou email ≠ OWNER_EMAIL.
- [ ] `npm run build -w apps/web` passe, page login rendue, commit.

## Task 4: Sources + Radar

**Files:** `lib/sources/*`, `lib/radar.ts`, `app/api/radar/*`, `app/(app)/radar/page.tsx`
- `googleTextSearch(query, pageToken?)` field mask Enterprise ; incrément `settings.google_calls_month` ; refus si ≥ 950.
- `gouvSearch(name, cp)`, `bodaccHasActiveProcedure(siren)`, `pagespeed(url)` (perf/seo/a11y + screenshot data URI), `fetchSite(url)` (anti-SSRF : refuse IP privées, 2 Mo, 8 s).
- `radarStep(searchId)` : prend la prochaine tâche (mot-clé × ville × page), traite, insère prospects scorés, renvoie progression.
- UI : choix secteurs (chips), zone (segmented France/Région/Départements), lancer ; progression live, compteur quota Google.
- [ ] Tests unitaires des parseurs de réponse (fixtures JSON), commit.

## Task 5: Tri

**Files:** `components/triage/CardStack.tsx`, `app/(app)/triage/page.tsx`, `app/api/prospects/[id]/triage/route.ts`, `.../call/route.ts`
- Drag 1:1 Pointer Events + capture, offset de saisie, historique vélocité, `project(v)`, décision sur position projetée (> 35 % largeur), sortie spring avec vélocité, rubber-band vertical sauf ↑, undo.
- Garder → `triage=kept`, `status=a_appeler`, job enrich ; jeter → blacklist hash + purge_at ; chaud → `hot`.
- Feuille appel : 4 résultats + dates rapides.
- [ ] e2e Playwright : clavier → et ← déplacent la carte et appellent l'API, commit.

## Task 6: Fiche + IA jobs + tarification

**Files:** `app/(app)/prospects/[id]/page.tsx`, panneaux, `api/.../ai`, `api/.../pricing`, `lib/enrich.ts`
- Panneaux : Identité (registre), Google, Ancien site (audit + capture), Scores (raisons), ADN, Analyse, Prix (3 offres éditables), Journal.
- Bouton Analyser/ADN/Directions → `ai_jobs`.
- [ ] Commit.

## Task 7: Pipeline + Aujourd'hui

**Files:** `components/pipeline/Board.tsx`, pages pipeline/today
- Kanban colonnes STATUSES, drag (Motion `Reorder`/layout springs), raison obligatoire pour Perdu.
- Aujourd'hui : rappels échus, liens vus < 48 h, retours, maquettes en cours, impayés, CA mois, MRR.
- [ ] Commit.

## Task 8: Template site Astro

**Files:** `templates/site/**`
- Astro statique, `brief.json` d'exemple, layouts SEO (JSON-LD LocalBusiness), pages légales générées depuis brief (même logique que core/legal, copiée en script de build `scripts/gen-legal.mjs`), composant Contact (POST vers `PH_FORMS_URL`), Cloudflare Web Analytics, `SITE_MODE`.
- `CLAUDE.md` + `.claude/commands/{brand,directions,build,humanize,audit,ship}.md` + skills vendorées (frontend-design, humanizer).
- `scripts/quality/{slop-lint,legal-check,todo-check}.mjs`, `.github/workflows/deploy.yml` (build, quality, lighthouse ci, axe via playwright, wrangler pages deploy, webhook HMAC).
- [ ] `npm run build && npm run quality` sur le brief exemple, commit.

## Task 9: Atelier + intégrations GitHub/Cloudflare + webhook site

**Files:** `lib/integrations/{github,cloudflare}.ts`, `api/.../site`, `api/webhooks/site`, `app/(app)/atelier/[id]/page.tsx`, `components/atelier/Preview.tsx`
- `createSiteRepo(slug, files)` : generate from template, commit brief/assets, secrets (libsodium) ; `createPagesProject(slug)`, `addPagesDomain(project, host)`, `setPagesEnv(project, vars)`.
- Webhook : HMAC vérifié → `site_versions`.
- Atelier : aperçu mobile+desktop (iframes à l'échelle), versions, scores, bouton copie `ph site <slug>`.
- [ ] Commit.

## Task 10: Lien de présentation

**Files:** `app/voir/[token]/page.tsx`, `api/.../share`, `api/share/[token]/event`
- Génération token, expiration, mot de passe optionnel ; cadre mobile/desktop ; boutons like / modif ; events + statut.
- [ ] Commit.

## Task 11: Closing

**Files:** `lib/pdf/*`, `api/.../quote`, `api/quotes/[id]/pdf`, `app/signer/[token]`, `api/sign/[token]`, `lib/integrations/{stripe,porkbun,mailer}.ts`, `api/stripe/checkout`, `api/webhooks/stripe`, `api/domains/*`, `api/forms/[siteId]`, `app/(app)/closing/page.tsx`, `app/(app)/settings/page.tsx`
- Devis (bloqué sans SIRET), signature (nom, IP, sha256), contrat/CGV, Checkout (paiement/abonnement), webhook → facture auto, domaine (check → confirmation → register + DNS + forwarding), mise en ligne (env production + domaine Pages), remise.
- Réglages : fiche entreprise, seuils, grilles, quotas, registre RGPD, seuil franchise TVA.
- [ ] Commit.

## Task 12: Cron + CLI

**Files:** `api/cron/daily`, `vercel.json`, `packages/cli/**`
- Cron : ping, purge (`purge_at < now`), refresh Google > 30 j des prospects actifs, reset quota mensuel.
- CLI : `ph login` (URL + service key → trousseau macOS via `security`), `ph site <slug>` (clone/pull dans `~/placeHolder-sites/<slug>`, lance `claude`), `ph worker` (poll ai_jobs, `claude -p --output-format json`, zod).
- [ ] Commit.

## Task 13: Provisioning + déploiement

- Projet Supabase (MCP), migration, env Vercel, deploy, repo template GitHub, push monorepo.
- Liste des actions manuelles restantes (spec §16).

# placeHolder

Prospection → maquette → CRM → closing pour vendre des sites vitrines à des petits business.

- Spec : `docs/superpowers/specs/2026-10-01-placeholder-design.md`
- Plan : `docs/superpowers/plans/2026-10-01-placeholder.md`

## Structure

| Dossier | Rôle |
|---|---|
| `apps/web` | L'outil (Next.js 16, Vercel) |
| `packages/core` | Logique pure testée : scores, prix, légal, contrats |
| `packages/cli` | `ph` : ouvre un site dans Claude Code, traite les analyses IA |
| `templates/site` | Modèle Astro des sites clients (publié en repo template GitHub) |
| `supabase/migrations` | Schéma (tables `ph_`, isolées dans un projet Supabase partagé) |

## Mise en route (une fois)

1. **Clé serveur Supabase** (projet `samuelfr-site` → Settings → API Keys → secret) :
   `vercel env add SUPABASE_SERVICE_ROLE_KEY production`
2. **CLI** : `cd packages/cli && npm link`, puis `ph login` et `ph password`.
3. **Intégrations** (chacune avec `vercel env add <NOM> production`, puis `vercel deploy --prod`) :
   - `GOOGLE_PLACES_KEY` : Google Cloud → Places API (New), plafond de quota à 950 requêtes/mois.
   - `PAGESPEED_KEY` (facultatif) : même projet Google, API PageSpeed Insights.
   - `GITHUB_TOKEN` : token fine-grained, accès à tous les repos de `mcflyvpro-art`, permissions *Administration, Contents, Secrets, Variables, Actions* en écriture.
   - `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` : token avec *Pages:Edit, Zone:Edit, DNS:Edit, Email Routing:Edit, Turnstile:Edit, Account Analytics:Edit*.
   - `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` : webhook vers `/api/webhooks/stripe` (événements `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`).
   - `PORKBUN_API_KEY` + `PORKBUN_SECRET_KEY` : achat de domaines (crédit prépayé).
   - `SMTP_USER` + `SMTP_PASS` : Gmail + mot de passe d'application (formulaires, factures).
4. **Réglages de l'outil** : fiche micro-entreprise (SIRET), domaine des maquettes (facultatif).

## Développement

```bash
npm install
npm test
npm run dev
```

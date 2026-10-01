// Prompts versionnés pour `claude -p`. Sortie : un bloc JSON strict, rien d'autre.
import { z } from 'zod';

const RULES = `Règles absolues :
- N'invente aucun fait. Si une donnée manque, écris "[À COMPLÉTER: …]".
- Écris en français naturel, concret, sans formules toutes faites (« partenaire de confiance », « solutions sur mesure », « passionnés », « au cœur de »…).
- Réponds UNIQUEMENT avec un bloc \`\`\`json … \`\`\` valide.`;

export const schemas = {
  analyse: z.object({
    positionnement: z.string(),
    cible: z.string(),
    arguments: z.array(z.string()).max(3),
    pages: z.array(z.string()).min(1).max(8),
    services: z.array(z.string()).max(12),
    options: z.array(z.string()).max(6),
    prix: z.object({ min: z.number(), max: z.number(), commentaire: z.string().optional() }),
  }),
  brand_dna: z.object({ markdown: z.string().min(200) }),
  directions: z.object({
    directions: z
      .array(z.object({ nom: z.string(), idee: z.string(), palette: z.array(z.string()).min(2).max(6), typo: z.string(), ambiance: z.string() }))
      .length(3),
  }),
};

export function prompt(type, p) {
  const data = JSON.stringify(
    {
      nom: p.name, secteur: p.sector, ville: p.city, adresse: p.address, creation: p.date_creation, effectif: p.tranche_effectif,
      dirigeants: p.dirigeants, finances: p.finances, google: { note: p.rating, avis: p.reviews, horaires: p.hours },
      site_actuel: { url: p.website, audit: p.audit, pagespeed: p.pagespeed }, scores: { besoin: p.need_score, capacite: p.pay_score, raisons: p.score_reasons },
      adn_existant: p.brand_dna ?? null, analyse_existante: p.ai_analysis ?? null,
    },
    null,
    2,
  );
  if (type === 'analyse') {
    return `Tu prépares la vente d'un site vitrine à un petit business français. Données vérifiées :\n${data}\n\nProduis :
- positionnement (2 phrases factuelles), cible (qui appelle, pourquoi) ;
- arguments : 3 arguments d'appel téléphonique, chacun appuyé sur un fait des données (défaut du site actuel, absence de site, avis…) ;
- pages : pages à créer ; services : services probables du métier (marqués "(à confirmer)") ;
- options utiles parmi form, gallery, booking, menu, multilingual, blog, reviews ;
- prix : fourchette réaliste en euros pour la création (petit business, France).
Format : {"positionnement","cible","arguments":[],"pages":[],"services":[],"options":[],"prix":{"min","max","commentaire"}}
${RULES}`;
  }
  if (type === 'brand_dna') {
    return `Écris l'ADN de marque de cette entreprise pour guider la création de son site. Données :\n${data}\n\nMarkdown avec les sections : En une phrase · Personnalité (4 traits justifiés par un fait) · Ce qu'elle n'est pas (3 anti-traits) · Valeurs prouvées · Clientèle · Voix (vouvoiement/tutoiement, 5 mots du métier, 5 mots bannis) · Registre émotionnel · Palette (hex, rôle, contraste AA) · Typographie (2 polices @fontsource) · Direction photo · Mouvement · Idée visuelle forte (une seule).
Format : {"markdown": "…"}
${RULES}`;
  }
  return `À partir de ces données et de l'ADN, propose 3 directions visuelles réellement différentes pour le site (composition, typographie, traitement de l'image), toutes fidèles à la marque. Données :\n${data}\n\nFormat : {"directions":[{"nom","idee","palette":["#hex"…],"typo","ambiance"}…3]}
${RULES}`;
}

export function extractJson(text) {
  const fence = text.match(/```json\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  return JSON.parse(raw);
}

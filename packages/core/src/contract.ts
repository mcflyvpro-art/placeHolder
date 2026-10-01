export type OfferKind = 'oneOff' | 'hybrid' | 'subscription';

export type Seller = {
  nom: string;
  siret: string;
  adresse: string;
  email: string;
  telephone?: string;
  iban?: string;
  bic?: string;
};

export type Client = {
  denomination: string;
  siren: string | null;
  adresse: string | null;
  email: string | null;
  representant: string | null;
};

export type QuoteLine = { label: string; detail?: string; qty: number; unit: number; recurring?: boolean };

export const VAT_MENTION = 'TVA non applicable, art. 293 B du CGI';

export const LATE_PAYMENT_MENTION =
  "En cas de retard de paiement, des pénalités au taux de trois fois le taux d'intérêt légal sont exigibles, ainsi qu'une indemnité forfaitaire pour frais de recouvrement de 40 € (art. L441-10 du Code de commerce). Pas d'escompte pour paiement anticipé.";

export const OFFER_LABEL: Record<OfferKind, string> = {
  oneOff: 'Création du site, propriété complète',
  hybrid: 'Création du site + abonnement',
  subscription: 'Site en abonnement',
};

export type QuoteInput = {
  offer: OfferKind;
  pages: number;
  options: { label: string }[];
  oneOff: number;
  setup: number;
  hybridMonthly: number;
  subMonthly: number;
};

/** Lignes du devis selon l'offre choisie. Les montants viennent de la tarification (ajustée). */
export function quoteLines(i: QuoteInput): { lines: QuoteLine[]; total: number; monthly: number | null; commitment: number | null } {
  const desc = `${i.pages} pages, responsive, SEO local, mentions légales et RGPD${i.options.length ? `, ${i.options.map((o) => o.label.toLowerCase()).join(', ')}` : ''}`;
  if (i.offer === 'oneOff') {
    return {
      lines: [
        { label: 'Conception et réalisation du site vitrine', detail: desc, qty: 1, unit: i.oneOff },
        { label: 'Transfert du site, du code et du nom de domaine', detail: 'Remise de tous les accès à la livraison', qty: 1, unit: 0 },
      ],
      total: i.oneOff,
      monthly: null,
      commitment: null,
    };
  }
  if (i.offer === 'hybrid') {
    return {
      lines: [
        { label: 'Conception et réalisation du site vitrine', detail: desc, qty: 1, unit: i.setup },
        { label: 'Abonnement mensuel', detail: 'Hébergement, nom de domaine, adresse email de contact, sauvegardes, petites modifications (1 h/mois)', qty: 1, unit: i.hybridMonthly, recurring: true },
      ],
      total: i.setup,
      monthly: i.hybridMonthly,
      commitment: 12,
    };
  }
  return {
    lines: [
      { label: 'Site vitrine en abonnement', detail: `${desc}. Hébergement, nom de domaine, email de contact, maintenance et petites modifications inclus`, qty: 1, unit: i.subMonthly, recurring: true },
    ],
    total: 0,
    monthly: i.subMonthly,
    commitment: 12,
  };
}

/** Conditions générales de vente, adaptées à l'offre. Annexées au devis. */
export function cgv(offer: OfferKind, seller: Seller): { title: string; body: string }[] {
  const s = [
    { title: 'Objet', body: `Les présentes conditions régissent la prestation de création de site internet réalisée par ${seller.nom} (le Prestataire) pour le Client désigné au devis. La signature du devis vaut acceptation des présentes conditions.` },
    { title: 'Livrables et délais', body: "Le Prestataire livre un site vitrine conforme au devis, mis en ligne sur le nom de domaine du Client. Le délai indicatif est de 15 jours ouvrés après réception des contenus manquants et de l'acompte. Deux séries de modifications sont incluses avant la mise en ligne." },
    { title: 'Obligations du Client', body: "Le Client fournit des informations exactes (coordonnées, mentions légales, photos dont il détient les droits) et répond aux demandes de validation. Il reste responsable du contenu publié sur son site." },
    { title: 'Prix et paiement', body: `Les prix sont indiqués en euros, ${VAT_MENTION}. ${offer === 'subscription' ? "L'abonnement est payable mensuellement d'avance par prélèvement ou carte." : "Un acompte de 30 % est dû à la signature, le solde à la mise en ligne."} ${LATE_PAYMENT_MENTION}` },
  ];
  if (offer !== 'oneOff') {
    s.push({
      title: 'Abonnement',
      body: "L'abonnement couvre l'hébergement, le renouvellement du nom de domaine, l'adresse email de contact, les mises à jour de sécurité et jusqu'à une heure de petites modifications par mois (non reportable). Il est conclu pour une durée initiale de 12 mois, puis reconduit mois par mois, résiliable à tout moment avec un préavis d'un mois après la période initiale. En cas d'impayé de plus de 30 jours après relance, le Prestataire peut suspendre l'affichage du site jusqu'à régularisation.",
    });
  }
  s.push(
    {
      title: 'Propriété intellectuelle',
      body:
        offer === 'oneOff'
          ? "Au paiement intégral du prix, le Prestataire cède au Client, à titre exclusif, les droits patrimoniaux d'auteur sur le site réalisé (droits de reproduction, de représentation et d'adaptation), pour le monde entier et pour la durée légale de protection. Le code source, les accès et le nom de domaine sont remis au Client."
          : "Le Client dispose d'un droit d'utilisation du site pendant toute la durée de l'abonnement. À l'issue de la période initiale de 12 mois, le Client peut racheter le site (cession des droits patrimoniaux et remise du code) pour un montant égal à six mensualités. Les contenus fournis par le Client (textes, photos, logo) restent sa propriété.",
    },
    { title: 'Nom de domaine', body: "Le nom de domaine est enregistré au nom du Client, qui en est titulaire. Le Prestataire en assure la gestion technique tant que dure la relation contractuelle et en remet les codes de transfert sur simple demande." },
    { title: 'Données personnelles', body: "Pour le formulaire de contact du site, le Prestataire agit en qualité de sous-traitant du Client (art. 28 RGPD) : il achemine les messages au Client, ne les utilise pour aucune autre finalité et les conserve au plus 3 ans. Le site ne dépose aucun cookie de suivi." },
    { title: 'Responsabilité', body: "Le Prestataire est tenu d'une obligation de moyens. Sa responsabilité est limitée au montant payé par le Client au titre des 12 derniers mois. Il ne garantit pas un positionnement particulier dans les moteurs de recherche." },
    { title: 'Rétractation', body: "Le Client professionnel ne bénéficie pas du droit de rétractation, sauf s'il emploie au plus cinq salariés et que la prestation n'entre pas dans le champ de son activité principale (art. L221-3 du Code de la consommation) : il dispose alors de 14 jours à compter de la signature." },
    { title: 'Droit applicable', body: "Les présentes conditions sont soumises au droit français. À défaut d'accord amiable, le litige sera porté devant le tribunal compétent du ressort du siège du Prestataire." },
  );
  return s;
}

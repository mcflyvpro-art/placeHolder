export type LegalBrief = {
  denomination: string;
  formeJuridique: string | null;
  capital: string | null;
  siege: string | null;
  siren: string | null;
  registre: string | null;
  tva: string | null;
  directeurPublication: string | null;
  email: string | null;
  telephone: string | null;
  mediateur: string | null;
  b2c: boolean;
  /** Entrepreneur individuel : pas de capital social. */
  individuel?: boolean;
};

export const HOST_CLOUDFLARE =
  'Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, États-Unis — www.cloudflare.com';

export const todo = (label: string) => `[À COMPLÉTER: ${label}]`;

export function formatSiren(siren: string | null): string | null {
  if (!siren) return null;
  const d = siren.replace(/\D/g, '');
  return d.length === 9 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : siren;
}

const or = (v: string | null | undefined, label: string) => (v && v.trim() ? v : todo(label));

export function legalDocs(b: LegalBrief) {
  const lines = [
    '# Mentions légales',
    '',
    '## Éditeur du site',
    '',
    `${b.denomination}${b.formeJuridique ? `, ${b.formeJuridique}` : ''}`,
    b.individuel ? null : `Capital social : ${or(b.capital, 'capital social')}`,
    `Siège : ${or(b.siege, 'adresse du siège')}`,
    `SIREN : ${or(formatSiren(b.siren), 'SIREN')}${b.registre ? ` — ${b.registre}` : ''}`,
    b.tva ? `TVA intracommunautaire : ${b.tva}` : null,
    `Contact : ${or(b.email, 'email')} — ${or(b.telephone, 'téléphone')}`,
    `Directeur de la publication : ${or(b.directeurPublication, 'directeur de la publication')}`,
    '',
    '## Hébergement',
    '',
    HOST_CLOUDFLARE,
    b.b2c ? '' : null,
    b.b2c ? '## Médiation de la consommation' : null,
    b.b2c ? '' : null,
    b.b2c
      ? `Conformément à l'article L612-1 du Code de la consommation, vous pouvez recourir gratuitement au médiateur suivant : ${or(b.mediateur, 'médiateur de la consommation')}.`
      : null,
    '',
    '## Propriété intellectuelle',
    '',
    `L'ensemble des contenus de ce site (textes, photographies, logo) est la propriété de ${b.denomination}, sauf mention contraire. Toute reproduction sans autorisation est interdite.`,
  ].filter((l): l is string => l !== null);

  const confidentialite = [
    '# Politique de confidentialité',
    '',
    `Responsable du traitement : ${b.denomination}, ${or(b.siege, 'adresse du siège')} — ${or(b.email, 'email')}.`,
    '',
    '## Formulaire de contact',
    '',
    "Les informations saisies (nom, coordonnées, message) servent uniquement à répondre à votre demande. Base légale : mesures précontractuelles prises à votre demande et intérêt légitime. Elles sont conservées au maximum 3 ans après le dernier échange, puis supprimées.",
    '',
    `Destinataires : ${b.denomination} et son prestataire technique (placeHolder, sous-traitant chargé de l'acheminement des messages). Aucune donnée n'est vendue ni cédée.`,
    '',
    '## Mesure d’audience',
    '',
    "Ce site utilise Cloudflare Web Analytics, un outil de mesure d'audience qui ne dépose aucun cookie et ne collecte aucune donnée permettant de vous identifier.",
    '',
    '## Vos droits',
    '',
    `Vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation et d'opposition. Écrivez à ${or(b.email, 'email')}. En cas de difficulté, vous pouvez saisir la CNIL (www.cnil.fr).`,
  ];

  const cookies = [
    '# Cookies',
    '',
    "Ce site ne dépose aucun cookie sur votre appareil : ni publicité, ni suivi, ni réseaux sociaux. C'est pour cela qu'aucun bandeau de consentement ne s'affiche.",
    '',
    "La protection anti-spam du formulaire (Cloudflare Turnstile) n'utilise pas de cookie publicitaire et sert uniquement à sécuriser l'envoi.",
  ];

  const cgu = [
    "# Conditions générales d'utilisation",
    '',
    `Ce site présente l'activité de ${b.denomination}. Son accès est libre et gratuit.`,
    '',
    "Les informations publiées sont fournies à titre indicatif et peuvent évoluer. Les tarifs et disponibilités sont confirmés lors d'un devis.",
    '',
    `L'éditeur ne saurait être tenu responsable d'une indisponibilité temporaire du site. Les liens vers des sites tiers n'engagent pas ${b.denomination}.`,
    '',
    'Ces conditions sont régies par le droit français.',
  ];

  return {
    mentions: lines.join('\n'),
    confidentialite: confidentialite.join('\n'),
    cookies: cookies.join('\n'),
    cgu: cgu.join('\n'),
  };
}

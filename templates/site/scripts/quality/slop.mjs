// Expressions et motifs qui trahissent un texte ou un design générique / généré.
export const BANNED_PHRASES = [
  'bienvenue sur notre site', 'bienvenue sur le site', 'votre partenaire de confiance', "n'hésitez pas à nous contacter",
  "n’hésitez pas à nous contacter", 'nous mettons tout en œuvre', 'nous mettons tout en oeuvre', 'à votre écoute pour',
  'un savoir-faire unique', 'une équipe de passionnés', 'qualité et professionnalisme', 'professionnalisme et qualité',
  'la satisfaction de nos clients est notre priorité', 'votre satisfaction est notre priorité', 'solutions sur mesure adaptées',
  'au cœur de notre', 'plongez dans', 'découvrez notre univers', "dans un monde où", 'que vous soyez un particulier ou un professionnel',
  'lorem ipsum', 'expertise reconnue', 'un service de qualité', "n'attendez plus", 'faites confiance à', 'sublimez votre',
  'incontournable de', 'excellence au service', "l'excellence à votre service", 'votre projet, notre passion', 'notre passion, votre',
  'à la pointe de', 'alliant tradition et modernité', 'tradition et modernité', 'élevez votre', 'révolutionnez',
  'seamless', 'elevate your', 'unlock', 'delve', 'tapestry', 'cutting-edge', 'game-changer', 'look no further',
];

export const SLOP_EMOJI = /[\u{1F680}\u{2728}\u{1F31F}\u{1F4A1}\u{1F525}\u{2705}\u{1F3AF}\u{1F48E}\u{1F64C}\u{1F44D}]/u;

/** Couleurs de dégradés « IA » génériques (violet/indigo). */
export const SLOP_COLORS = /#(8b5cf6|7c3aed|6366f1|a855f7|9333ea|4f46e5|c084fc|818cf8)\b/i;

export const MAX_EM_DASH_PER_PAGE = 3;

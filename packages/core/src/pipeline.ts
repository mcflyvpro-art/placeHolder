/**
 * Parcours client en 8 étapes. Chaque étape peut casser vers « perdu » (on retient où).
 *
 * Tri ─▶ ① À créer ─▶ ② Maquette ⟲ ─▶ ③ Appel ─▶ ④ Rendez-vous ─▶ ⑤ Proposition ⟲ ─▶ ⑥ Deal ─▶ ⑦ Livraison ─▶ ⑧ Client
 */
export const STAGES = [
  { key: 'a_creer', label: 'À créer', short: 'À créer', tint: '#8f8cff' },
  { key: 'maquette', label: 'Maquette', short: 'Maquette', tint: '#ff5c8a' },
  { key: 'appel', label: 'Appel', short: 'Appel', tint: '#34d17a' },
  { key: 'rdv', label: 'Rendez-vous', short: 'RDV', tint: '#3e9bff' },
  { key: 'proposition', label: 'Proposition', short: 'Prop.', tint: '#ff9f43' },
  { key: 'deal', label: 'Deal', short: 'Deal', tint: '#ffd23f' },
  { key: 'livraison', label: 'Livraison', short: 'Livr.', tint: '#2cc6c0' },
  { key: 'client', label: 'Client', short: 'Client', tint: '#6be8a3' },
] as const;

export type Stage = (typeof STAGES)[number]['key'];
export type Status = Stage | 'perdu';

export const STATUS_LABEL: Record<Status, string> = {
  ...(Object.fromEntries(STAGES.map((s) => [s.key, s.label])) as Record<Stage, string>),
  perdu: 'Perdu',
};

/** Compatibilité : liste à plat (étapes + perdu) pour les sélecteurs. */
export const STATUSES: { key: Status; label: string }[] = [
  ...STAGES.map((s) => ({ key: s.key as Status, label: s.label })),
  { key: 'perdu', label: 'Perdu' },
];

export const stageIndex = (s: Status) => STAGES.findIndex((x) => x.key === s);
export const stageOf = (s: Status) => STAGES.find((x) => x.key === s);

/** Étape suivante dans le parcours (null en fin de parcours ou si perdu). */
export function nextStage(s: Status): Stage | null {
  const i = stageIndex(s);
  return i >= 0 && i < STAGES.length - 1 ? STAGES[i + 1]!.key : null;
}

/** Un événement ne fait jamais reculer un prospect, et ne ressuscite pas un perdu. */
export function advance(current: Status, target: Status): Status {
  if (current === 'perdu') return current;
  if (target === 'perdu') return 'perdu';
  return stageIndex(target) > stageIndex(current) ? target : current;
}

/** Correspondance des anciens statuts (migration). */
export const LEGACY_STATUS: Record<string, Status> = {
  a_appeler: 'a_creer',
  maquette_en_cours: 'maquette',
  maquette_envoyee: 'appel',
  rappeler: 'appel',
  interesse: 'rdv',
  negociation: 'proposition',
  signe: 'deal',
  paye: 'deal',
  en_ligne: 'livraison',
  abonnement_actif: 'client',
  perdu: 'perdu',
};

export type CallOutcome = 'interested' | 'callback' | 'not_interested' | 'no_answer';

export const CALL_OUTCOMES: { key: CallOutcome; label: string }[] = [
  { key: 'interested', label: 'Rendez-vous calé' },
  { key: 'callback', label: 'Rappeler' },
  { key: 'not_interested', label: 'Pas intéressé' },
  { key: 'no_answer', label: 'Injoignable' },
];

export function callOutcomeToStatus(o: CallOutcome): Status {
  switch (o) {
    case 'interested':
      return 'rdv';
    case 'callback':
    case 'no_answer':
      return 'appel';
    case 'not_interested':
      return 'perdu';
  }
}

export const MEETING_MODES = [
  { key: 'telephone', label: 'Téléphone' },
  { key: 'visio', label: 'Visio' },
  { key: 'sur_place', label: 'Sur place' },
] as const;
export type MeetingMode = (typeof MEETING_MODES)[number]['key'];

export type Proposal = {
  offer: 'oneOff' | 'hybrid' | 'subscription';
  price: number;
  monthly: number | null;
  deliveryDate: string | null;
  round: number;
};

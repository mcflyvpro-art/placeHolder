export const STATUSES = [
  { key: 'a_appeler', label: 'À appeler' },
  { key: 'rappeler', label: 'Rappeler' },
  { key: 'interesse', label: 'Intéressé' },
  { key: 'maquette_en_cours', label: 'Maquette en cours' },
  { key: 'maquette_envoyee', label: 'Maquette envoyée' },
  { key: 'negociation', label: 'Négociation' },
  { key: 'signe', label: 'Signé' },
  { key: 'paye', label: 'Payé' },
  { key: 'en_ligne', label: 'En ligne' },
  { key: 'abonnement_actif', label: 'Abonnement actif' },
  { key: 'perdu', label: 'Perdu' },
] as const;

export type Status = (typeof STATUSES)[number]['key'];

export const STATUS_LABEL = Object.fromEntries(STATUSES.map((s) => [s.key, s.label])) as Record<Status, string>;

export type CallOutcome = 'interested' | 'callback' | 'not_interested' | 'no_answer';

export const CALL_OUTCOMES: { key: CallOutcome; label: string }[] = [
  { key: 'interested', label: 'Intéressé' },
  { key: 'callback', label: 'Rappeler' },
  { key: 'not_interested', label: 'Pas intéressé' },
  { key: 'no_answer', label: 'Injoignable' },
];

export function callOutcomeToStatus(o: CallOutcome): Status {
  switch (o) {
    case 'interested':
      return 'interesse';
    case 'callback':
      return 'rappeler';
    case 'not_interested':
      return 'perdu';
    case 'no_answer':
      return 'a_appeler';
  }
}

/** Ordre d'avancement : un événement ne fait jamais reculer un prospect. */
export function advance(current: Status, target: Status): Status {
  if (current === 'perdu') return current;
  const idx = (s: Status) => STATUSES.findIndex((x) => x.key === s);
  return idx(target) > idx(current) ? target : current;
}

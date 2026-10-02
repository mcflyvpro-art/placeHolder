import type { Proposal, Stage, Status } from '@ph/core';

/** Tout ce qu'il faut pour afficher un prospect dans n'importe quelle étape du parcours. */
export type CrmItem = {
  id: string;
  name: string;
  city: string | null;
  sector: string | null;
  phone: string | null;
  status: Status;
  lostStage: Stage | null;
  lostReason: string | null;
  need: number;
  pay: number;
  nextAt: string | null;
  stageAt: string;
  meetingAt: string | null;
  meetingMode: string | null;
  meetingNotes: string | null;
  proposal: Proposal | null;
  iterations: number;
  callAttempts: number;
  suggested: { oneOff: number; setup: number; hybridMonthly: number; subMonthly: number } | null;
  site: { previewUrl: string | null; domain: string | null; mode: string; versions: number; lastPassed: boolean | null } | null;
  views: number;
  quote: { number: string; status: string } | null;
  paidDeposit: boolean;
  monthly: number | null;
};

'use client';

import { useState, useTransition } from 'react';
import { MEETING_MODES, type MeetingMode } from '@ph/core';
import { Button, Chip, Segmented, Sheet, fieldClass, useToast } from '@/components/ui';
import { markLost, requestIteration, setMeeting, setProposal } from '@/app/(app)/crm-actions';
import type { CrmItem } from './types';
import s from './crm.module.css';

function localInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function MeetingSheet({ item, open, onClose }: { item: CrmItem; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const tomorrow = new Date(Date.now() + 864e5);
  tomorrow.setHours(10, 0, 0, 0);
  const [at, setAt] = useState(item.meetingAt ? localInput(new Date(item.meetingAt)) : localInput(tomorrow));
  const [mode, setMode] = useState<MeetingMode>((item.meetingMode as MeetingMode) ?? 'telephone');
  const [notes, setNotes] = useState(item.meetingNotes ?? '');
  const [pending, start] = useTransition();
  return (
    <Sheet open={open} onClose={onClose} label="Rendez-vous">
      <div className={s.sheet}>
        <p className={s.sheetTitle}>Rendez-vous avec {item.name}</p>
        <Segmented label="Mode" value={mode} onChange={setMode} options={MEETING_MODES.map((m) => ({ value: m.key, label: m.label }))} />
        <input type="datetime-local" className={fieldClass} value={at} onChange={(e) => setAt(e.target.value)} aria-label="Date et heure" />
        <textarea className={fieldClass} rows={3} placeholder="Ce qu’il attend, ses questions…" value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Notes" />
        <Button
          variant="primary"
          size="lg"
          disabled={!at || pending}
          onClick={() => start(async () => { await setMeeting(item.id, new Date(at).toISOString(), mode, notes); toast({ text: 'Rendez-vous calé' }); onClose(); })}
        >
          Caler le rendez-vous
        </Button>
      </div>
    </Sheet>
  );
}

const OFFERS = [
  { value: 'oneOff' as const, label: 'Création seule' },
  { value: 'hybrid' as const, label: 'Création + abo' },
  { value: 'subscription' as const, label: 'Abonnement' },
];

export function ProposalSheet({ item, open, onClose }: { item: CrmItem; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const sug = item.suggested;
  const init = item.proposal;
  const [offer, setOffer] = useState<'oneOff' | 'hybrid' | 'subscription'>(init?.offer ?? 'hybrid');
  const defaults = (o: typeof offer) =>
    o === 'oneOff' ? { price: sug?.oneOff ?? 0, monthly: null } : o === 'hybrid' ? { price: sug?.setup ?? 0, monthly: sug?.hybridMonthly ?? 30 } : { price: 0, monthly: sug?.subMonthly ?? 60 };
  const [price, setPrice] = useState(String(init?.price ?? defaults(offer).price));
  const [monthly, setMonthly] = useState(String(init?.monthly ?? defaults(offer).monthly ?? ''));
  const inTwoWeeks = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
  const [date, setDate] = useState(init?.deliveryDate ?? inTwoWeeks);
  const [pending, start] = useTransition();
  const pick = (o: typeof offer) => {
    setOffer(o);
    const d = defaults(o);
    setPrice(String(d.price));
    setMonthly(d.monthly == null ? '' : String(d.monthly));
  };
  const num = (v: string) => Number(v.replace(/[^\d]/g, '')) || 0;
  return (
    <Sheet open={open} onClose={onClose} label="Proposition">
      <div className={s.sheet}>
        <p className={s.sheetTitle}>{init ? `Renégocier (tour ${init.round + 1})` : 'Proposition'} · {item.name}</p>
        <Segmented label="Offre" value={offer} onChange={pick} options={OFFERS} />
        <div className={s.fields}>
          <label className={s.field}>
            <span>{offer === 'subscription' ? 'Frais de création' : 'Prix de création'}</span>
            <input className={fieldClass} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} />
          </label>
          {offer !== 'oneOff' ? (
            <label className={s.field}>
              <span>Par mois</span>
              <input className={fieldClass} inputMode="numeric" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
            </label>
          ) : null}
          <label className={s.field}>
            <span>Livraison</span>
            <input type="date" className={fieldClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <Button
          variant="primary"
          size="lg"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await setProposal(item.id, { offer, price: num(price), monthly: offer === 'oneOff' ? null : num(monthly), deliveryDate: date || null });
              toast({ text: 'Proposition enregistrée' });
              onClose();
            })
          }
        >
          Enregistrer la proposition
        </Button>
      </div>
    </Sheet>
  );
}

const REASONS = ['Pas intéressé', 'Trop cher', 'A déjà un prestataire', 'Pas le moment', 'Injoignable'];

export function LostSheet({ item, open, onClose }: { item: CrmItem; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [pending, start] = useTransition();
  return (
    <Sheet open={open} onClose={onClose} label="Refus">
      <div className={s.sheet}>
        <p className={s.sheetTitle}>{item.name} refuse</p>
        <div className={s.chips}>
          {REASONS.map((r) => (
            <Chip key={r} on={reason === r} onClick={() => setReason(r)}>{r}</Chip>
          ))}
        </div>
        <input className={fieldClass} placeholder="Autre raison" value={REASONS.includes(reason) ? '' : reason} onChange={(e) => setReason(e.target.value)} aria-label="Raison" />
        <Button
          variant="danger"
          size="lg"
          disabled={!reason.trim() || pending}
          onClick={() => start(async () => { await markLost(item.id, reason); toast({ text: `${item.name} · perdu` }); onClose(); })}
        >
          Classer perdu
        </Button>
      </div>
    </Sheet>
  );
}

export function IterationSheet({ item, open, onClose }: { item: CrmItem; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [pending, start] = useTransition();
  return (
    <Sheet open={open} onClose={onClose} label="Itération">
      <div className={s.sheet}>
        <p className={s.sheetTitle}>Itération {item.iterations + 1} · {item.name}</p>
        <textarea className={fieldClass} rows={4} placeholder="Ce que le client veut changer" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Modifications" autoFocus />
        <Button variant="primary" size="lg" disabled={pending} onClick={() => start(async () => { await requestIteration(item.id, note); toast({ text: 'Retour en maquette' }); onClose(); })}>
          Renvoyer en maquette
        </Button>
      </div>
    </Sheet>
  );
}

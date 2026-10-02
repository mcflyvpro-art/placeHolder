'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, CalendarClock, Eye, PenTool, RefreshCw, RotateCcw, X, FileSignature, Globe, Check, Repeat2 } from 'lucide-react';
import { MEETING_MODES, STATUS_LABEL, type Stage } from '@ph/core';
import { Button, Badge, useToast } from '@/components/ui';
import { CallButton } from '@/components/prospect/CallSheet';
import { stepForward, reopen } from '@/app/(app)/crm-actions';
import { euro, relative, dateFr } from '@/lib/format';
import { spring } from '@/lib/motion';
import { MeetingSheet, ProposalSheet, LostSheet, IterationSheet } from './Sheets';
import type { CrmItem } from './types';
import s from './crm.module.css';

const OFFER_SHORT = { oneOff: 'Création seule', hybrid: 'Création + abonnement', subscription: 'Abonnement' } as const;

function Fact({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className={s.fact}>
      <span>{label}</span>
      <b style={tone ? { color: tone } : undefined}>{value}</b>
    </div>
  );
}

export function StageCard({ item }: { item: CrmItem }) {
  const toast = useToast();
  const [sheet, setSheet] = useState<'meeting' | 'proposal' | 'lost' | 'iteration' | null>(null);
  const [pending, start] = useTransition();
  const late = item.nextAt && new Date(item.nextAt) < new Date();

  const forward = (label: string) =>
    start(async () => {
      await stepForward(item.id);
      toast({ text: `${item.name} → ${label}` });
    });

  const facts: React.ReactNode[] = [];
  const actions: React.ReactNode[] = [];
  const st = item.status;

  if (st === 'a_creer') {
    facts.push(<Fact key="n" label="Besoin" value={item.need} tone="var(--need)" />, <Fact key="p" label="Capacité" value={item.pay} tone="var(--pay)" />);
    actions.push(
      <Link key="a" href={`/atelier/${item.id}`} className={s.primaryLink}><PenTool size={15} />Créer le site</Link>,
    );
  }
  if (st === 'maquette') {
    facts.push(
      <Fact key="v" label="Versions" value={item.site?.versions ?? 0} />,
      <Fact key="i" label="Itérations" value={item.iterations} tone={item.iterations ? 'var(--orange)' : undefined} />,
      <Fact key="q" label="Qualité" value={item.site?.lastPassed == null ? '—' : item.site.lastPassed ? 'OK' : 'À revoir'} tone={item.site?.lastPassed ? 'var(--green)' : item.site?.lastPassed === false ? 'var(--orange)' : undefined} />,
    );
    actions.push(
      <Link key="a" href={`/atelier/${item.id}`} className={s.ghostLink}><PenTool size={15} />Atelier</Link>,
      <Button key="f" size="sm" variant="primary" disabled={pending || !item.site?.versions} onClick={() => forward('Appel')}><Check />Maquette prête</Button>,
    );
  }
  if (st === 'appel') {
    facts.push(
      <Fact key="t" label="Tentatives" value={item.callAttempts} />,
      <Fact key="v" label="Maquette vue" value={item.views ? `${item.views}×` : 'non'} tone={item.views ? 'var(--purple)' : undefined} />,
    );
    actions.push(
      <CallButton key="c" id={item.id} name={item.name} phone={item.phone} size="sm" />,
      <Button key="m" size="sm" variant="primary" onClick={() => setSheet('meeting')}><CalendarClock />RDV calé</Button>,
      <Button key="i" size="sm" onClick={() => setSheet('iteration')}><Repeat2 />Itérer</Button>,
    );
  }
  if (st === 'rdv') {
    const mode = MEETING_MODES.find((m) => m.key === item.meetingMode)?.label;
    facts.push(
      <Fact key="d" label="Le" value={item.meetingAt ? dateFr(item.meetingAt, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'} />,
      <Fact key="m" label="Mode" value={mode ?? '—'} />,
    );
    actions.push(
      <Button key="p" size="sm" variant="primary" onClick={() => setSheet('proposal')}><ArrowRight />Il veut avancer</Button>,
      <Button key="r" size="sm" onClick={() => setSheet('meeting')}><CalendarClock />Décaler</Button>,
    );
  }
  if (st === 'proposition') {
    const pr = item.proposal;
    facts.push(
      <Fact key="o" label="Offre" value={pr ? OFFER_SHORT[pr.offer] : '—'} />,
      <Fact key="x" label="Prix" value={pr ? `${euro(pr.price)}${pr.monthly ? ` + ${euro(pr.monthly)}/m` : ''}` : '—'} />,
      <Fact key="l" label="Livraison" value={pr?.deliveryDate ? dateFr(pr.deliveryDate) : '—'} />,
    );
    if (pr && pr.round > 1) facts.push(<Fact key="r" label="Tour" value={pr.round} tone="var(--orange)" />);
    actions.push(
      <Link key="q" href={`/closing?p=${item.id}`} className={s.primaryLink}><FileSignature size={15} />{item.quote ? `Devis ${item.quote.status === 'signed' ? 'signé' : 'envoyé'}` : 'Il accepte · devis'}</Link>,
      <Button key="n" size="sm" onClick={() => setSheet('proposal')}><RefreshCw />Renégocier</Button>,
      <Button key="i" size="sm" onClick={() => setSheet('iteration')}><Repeat2 />Itérer</Button>,
    );
  }
  if (st === 'deal') {
    facts.push(
      <Fact key="q" label="Devis" value={item.quote?.number ?? '—'} />,
      <Fact key="a" label="Acompte" value={item.paidDeposit ? 'payé' : 'en attente'} tone={item.paidDeposit ? 'var(--green)' : 'var(--orange)'} />,
    );
    actions.push(<Link key="c" href={`/closing?p=${item.id}`} className={s.primaryLink}><Globe size={15} />Domaine et mise en ligne</Link>);
  }
  if (st === 'livraison') {
    facts.push(<Fact key="d" label="Domaine" value={item.site?.domain ?? '—'} />, <Fact key="m" label="Site" value={item.site?.mode === 'production' ? 'en ligne' : 'aperçu'} tone={item.site?.mode === 'production' ? 'var(--green)' : undefined} />);
    actions.push(
      <Button key="f" size="sm" variant="primary" disabled={pending} onClick={() => forward('Client')}><Check />Livré</Button>,
      <Link key="c" href={`/closing?p=${item.id}`} className={s.ghostLink}><FileSignature size={15} />Closing</Link>,
    );
  }
  if (st === 'client') {
    facts.push(<Fact key="m" label="Abonnement" value={item.monthly ? `${euro(item.monthly)}/mois` : '—'} tone="var(--green)" />, <Fact key="d" label="Domaine" value={item.site?.domain ?? '—'} />);
  }
  if (st === 'perdu') {
    facts.push(<Fact key="s" label="Perdu à" value={item.lostStage ? STATUS_LABEL[item.lostStage] : '—'} />, <Fact key="r" label="Raison" value={item.lostReason ?? '—'} />);
    actions.push(<Button key="o" size="sm" disabled={pending} onClick={() => start(async () => { await reopen(item.id); toast({ text: `${item.name} relancé` }); })}><RotateCcw />Relancer</Button>);
  }
  if (st !== 'perdu' && st !== 'client') {
    actions.push(
      <Button key="lost" size="sm" variant="plain" icon aria-label="Refus" onClick={() => setSheet('lost')} className={s.refuse}><X /></Button>,
    );
  }

  return (
    <motion.article layout className={s.card} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={spring.default}>
      <header className={s.cardHead}>
        <Link href={`/prospects/${item.id}`} className={s.cardName}>{item.name}</Link>
        {item.nextAt && st !== 'perdu' ? (
          <Badge tone={late ? 'red' : undefined}><CalendarClock size={11} />{relative(item.nextAt)}</Badge>
        ) : null}
      </header>
      <p className={s.cardSub}>
        {item.city}
        <span> · depuis {relative(item.stageAt).replace('il y a ', '')}</span>
        {item.site?.previewUrl && st !== 'a_creer' ? (
          <a href={item.site.previewUrl} target="_blank" rel="noreferrer" className={s.preview}><Eye size={12} />maquette</a>
        ) : null}
      </p>
      {item.meetingNotes && st === 'rdv' ? <p className={s.notes}>{item.meetingNotes}</p> : null}
      <div className={s.facts}>{facts}</div>
      <div className={s.actions}>{actions}</div>

      {sheet === 'meeting' ? <MeetingSheet item={item} open onClose={() => setSheet(null)} /> : null}
      {sheet === 'proposal' ? <ProposalSheet item={item} open onClose={() => setSheet(null)} /> : null}
      {sheet === 'lost' ? <LostSheet item={item} open onClose={() => setSheet(null)} /> : null}
      {sheet === 'iteration' ? <IterationSheet item={item} open onClose={() => setSheet(null)} /> : null}
    </motion.article>
  );
}

export const stageKeyOf = (s: string) => s as Stage;

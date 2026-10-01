'use client';

import { useRef, useTransition } from 'react';
import { Phone, StickyNote, ArrowRightLeft, Eye, Heart, MessageSquareWarning, FileText, CreditCard, Globe } from 'lucide-react';
import { STATUS_LABEL, CALL_OUTCOMES, type Status } from '@ph/core';
import { Button, Group, fieldClass } from '@/components/ui';
import { addNote } from '@/app/(app)/actions';
import { relative } from '@/lib/format';
import s from './prospect.module.css';

type Activity = { id: string; kind: string; data: Record<string, unknown>; created_at: string };

const ICONS: Record<string, typeof Phone> = {
  call: Phone, note: StickyNote, status: ArrowRightLeft, share_view: Eye, share_like: Heart,
  share_change: MessageSquareWarning, quote: FileText, payment: CreditCard, site: Globe,
};

function describe(a: Activity): string {
  const d = a.data;
  switch (a.kind) {
    case 'call':
      return `Appel · ${CALL_OUTCOMES.find((o) => o.key === d.outcome)?.label ?? ''}`;
    case 'note':
      return String(d.text ?? '');
    case 'status':
      return `→ ${STATUS_LABEL[d.to as Status] ?? d.to}${d.lostReason ? ` · ${d.lostReason}` : ''}`;
    case 'share_view':
      return `Maquette ouverte${d.device ? ` · ${d.device}` : ''}`;
    case 'share_like':
      return 'Le client aime la maquette';
    case 'share_change':
      return `Modification demandée : ${d.message ?? ''}`;
    case 'quote':
      return `Devis ${d.number ?? ''} · ${d.event ?? ''}`;
    case 'payment':
      return `Paiement ${d.amount ?? ''} €`;
    case 'site':
      return String(d.text ?? 'Site');
    default:
      return a.kind;
  }
}

export function Journal({ id, activities }: { id: string; activities: Activity[] }) {
  const ref = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  return (
    <Group title="Journal">
      <form
        className={s.noteForm}
        onSubmit={(e) => {
          e.preventDefault();
          const v = ref.current?.value ?? '';
          start(async () => {
            await addNote(id, v);
            if (ref.current) ref.current.value = '';
          });
        }}
      >
        <input ref={ref} className={fieldClass} placeholder="Note" aria-label="Note" />
        <Button type="submit" disabled={pending}>Ajouter</Button>
      </form>
      <div className={s.timeline}>
        {activities.map((a) => {
          const Icon = ICONS[a.kind] ?? StickyNote;
          return (
            <div key={a.id} className={s.event}>
              <Icon />
              <span className="t-sub">{describe(a)}</span>
              <span className="t-foot c3">{relative(a.created_at)}</span>
            </div>
          );
        })}
      </div>
    </Group>
  );
}

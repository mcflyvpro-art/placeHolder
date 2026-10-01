'use client';

import { useState, useTransition } from 'react';
import { motion } from 'motion/react';
import { ThumbsUp, CalendarClock, ThumbsDown, PhoneMissed, Phone } from 'lucide-react';
import type { CallOutcome } from '@ph/core';
import { Button, Sheet, fieldClass, useToast } from '@/components/ui';
import { logCall } from '@/app/(app)/actions';
import { telHref } from '@/lib/format';
import { spring } from '@/lib/motion';
import s from './prospect.module.css';

const OUTCOMES: { key: CallOutcome; label: string; icon: typeof ThumbsUp; tone: string }[] = [
  { key: 'interested', label: 'Intéressé', icon: ThumbsUp, tone: 'var(--green)' },
  { key: 'callback', label: 'Rappeler', icon: CalendarClock, tone: 'var(--accent)' },
  { key: 'no_answer', label: 'Injoignable', icon: PhoneMissed, tone: 'var(--orange)' },
  { key: 'not_interested', label: 'Pas intéressé', icon: ThumbsDown, tone: 'var(--red)' },
];

function at(daysAhead: number, hour = 9) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

const QUICK = [
  { label: 'Ce soir', value: () => { const d = new Date(); d.setHours(18, 0, 0, 0); return d.toISOString(); } },
  { label: 'Demain', value: () => at(1) },
  { label: '+3 jours', value: () => at(3) },
  { label: '+1 semaine', value: () => at(7) },
];

export function CallButton({ id, name, phone, size = 'md' }: { id: string; name: string; phone: string | null; size?: 'sm' | 'md' }) {
  const [open, setOpen] = useState(false);
  if (!phone) return null;
  return (
    <>
      <a
        href={telHref(phone)}
        onClick={() => setTimeout(() => setOpen(true), 400)}
        className={`${s.callBtn} ${size === 'sm' ? s.callSm : ''}`}
        aria-label={`Appeler ${name}`}
      >
        <Phone />
        {size === 'md' ? <span className="num">{phone}</span> : null}
      </a>
      <CallSheet id={id} name={name} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function CallSheet({ id, name, open, onClose }: { id: string; name: string; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [step, setStep] = useState<'outcome' | 'when'>('outcome');
  const [custom, setCustom] = useState('');
  const [pending, start] = useTransition();

  const finish = (o: CallOutcome, when?: string | null) => {
    start(async () => {
      await logCall(id, o, when ?? null);
      toast({ text: OUTCOMES.find((x) => x.key === o)!.label });
      setStep('outcome');
      onClose();
    });
  };

  return (
    <Sheet open={open} onClose={() => { setStep('outcome'); onClose(); }} label={`Appel ${name}`}>
      <p className="t-headline" style={{ marginBottom: 16 }}>{name}</p>
      {step === 'outcome' ? (
        <div className={s.outcomes}>
          {OUTCOMES.map((o, i) => (
            <motion.button
              key={o.key}
              type="button"
              className={s.outcome}
              disabled={pending}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring.default, delay: i * 0.03 }}
              onClick={() => (o.key === 'callback' ? setStep('when') : finish(o.key))}
            >
              <o.icon color={o.tone} />
              <span>{o.label}</span>
            </motion.button>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          <div className={s.quick}>
            {QUICK.map((q) => (
              <Button key={q.label} onClick={() => finish('callback', q.value())} disabled={pending}>{q.label}</Button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="datetime-local" className={fieldClass} value={custom} onChange={(e) => setCustom(e.target.value)} aria-label="Date de rappel" />
            <Button variant="primary" disabled={!custom || pending} onClick={() => finish('callback', new Date(custom).toISOString())}>OK</Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

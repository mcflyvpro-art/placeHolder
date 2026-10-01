'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import { Check, CreditCard } from 'lucide-react';
import { spring } from '@/lib/motion';
import s from './signer.module.css';

export function SignForm({ token, status, expired, signedBy, canPay, payLabel, paid }: { token: string; status: string; expired: boolean; signedBy: { name?: string; signedAt?: string } | null; canPay: boolean; payLabel: string; paid: boolean }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (expired) return <p className={s.notice}>Ce devis a expiré. Contactez-nous pour une nouvelle proposition.</p>;

  if (status === 'signed') {
    return (
      <AnimatePresence mode="wait">
        <motion.div key="signed" className={s.done} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring.default}>
          <Check size={28} color="var(--green)" />
          <p className="t-headline">Signé par {signedBy?.name}</p>
          {paid ? (
            <p className="t-sub c2">Paiement reçu. Merci ! Votre facture arrive par email.</p>
          ) : canPay ? (
            <button
              className={s.primary}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const r = await fetch(`/api/sign/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'pay' }) });
                const j = await r.json();
                if (j.url) window.location.href = j.url;
                else { setError('Paiement indisponible pour le moment.'); setBusy(false); }
              }}
            >
              <CreditCard size={18} /> {payLabel}
            </button>
          ) : null}
          {error ? <p className={s.error}>{error}</p> : null}
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <form
      className={s.form}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const r = await fetch(`/api/sign/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sign', name, accept }) });
        if (r.ok) router.refresh();
        else { setError((await r.json()).error ?? 'Signature impossible'); setBusy(false); }
      }}
    >
      <label className={s.field}>
        <span className="t-foot c2">Nom et prénom du signataire</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required minLength={3} autoComplete="name" />
      </label>
      <label className={s.check}>
        <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} required />
        <span>Bon pour accord. J’ai lu et j’accepte le devis et les conditions générales de vente.</span>
      </label>
      <button type="submit" className={s.primary} disabled={!accept || name.trim().length < 3 || busy}>Signer le devis</button>
      {error ? <p className={s.error}>{error}</p> : null}
    </form>
  );
}

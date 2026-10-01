'use client';

import { useActionState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MailCheck } from 'lucide-react';
import { Button, fieldClass } from '@/components/ui';
import { spring } from '@/lib/motion';
import { sendMagicLink } from './actions';
import s from './login.module.css';

export default function Login() {
  const [state, action, pending] = useActionState(sendMagicLink, { sent: false });
  return (
    <main className={s.wrap}>
      <motion.div className={s.card} initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={spring.default}>
        <p className={s.wordmark}>place<b>Holder</b></p>
        <AnimatePresence mode="wait" initial={false}>
          {state.sent ? (
            <motion.div key="sent" className={s.sent} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={spring.default}>
              <MailCheck size={34} strokeWidth={1.6} color="var(--green)" />
              <p className="t-headline">Lien envoyé</p>
            </motion.div>
          ) : (
            <motion.form key="form" action={action} className={s.form} exit={{ opacity: 0, scale: 0.98 }} transition={spring.snappy}>
              <input className={fieldClass} type="email" name="email" placeholder="Email" autoComplete="email" required autoFocus aria-label="Email" />
              <Button type="submit" variant="primary" size="lg" disabled={pending}>
                Recevoir le lien
              </Button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </main>
  );
}

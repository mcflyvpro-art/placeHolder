'use client';

import { useActionState } from 'react';
import { motion } from 'motion/react';
import { Button, fieldClass } from '@/components/ui';
import { spring } from '@/lib/motion';
import { login } from './actions';
import s from './login.module.css';

export default function Login() {
  const [state, action, pending] = useActionState(login, { error: null });
  return (
    <main className={s.wrap}>
      <motion.div className={s.card} initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={spring.default}>
        <p className={s.wordmark}>place<b>Holder</b></p>
        <form action={action} className={s.form}>
          <motion.input
            key={state.error ?? 'pw'}
            className={fieldClass}
            type="password"
            name="password"
            placeholder="Mot de passe"
            autoComplete="current-password"
            required
            autoFocus
            aria-label="Mot de passe"
            aria-invalid={!!state.error}
            animate={state.error ? { x: [0, -8, 7, -5, 3, 0] } : undefined}
            transition={{ duration: 0.4 }}
          />
          {state.error ? <p className={s.error} role="alert">{state.error}</p> : null}
          <Button type="submit" variant="primary" size="lg" disabled={pending}>Entrer</Button>
        </form>
      </motion.div>
    </main>
  );
}

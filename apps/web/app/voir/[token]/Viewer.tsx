'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Smartphone, Monitor, Heart, PencilLine, Check, Lock } from 'lucide-react';
import { spring } from '@/lib/motion';
import s from './viewer.module.css';

export function Viewer({ token, name, url, expired, locked }: { token: string; name: string; url: string | null; expired: boolean; locked: boolean }) {
  const [device, setDevice] = useState<'mobile' | 'desktop'>('desktop');
  const [sheet, setSheet] = useState<'none' | 'change' | 'thanks'>('none');
  const [message, setMessage] = useState('');
  const [liked, setLiked] = useState(false);
  const [unlocked, setUnlocked] = useState(!locked);
  const [pw, setPw] = useState('');
  const [pwError, setPwError] = useState(false);

  const send = (kind: string, extra: object = {}) =>
    fetch(`/api/share/${token}/event`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, device: window.innerWidth < 760 ? 'mobile' : 'desktop', ...extra }) });

  useEffect(() => {
    if (window.innerWidth < 760) setDevice('mobile');
  }, []);

  // Une vue par session d'onglet (pas de cookie de suivi).
  useEffect(() => {
    if (!unlocked || expired) return;
    try {
      const key = `ph_seen_${token}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      /* stockage indisponible : on compte quand même */
    }
    void send('view');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, expired, token]);

  if (expired || !url) {
    return (
      <main className={s.center}>
        <p className={s.brand}>place<b>Holder</b></p>
        <p className="t-headline">Ce lien a expiré.</p>
      </main>
    );
  }

  if (!unlocked) {
    return (
      <main className={s.center}>
        <Lock size={28} strokeWidth={1.6} />
        <p className="t-headline">{name}</p>
        <form
          className={s.pw}
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await send('unlock', { password: pw });
            if (r.ok) setUnlocked(true);
            else setPwError(true);
          }}
        >
          <input type="password" value={pw} onChange={(e) => { setPw(e.target.value); setPwError(false); }} placeholder="Mot de passe" aria-label="Mot de passe" aria-invalid={pwError} autoFocus />
          <button type="submit">Voir</button>
        </form>
      </main>
    );
  }

  return (
    <main className={s.page}>
      <header className={s.bar}>
        <div className={s.title}>
          <span className="t-caption c2">Proposition de site</span>
          <strong>{name}</strong>
        </div>
        <div className={s.switch} role="radiogroup" aria-label="Appareil">
          {(['mobile', 'desktop'] as const).map((d) => (
            <button key={d} type="button" role="radio" aria-checked={device === d} onPointerDown={() => setDevice(d)} className={s.switchBtn}>
              {device === d ? <motion.span layoutId="dev" className={s.thumb} transition={spring.snappy} /> : null}
              {d === 'mobile' ? <Smartphone size={16} /> : <Monitor size={16} />}
              <span>{d === 'mobile' ? 'Mobile' : 'Ordinateur'}</span>
            </button>
          ))}
        </div>
      </header>

      <div className={s.stage}>
        <motion.div layout className={device === 'mobile' ? s.phone : s.desktop} transition={spring.default}>
          <iframe src={url} title={`Site ${name}`} className={s.frame} />
        </motion.div>
      </div>

      <footer className={s.actions}>
        <motion.button
          type="button"
          className={`${s.action} ${liked ? s.liked : ''}`}
          whileTap={{ scale: 0.94 }}
          onClick={() => { if (!liked) { setLiked(true); void send('like'); } }}
        >
          <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
          {liked ? 'Merci !' : 'Ça me plaît'}
        </motion.button>
        <motion.button type="button" className={s.action} whileTap={{ scale: 0.94 }} onClick={() => setSheet('change')}>
          <PencilLine size={18} />
          Je veux une modification
        </motion.button>
      </footer>
      <p className={s.sign}>Conçu par place<b>Holder</b></p>

      <AnimatePresence>
        {sheet !== 'none' ? (
          <>
            <motion.div className={s.scrim} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSheet('none')} />
            <motion.div className={s.sheet} role="dialog" aria-modal="true" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={spring.sheet}>
              {sheet === 'thanks' ? (
                <div className={s.thanks}><Check size={30} color="var(--green)" /><p className="t-headline">Bien reçu, je reviens vers vous.</p></div>
              ) : (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const r = await send('change_request', { message });
                    if (r.ok) { setSheet('thanks'); setMessage(''); setTimeout(() => setSheet('none'), 1800); }
                  }}
                >
                  <label className="t-headline" htmlFor="msg">Qu’aimeriez-vous changer ?</label>
                  <textarea id="msg" value={message} onChange={(e) => setMessage(e.target.value)} rows={5} required maxLength={2000} autoFocus />
                  <button type="submit" disabled={!message.trim()}>Envoyer</button>
                </form>
              )}
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </main>
  );
}

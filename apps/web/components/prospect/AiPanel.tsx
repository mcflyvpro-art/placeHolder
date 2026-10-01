'use client';

import { useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Sparkles, Fingerprint, Palette, Loader2, TerminalSquare, AlertCircle } from 'lucide-react';
import { Button, Group, Badge } from '@/components/ui';
import { queueAiJob } from '@/app/(app)/actions';
import { spring } from '@/lib/motion';
import s from './prospect.module.css';

type Job = { type: 'analyse' | 'brand_dna' | 'directions'; status: string; created_at: string; error: string | null };
export type Analysis = {
  positionnement?: string;
  cible?: string;
  arguments?: string[];
  pages?: string[];
  options?: string[];
  prix?: { min: number; max: number; commentaire?: string };
};
export type Direction = { nom: string; idee: string; palette: string[]; typo: string; ambiance: string };

const KINDS = [
  { type: 'analyse' as const, label: 'Analyse', icon: Sparkles },
  { type: 'brand_dna' as const, label: 'ADN de marque', icon: Fingerprint },
  { type: 'directions' as const, label: 'Directions', icon: Palette },
];

export function AiPanel({
  id,
  jobs,
  analysis,
  brandDna,
  directions,
}: {
  id: string;
  jobs: Job[];
  analysis: Analysis | null;
  brandDna: string | null;
  directions: Direction[] | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const active = jobs.filter((j) => j.status === 'queued' || j.status === 'running');
  const stale = active.some((j) => j.status === 'queued' && Date.now() - new Date(j.created_at).getTime() > 90_000);

  useEffect(() => {
    if (!active.length) return;
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [active.length, router]);

  const lastOf = (type: Job['type']) => jobs.find((j) => j.type === type);

  return (
    <>
      <Group title="Claude">
        <div className={s.ai}>
          {KINDS.map((k) => {
            const j = lastOf(k.type);
            const running = j && (j.status === 'queued' || j.status === 'running');
            return (
              <div key={k.type} className={s.aiRow}>
                <k.icon size={18} color="var(--purple)" />
                <span>{k.label}</span>
                {j?.status === 'error' ? <Badge tone="red"><AlertCircle size={11} />Échec</Badge> : null}
                {running ? (
                  <Badge tone="purple">
                    <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} style={{ display: 'inline-flex' }}>
                      <Loader2 size={11} />
                    </motion.span>
                    {j.status === 'queued' ? 'En file' : 'En cours'}
                  </Badge>
                ) : (
                  <Button size="sm" disabled={pending} onClick={() => start(() => queueAiJob(id, k.type))}>
                    {j?.status === 'done' ? 'Refaire' : 'Lancer'}
                  </Button>
                )}
              </div>
            );
          })}
          {stale ? (
            <motion.p className="t-foot c2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={spring.default} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <TerminalSquare size={14} /> <code className="t-mono">ph worker</code>
            </motion.p>
          ) : null}
        </div>
      </Group>

      {analysis ? (
        <Group title="Analyse">
          <div className={s.ai}>
            {analysis.positionnement ? <p className="t-callout">{analysis.positionnement}</p> : null}
            {analysis.cible ? <p className="t-sub c2">{analysis.cible}</p> : null}
            {analysis.arguments?.length ? (
              <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }} className="t-sub">
                {analysis.arguments.map((a) => <li key={a}>{a}</li>)}
              </ul>
            ) : null}
            {analysis.pages?.length ? <p className="t-foot c2">Pages : {analysis.pages.join(' · ')}</p> : null}
          </div>
        </Group>
      ) : null}

      {brandDna ? (
        <Group title="ADN de marque">
          <div className={s.markdown} style={{ paddingTop: 16 }}>{brandDna}</div>
        </Group>
      ) : null}

      {directions?.length ? (
        <Group title="Directions">
          {directions.map((d) => (
            <div key={d.nom} className={s.ai} style={{ borderTop: '0.5px solid var(--separator)' }}>
              <div className={s.aiRow}>
                <span className="t-headline">{d.nom}</span>
                <span style={{ display: 'flex', gap: 4 }}>
                  {d.palette.slice(0, 5).map((c) => (
                    <span key={c} style={{ width: 18, height: 18, borderRadius: 5, background: c, boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,.15)' }} title={c} />
                  ))}
                </span>
              </div>
              <p className="t-sub c2">{d.idee}</p>
              <p className="t-foot c3">{d.typo} · {d.ambiance}</p>
            </div>
          ))}
        </Group>
      ) : null}
    </>
  );
}

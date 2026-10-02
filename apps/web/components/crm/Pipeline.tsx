'use client';

import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { Layers } from 'lucide-react';
import { STAGES, type Stage, type Status } from '@ph/core';
import { Empty } from '@/components/ui';
import { spring } from '@/lib/motion';
import { StageCard } from './StageCard';
import type { CrmItem } from './types';
import s from './crm.module.css';

type Key = Stage | 'perdu';

/** Arbre du parcours : 8 étapes reliées, une branche « perdu » sous chacune. */
export function Pipeline({ items }: { items: CrmItem[] }) {
  const router = useRouter();
  const params = useSearchParams();

  const counts = useMemo(() => {
    const c = new Map<Status, number>();
    const lost = new Map<Stage, number>();
    for (const it of items) {
      c.set(it.status, (c.get(it.status) ?? 0) + 1);
      if (it.status === 'perdu' && it.lostStage) lost.set(it.lostStage, (lost.get(it.lostStage) ?? 0) + 1);
    }
    return { c, lost };
  }, [items]);

  const firstWithItems = STAGES.find((st) => counts.c.get(st.key))?.key ?? 'a_creer';
  const selected = (params.get('s') as Key | null) ?? firstWithItems;
  const select = (k: Key) => router.replace(`/pipeline?s=${k}`, { scroll: false });

  const list = items
    .filter((it) => it.status === selected)
    .sort((a, b) => {
      const an = a.nextAt ? new Date(a.nextAt).getTime() : Infinity;
      const bn = b.nextAt ? new Date(b.nextAt).getTime() : Infinity;
      return an - bn || new Date(a.stageAt).getTime() - new Date(b.stageAt).getTime();
    });
  const selectedStage = STAGES.find((x) => x.key === selected);
  const lostTotal = counts.c.get('perdu') ?? 0;

  return (
    <LayoutGroup>
      <div className={s.treeWrap}>
        <div className={s.tree} role="tablist" aria-label="Étapes du parcours">
          {STAGES.map((st, i) => {
            const n = counts.c.get(st.key) ?? 0;
            const lost = counts.lost.get(st.key) ?? 0;
            const on = selected === st.key;
            return (
              <div key={st.key} className={s.col} style={{ '--tint': st.tint } as React.CSSProperties}>
                {i > 0 ? <span className={`${s.link} ${n ? s.linkOn : ''}`} aria-hidden /> : null}
                <button type="button" role="tab" aria-selected={on} className={`${s.node} ${on ? s.nodeOn : ''} ${n ? '' : s.nodeEmpty}`} onClick={() => select(st.key)}>
                  {on ? <motion.span layoutId="stage-pill" className={s.nodePill} transition={spring.snappy} /> : null}
                  <span className={s.nodeNum}>{i + 1}</span>
                  <span className={s.nodeCount}>{n}</span>
                  <span className={s.nodeLabel}>{st.label}</span>
                </button>
                <span className={`${s.branch} ${lost ? s.branchOn : ''}`} aria-hidden />
                <span className={`${s.lostDot} ${lost ? s.lostDotOn : ''}`}>{lost || ''}</span>
              </div>
            );
          })}
        </div>
        <button type="button" className={`${s.lostRail} ${selected === 'perdu' ? s.lostRailOn : ''}`} onClick={() => select('perdu')}>
          Perdus · {lostTotal}
        </button>
      </div>

      <section className={s.panel} aria-live="polite">
        <header className={s.panelHead}>
          <span className={s.panelDot} style={{ background: selectedStage?.tint ?? 'var(--red)' }} />
          <h2>{selectedStage?.label ?? 'Perdus'}</h2>
          <span className={s.panelCount}>{list.length}</span>
        </header>
        {list.length ? (
          <div className={s.grid}>
            <AnimatePresence mode="popLayout">
              {list.map((it) => (
                <StageCard key={it.id} item={it} />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <Empty icon={<Layers />} title={selected === 'a_creer' ? 'Garde des prospects au Tri pour remplir cette étape' : 'Personne à cette étape'} />
        )}
      </section>
    </LayoutGroup>
  );
}

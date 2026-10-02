'use client';

import { STAGES, STATUS_LABEL } from '@ph/core';
import { StageCard } from './StageCard';
import type { CrmItem } from './types';
import s from './journey.module.css';

/** Frise du parcours + actions de l'étape en cours (fiche prospect). */
export function Journey({ item }: { item: CrmItem }) {
  const idx = STAGES.findIndex((x) => x.key === item.status);
  const lostIdx = item.status === 'perdu' && item.lostStage ? STAGES.findIndex((x) => x.key === item.lostStage) : -1;
  return (
    <section className={s.wrap}>
      <ol className={s.steps} aria-label="Parcours">
        {STAGES.map((st, i) => {
          const done = idx > i || (lostIdx > i);
          const now = idx === i;
          const broke = lostIdx === i;
          return (
            <li key={st.key} className={`${s.step} ${done ? s.done : ''} ${now ? s.now : ''} ${broke ? s.broke : ''}`} style={{ '--tint': st.tint } as React.CSSProperties} aria-current={now ? 'step' : undefined}>
              <span className={s.dot} />
              <span className={s.label}>{st.label}</span>
            </li>
          );
        })}
      </ol>
      {item.status === 'perdu' ? <p className={s.lost}>Perdu à l’étape {item.lostStage ? STATUS_LABEL[item.lostStage] : '—'} · {item.lostReason}</p> : null}
      <StageCard item={item} />
    </section>
  );
}

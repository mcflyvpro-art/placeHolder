'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users } from 'lucide-react';
import { STAGES, STATUS_LABEL, type Status } from '@ph/core';
import { Chip, Empty, fieldClass } from '@/components/ui';
import { euro, relative } from '@/lib/format';
import type { CrmItem } from './types';
import s from './crm.module.css';

const tintOf = (st: Status) => STAGES.find((x) => x.key === st)?.tint ?? 'var(--red)';

function amount(it: CrmItem) {
  if (it.monthly) return `${euro(it.monthly)}/mois`;
  if (it.proposal) return `${euro(it.proposal.price)}${it.proposal.monthly ? ` + ${euro(it.proposal.monthly)}/m` : ''}`;
  if (it.suggested) return <span className={s.muted}>≈ {euro(it.suggested.oneOff)}</span>;
  return <span className={s.muted}>—</span>;
}

export function ClientsTable({ items }: { items: CrmItem[] }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [stage, setStage] = useState<Status | 'all' | 'actifs'>('actifs');

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items
      .filter((it) => (stage === 'all' ? true : stage === 'actifs' ? it.status !== 'perdu' : it.status === stage))
      .filter((it) => !needle || `${it.name} ${it.city ?? ''} ${it.phone ?? ''}`.toLowerCase().includes(needle))
      .sort((a, b) => {
        const ia = a.status === 'perdu' ? 99 : STAGES.findIndex((x) => x.key === a.status);
        const ib = b.status === 'perdu' ? 99 : STAGES.findIndex((x) => x.key === b.status);
        return ib - ia || new Date(b.stageAt).getTime() - new Date(a.stageAt).getTime();
      });
  }, [items, q, stage]);

  const count = (st: Status) => items.filter((i) => i.status === st).length;

  return (
    <>
      <div className={s.toolbar}>
        <input className={`${fieldClass} ${s.search}`} placeholder="Nom, ville, téléphone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" />
        <Chip on={stage === 'actifs'} onClick={() => setStage('actifs')}>En cours</Chip>
        {STAGES.map((st) => (
          <Chip key={st.key} on={stage === st.key} onClick={() => setStage(st.key)}>
            {st.label} {count(st.key) ? <span className={s.muted}>{count(st.key)}</span> : null}
          </Chip>
        ))}
        <Chip on={stage === 'perdu'} onClick={() => setStage('perdu')}>Perdus</Chip>
        <Chip on={stage === 'all'} onClick={() => setStage('all')}>Tous</Chip>
      </div>
      {rows.length ? (
        <table className={s.table}>
          <thead>
            <tr>
              <th>Entreprise</th>
              <th>Étape</th>
              <th className={s.hideSm}>Prochaine action</th>
              <th>Montant</th>
              <th className={s.hideSm}>Mouvement</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((it) => {
              const tint = tintOf(it.status);
              const late = it.nextAt && new Date(it.nextAt) < new Date();
              return (
                <tr key={it.id} onClick={() => router.push(`/prospects/${it.id}`)}>
                  <td>
                    <b>{it.name}</b>
                    <div className={s.muted}>{it.city}</div>
                  </td>
                  <td>
                    <span className={s.stagePill} style={{ background: `color-mix(in srgb, ${tint} 18%, transparent)`, color: tint }}>
                      <i style={{ background: tint }} />
                      {STATUS_LABEL[it.status]}
                      {it.status === 'perdu' && it.lostStage ? ` · ${STATUS_LABEL[it.lostStage]}` : ''}
                      {it.iterations && it.status === 'maquette' ? ` · v${it.iterations + 1}` : ''}
                    </span>
                  </td>
                  <td className={s.hideSm}>{it.nextAt && it.status !== 'perdu' ? <span className={late ? s.late : undefined}>{relative(it.nextAt)}</span> : <span className={s.muted}>—</span>}</td>
                  <td>{amount(it)}</td>
                  <td className={`${s.hideSm} ${s.muted}`}>{relative(it.stageAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <Empty icon={<Users />} title="Aucun résultat" />
      )}
    </>
  );
}

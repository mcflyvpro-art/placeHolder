'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { Play, Pause, RotateCw, KeyRound, Check } from 'lucide-react';
import { SECTORS, REGIONS, type Zone } from '@ph/core';
import { Button, Chip, Group, Row, Segmented, fieldClass, useToast, Empty, Badge } from '@/components/ui';
import { spring } from '@/lib/motion';
import s from './radar.module.css';

type SearchRow = {
  id: string;
  sectors: string[];
  zone: Zone;
  status: string;
  found: number;
  kept: number;
  excluded: number;
  error: string | null;
  total: number;
  done: number;
  createdAt: string;
};

type Live = { id: string; progress: number; total: number; found: number; kept: number; excluded: number };

const groups = [...new Set(SECTORS.map((x) => x.group))];

function zoneLabel(z: Zone) {
  if (z.kind === 'france') return 'France';
  if (z.kind === 'regions') return z.codes.map((c) => REGIONS[c] ?? c).join(', ');
  return `Dép. ${z.codes.join(', ')}`;
}

export function RadarPanel({ googleReady, quota, searches }: { googleReady: boolean; quota: { used: number; cap: number }; searches: SearchRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [sectors, setSectors] = useState<string[]>([]);
  const [zoneKind, setZoneKind] = useState<Zone['kind']>('france');
  const [regions, setRegions] = useState<string[]>([]);
  const [depts, setDepts] = useState('');
  const [budget, setBudget] = useState(30);
  const [live, setLive] = useState<Live | null>(null);
  const [usedLive, setUsedLive] = useState(quota.used);
  const stop = useRef(false);

  const remaining = Math.max(0, quota.cap - usedLive);
  const zone: Zone | null = useMemo(() => {
    if (zoneKind === 'france') return { kind: 'france' };
    if (zoneKind === 'regions') return regions.length ? { kind: 'regions', codes: regions } : null;
    const codes = depts.split(/[\s,;]+/).map((d) => d.trim().toUpperCase()).filter(Boolean);
    return codes.length ? { kind: 'departements', codes } : null;
  }, [zoneKind, regions, depts]);

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function loop(id: string, resume = false) {
    stop.current = false;
    let first = true;
    for (;;) {
      if (stop.current) break;
      const r = await fetch('/api/radar/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, resume: resume && first }),
      });
      first = false;
      const j = await r.json();
      if (!r.ok) {
        toast({ text: j.error ?? 'Erreur' });
        break;
      }
      setLive({ id, progress: j.progress, total: j.total, found: j.found, kept: j.kept, excluded: j.excluded });
      setUsedLive(j.quota.used);
      if (j.error === 'quota') {
        toast({ text: 'Quota Google du mois atteint' });
        break;
      }
      if (j.done) {
        toast({ text: `${j.kept} prospects à trier`, action: { label: 'Trier', run: () => router.push('/triage') } });
        break;
      }
    }
    setLive(null);
    router.refresh();
  }

  async function start() {
    if (!zone || !sectors.length) return;
    const r = await fetch('/api/radar/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectors, zone, budget: Math.min(budget, remaining) }),
    });
    const j = await r.json();
    if (!r.ok) {
      toast({ text: j.error === 'google' ? 'Clé Google manquante' : 'Recherche impossible' });
      return;
    }
    setLive({ id: j.id, progress: 0, total: j.total, found: 0, kept: 0, excluded: 0 });
    void loop(j.id);
  }

  if (!googleReady) {
    return (
      <Empty
        icon={<KeyRound />}
        title="Clé Google Places requise"
        action={<Button variant="primary" onClick={() => router.push('/settings#integrations')}>Réglages</Button>}
      />
    );
  }

  return (
    <div className={s.grid}>
      <div className={s.col}>
        <Group title="Secteurs">
          <div className={s.sectors}>
            {groups.map((g) => (
              <div key={g} className={s.sectorGroup}>
                <span className="t-caption c2">{g}</span>
                <div className={s.chips}>
                  {SECTORS.filter((x) => x.group === g).map((x) => (
                    <Chip key={x.key} on={sectors.includes(x.key)} onClick={() => setSectors((l) => toggle(l, x.key))}>
                      {sectors.includes(x.key) ? <Check size={14} strokeWidth={2.5} /> : null}
                      {x.label}
                    </Chip>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Group>
      </div>

      <div className={s.col}>
        <Group title="Zone">
          <Row>
            <Segmented
              label="Zone"
              value={zoneKind}
              onChange={setZoneKind}
              options={[
                { value: 'france', label: 'France' },
                { value: 'regions', label: 'Régions' },
                { value: 'departements', label: 'Départements' },
              ]}
            />
          </Row>
          <AnimatePresence initial={false} mode="popLayout">
            {zoneKind === 'regions' ? (
              <motion.div key="r" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={spring.default}>
                <div className={s.chips} style={{ padding: '4px 16px 14px' }}>
                  {Object.entries(REGIONS).map(([code, name]) => (
                    <Chip key={code} on={regions.includes(code)} onClick={() => setRegions((l) => toggle(l, code))}>{name}</Chip>
                  ))}
                </div>
              </motion.div>
            ) : null}
            {zoneKind === 'departements' ? (
              <motion.div key="d" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={spring.default}>
                <div style={{ padding: '4px 16px 14px' }}>
                  <input className={fieldClass} placeholder="69, 01, 38" value={depts} onChange={(e) => setDepts(e.target.value)} inputMode="text" aria-label="Départements" />
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </Group>

        <Group title="Requêtes Google">
          <Row label={<input type="range" min={1} max={Math.max(1, Math.min(200, remaining))} value={Math.min(budget, remaining)} onChange={(e) => setBudget(Number(e.target.value))} className={s.range} aria-label="Requêtes" />} value={<span className="num">{Math.min(budget, remaining)} · ≈ {Math.min(budget, remaining) * 20} entreprises</span>} />
          <Row label="Restantes ce mois" value={<span className="num">{remaining}</span>} />
        </Group>

        <AnimatePresence mode="wait" initial={false}>
          {live ? (
            <motion.div key="live" className={s.live} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={spring.default}>
              <div className={s.bar}>
                <motion.div className={s.barFill} animate={{ scaleX: live.total ? live.progress / live.total : 0 }} transition={spring.default} />
              </div>
              <div className={s.stats}>
                <Stat n={live.found} label="trouvées" />
                <Stat n={live.kept} label="à trier" tone="var(--green)" />
                <Stat n={live.excluded} label="écartées" />
              </div>
              <Button onClick={() => (stop.current = true)}><Pause />Pause</Button>
            </motion.div>
          ) : (
            <motion.div key="go" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={spring.snappy}>
              <Button variant="primary" size="lg" style={{ width: '100%' }} disabled={!zone || !sectors.length || remaining === 0} onClick={start}>
                <Play />Lancer
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {searches.length ? (
          <Group title="Historique">
            {searches.map((x) => (
              <Row key={x.id}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="t-callout" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {x.sectors.map((k) => SECTORS.find((y) => y.key === k)?.label ?? k).join(', ')}
                  </p>
                  <p className="t-foot c2 num">{zoneLabel(x.zone)} · {x.kept} gardées · {x.done}/{x.total}</p>
                </div>
                {x.status === 'done' ? <Badge tone="green">Terminé</Badge> : null}
                {x.status !== 'done' && !live ? (
                  <Button size="sm" onClick={() => { setLive({ id: x.id, progress: x.done, total: x.total, found: x.found, kept: x.kept, excluded: x.excluded }); void loop(x.id, true); }}>
                    <RotateCw />Reprendre
                  </Button>
                ) : null}
              </Row>
            ))}
          </Group>
        ) : null}
      </div>
    </div>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone?: string }) {
  return (
    <div className={s.stat}>
      <motion.span key={n} className="t-title2 num" style={{ color: tone }} initial={{ y: 6, opacity: 0.4 }} animate={{ y: 0, opacity: 1 }} transition={spring.snappy}>
        {n}
      </motion.span>
      <span className="t-foot c2">{label}</span>
    </div>
  );
}

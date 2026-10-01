'use client';

import { animate, motion, useMotionValue, useTransform, type MotionValue } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Check, Flame, Undo2, Phone, Globe, Star, Building2, MapPin } from 'lucide-react';
import { Button, Gauge, Kbd, Badge } from '@/components/ui';
import { project, rubberband, spring } from '@/lib/motion';
import s from './triage.module.css';

export type TriageCard = {
  id: string;
  name: string;
  sectorLabel: string;
  city: string | null;
  need: number;
  pay: number;
  reasons: string[];
  rating: number | null;
  reviews: number | null;
  phone: string | null;
  website: string | null;
  since: string | null;
  employees: string | null;
  unverified: boolean;
  preview: string | null;
};

export type Decision = 'kept' | 'dropped' | 'hot';

const THRESHOLD = 0.32; // fraction de la largeur à atteindre (position projetée)

function host(url: string | null) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function CardStack({
  cards,
  onDecide,
  onUndo,
  canUndo,
}: {
  cards: TriageCard[];
  onDecide: (card: TriageCard, d: Decision) => void;
  onUndo: () => void;
  canUndo: boolean;
}) {
  const top = cards[0];
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const busy = useRef(false);
  const area = useRef<HTMLDivElement>(null);

  const fling = useCallback(
    (d: Decision, velocity = { x: 0, y: 0 }) => {
      if (!top || busy.current) return;
      busy.current = true;
      const w = area.current?.offsetWidth ?? 400;
      const h = window.innerHeight;
      const target = d === 'hot' ? { x: x.get(), y: -h } : { x: (d === 'kept' ? 1 : -1) * (w * 1.4), y: y.get() + velocity.y * 0.1 };
      if (navigator.vibrate) navigator.vibrate(8);
      const ax = animate(x, target.x, { ...spring.momentum, velocity: velocity.x });
      const ay = animate(y, target.y, { ...spring.momentum, velocity: velocity.y });
      Promise.all([ax, ay]).then(() => {
        onDecide(top, d);
        x.jump(0);
        y.jump(0);
        busy.current = false;
      });
    },
    [top, onDecide, x, y],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(t.tagName) || e.metaKey || e.ctrlKey) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); fling('kept', { x: 1200, y: 0 }); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); fling('dropped', { x: -1200, y: 0 }); }
      if (e.key === 'ArrowUp') { e.preventDefault(); fling('hot', { x: 0, y: -1500 }); }
      if (e.key.toLowerCase() === 'z' && canUndo) { e.preventDefault(); onUndo(); }
      if (e.key.toLowerCase() === 'c' && top?.phone) window.location.href = `tel:${top.phone.replace(/\s/g, '')}`;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fling, canUndo, onUndo, top]);

  return (
    <div className={s.stage}>
      <div className={s.deck} ref={area}>
        {cards.slice(0, 3).reverse().map((c, i, arr) => {
          const depth = arr.length - 1 - i;
          return depth === 0 ? (
            <DraggableCard key={c.id} card={c} x={x} y={y} areaRef={area} busy={busy} onFling={fling} />
          ) : (
            <BackCard key={c.id} card={c} depth={depth} x={x} />
          );
        })}
      </div>

      <div className={s.controls}>
        <Button icon size="lg" variant="secondary" aria-label="Annuler" disabled={!canUndo} onClick={onUndo} className={s.small}>
          <Undo2 />
        </Button>
        <Button icon size="lg" aria-label="Jeter" onClick={() => fling('dropped', { x: -1200, y: 0 })} className={`${s.round} ${s.drop}`} disabled={!top}>
          <X />
        </Button>
        <Button icon size="lg" aria-label="Chaud" onClick={() => fling('hot', { x: 0, y: -1500 })} className={`${s.round} ${s.hot}`} disabled={!top}>
          <Flame />
        </Button>
        <Button icon size="lg" aria-label="Garder" onClick={() => fling('kept', { x: 1200, y: 0 })} className={`${s.round} ${s.keep}`} disabled={!top}>
          <Check />
        </Button>
        {top?.phone ? (
          <a href={`tel:${top.phone.replace(/\s/g, '')}`} className={`${s.small} ${s.call}`}>
            <Phone /><span className={s.callLabel}>Appeler</span>
          </a>
        ) : (
          <span className={s.small} />
        )}
      </div>
      <p className={s.keys}>
        <Kbd>←</Kbd> jeter <Kbd>↑</Kbd> chaud <Kbd>→</Kbd> garder <Kbd>Z</Kbd> annuler <Kbd>C</Kbd> appeler
      </p>
    </div>
  );
}

function BackCard({ card, depth, x }: { card: TriageCard; depth: number; x: MotionValue<number> }) {
  // La carte suivante remonte à mesure que celle du dessus s'éloigne : continuité spatiale.
  const progress = useTransform(x, (v) => Math.min(1, Math.abs(v) / 260));
  const scale = useTransform(progress, (p) => 1 - depth * 0.045 + p * 0.045);
  const ty = useTransform(progress, (p) => depth * 14 - p * 14);
  return (
    <motion.div className={s.card} style={{ scale, y: ty, zIndex: 10 - depth }} aria-hidden>
      <CardBody card={card} />
    </motion.div>
  );
}

function DraggableCard({
  card,
  x,
  y,
  areaRef,
  busy,
  onFling,
}: {
  card: TriageCard;
  x: MotionValue<number>;
  y: MotionValue<number>;
  areaRef: React.RefObject<HTMLDivElement | null>;
  busy: React.RefObject<boolean>;
  onFling: (d: Decision, v: { x: number; y: number }) => void;
}) {
  const grabSign = useRef(1);
  const history = useRef<{ x: number; y: number; t: number }[]>([]);
  const origin = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const rotate = useTransform(x, (v) => (v / 22) * grabSign.current);
  const keepO = useTransform(x, [20, 120], [0, 1]);
  const dropO = useTransform(x, [-20, -120], [0, 1]);
  const hotO = useTransform(y, [-20, -120], [0, 1]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (busy.current || (e.target as HTMLElement).closest('a,button')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    x.stop();
    y.stop();
    // Interruption : on repart de la valeur présentée à l'écran, pas de la cible.
    origin.current = { px: e.clientX, py: e.clientY, x: x.get(), y: y.get() };
    const rect = e.currentTarget.getBoundingClientRect();
    grabSign.current = e.clientY - rect.top < rect.height / 2 ? 1 : -1;
    history.current = [{ x: e.clientX, y: e.clientY, t: e.timeStamp }];
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const o = origin.current;
    if (!o) return;
    const dx = e.clientX - o.px;
    const dy = e.clientY - o.py;
    x.set(o.x + dx);
    // Vertical libre vers le haut (chaud), résistance vers le bas.
    const ny = o.y + dy;
    y.set(ny > 0 ? rubberband(ny, 400) : ny);
    history.current.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
    if (history.current.length > 6) history.current.shift();
  }

  function onPointerUp() {
    const o = origin.current;
    origin.current = null;
    setDragging(false);
    if (!o) return;
    const h = history.current;
    const first = h[0]!;
    const last = h[h.length - 1]!;
    const dt = Math.max(1, last.t - first.t) / 1000;
    const v = { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt };
    const w = areaRef.current?.offsetWidth ?? 400;
    const px = x.get() + project(v.x);
    const py = y.get() + project(v.y);

    if (py < -220 && Math.abs(px) < w * THRESHOLD * 1.2) return onFling('hot', v);
    if (px > w * THRESHOLD) return onFling('kept', v);
    if (px < -w * THRESHOLD) return onFling('dropped', v);
    // Retour au centre en héritant de la vélocité du doigt.
    animate(x, 0, { ...spring.momentum, velocity: v.x });
    animate(y, 0, { ...spring.momentum, velocity: v.y });
  }

  return (
    <motion.div
      className={`${s.card} ${s.top} ${dragging ? s.grabbing : ''}`}
      style={{ x, y, rotate, zIndex: 20 }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      initial={{ scale: 0.955 }}
      animate={{ scale: 1 }}
      transition={spring.default}
    >
      <motion.span className={`${s.stamp} ${s.stampKeep}`} style={{ opacity: keepO }}>Garder</motion.span>
      <motion.span className={`${s.stamp} ${s.stampDrop}`} style={{ opacity: dropO }}>Jeter</motion.span>
      <motion.span className={`${s.stamp} ${s.stampHot}`} style={{ opacity: hotO }}>Chaud</motion.span>
      <CardBody card={card} />
    </motion.div>
  );
}

function CardBody({ card }: { card: TriageCard }) {
  const domain = host(card.website);
  return (
    <>
      <div className={s.preview}>
        {card.preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.preview} alt="" draggable={false} />
        ) : (
          <div className={s.noSite}>
            <Globe strokeWidth={1.4} />
            <span className="t-headline">{domain ? domain : 'Aucun site'}</span>
          </div>
        )}
      </div>
      <div className={s.body}>
        <div className={s.titleRow}>
          <div style={{ minWidth: 0 }}>
            <h2 className={s.name}>{card.name}</h2>
            <p className="t-sub c2">
              {card.sectorLabel}
              {card.city ? <> · <MapPin size={12} style={{ verticalAlign: '-1px' }} /> {card.city}</> : null}
            </p>
          </div>
          <div className={s.gauges}>
            <Gauge value={card.need} label="Besoin" size={58} />
            <Gauge value={card.pay} label="Capacité" size={58} />
          </div>
        </div>

        <ul className={s.reasons}>
          {card.reasons.slice(0, 4).map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>

        <div className={s.meta}>
          {card.rating !== null ? (
            <span><Star size={13} fill="var(--yellow)" color="var(--yellow)" /> {card.rating.toString().replace('.', ',')} <span className="c3">({card.reviews})</span></span>
          ) : null}
          {card.since ? <span><Building2 size={13} /> {card.since}</span> : null}
          {card.employees ? <span>{card.employees}</span> : null}
          {domain ? <span className={s.domain}>{domain}</span> : null}
          {card.unverified ? <Badge tone="orange">SIREN non trouvé</Badge> : null}
        </div>
      </div>
    </>
  );
}

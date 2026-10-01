'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import { CalendarClock, Eye, Globe } from 'lucide-react';
import { STATUSES, type Status } from '@ph/core';
import { Button, Sheet, fieldClass, useToast } from '@/components/ui';
import { setStatus } from '@/app/(app)/actions';
import { relative } from '@/lib/format';
import { spring } from '@/lib/motion';
import s from './board.module.css';

export type BoardCard = {
  id: string;
  name: string;
  city: string | null;
  status: Status;
  need: number;
  pay: number;
  nextAt: string | null;
  hasSite: boolean;
  views: number;
};

const COLUMNS = STATUSES.filter((x) => x.key !== 'perdu');

export function Board({ cards }: { cards: BoardCard[] }) {
  const toast = useToast();
  const [items, setItems] = useState(cards);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<Status | 'perdu' | null>(null);
  const [lostFor, setLostFor] = useState<BoardCard | null>(null);
  const [reason, setReason] = useState('');
  const [, start] = useTransition();
  const scroller = useRef<HTMLDivElement>(null);

  const byStatus = useMemo(() => {
    const m = new Map<string, BoardCard[]>();
    for (const c of items) m.set(c.status, [...(m.get(c.status) ?? []), c]);
    return m;
  }, [items]);

  const columnAt = (x: number, y: number): Status | 'perdu' | null => {
    for (const el of document.elementsFromPoint(x, y)) {
      const st = (el as HTMLElement).dataset?.status;
      if (st) return st as Status;
    }
    return null;
  };

  const move = (card: BoardCard, to: Status) => {
    if (card.status === to) return;
    setItems((list) => list.map((c) => (c.id === card.id ? { ...c, status: to } : c)));
    start(() => setStatus(card.id, to));
    toast({
      text: `${card.name} → ${STATUSES.find((x) => x.key === to)!.label}`,
      action: {
        label: 'Annuler',
        run: () => {
          setItems((list) => list.map((c) => (c.id === card.id ? { ...c, status: card.status } : c)));
          start(() => setStatus(card.id, card.status));
        },
      },
    });
  };

  return (
    <LayoutGroup>
      <div className={s.board} ref={scroller}>
        {COLUMNS.map((col) => {
          const list = byStatus.get(col.key) ?? [];
          return (
            <section key={col.key} className={`${s.column} ${over === col.key ? s.over : ''}`} data-status={col.key} aria-label={col.label}>
              <header className={s.colHead}>
                <span className="t-headline">{col.label}</span>
                <span className="t-foot c2 num">{list.length}</span>
              </header>
              <div className={s.cards}>
                <AnimatePresence initial={false}>
                  {list.map((c) => (
                    <motion.div
                      key={c.id}
                      layout
                      layoutId={c.id}
                      className={s.card}
                      style={{ zIndex: dragging === c.id ? 50 : 1 }}
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: dragging === c.id ? 1.03 : 1, boxShadow: dragging === c.id ? 'var(--shadow-3)' : 'var(--shadow-1)' }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={spring.layout}
                      drag
                      dragSnapToOrigin
                      dragElastic={0.9}
                      dragMomentum={false}
                      onDragStart={() => setDragging(c.id)}
                      onDrag={(_, info) => setOver(columnAt(info.point.x - window.scrollX, info.point.y - window.scrollY))}
                      onDragEnd={(_, info) => {
                        const to = columnAt(info.point.x - window.scrollX, info.point.y - window.scrollY);
                        setDragging(null);
                        setOver(null);
                        if (to === 'perdu') setLostFor(c);
                        else if (to) move(c, to);
                      }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Link href={`/prospects/${c.id}`} className={s.cardLink} draggable={false} onClick={(e) => dragging && e.preventDefault()}>
                        <span className={s.name}>{c.name}</span>
                        <span className="t-foot c2">{c.city}</span>
                        <span className={s.meta}>
                          <span className={s.score} style={{ '--v': c.need } as React.CSSProperties}>{c.need}</span>
                          <span className={s.score} style={{ '--v': c.pay } as React.CSSProperties}>{c.pay}</span>
                          {c.hasSite ? <Globe size={13} color="var(--accent)" /> : null}
                          {c.views ? <span className={s.views}><Eye size={12} />{c.views}</span> : null}
                          {c.nextAt ? (
                            <span className={`${s.next} ${new Date(c.nextAt) < new Date() ? s.late : ''}`}>
                              <CalendarClock size={12} />{relative(c.nextAt)}
                            </span>
                          ) : null}
                        </span>
                      </Link>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </section>
          );
        })}
      </div>

      <AnimatePresence>
        {dragging ? (
          <motion.div
            className={`${s.lostZone} ${over === 'perdu' ? s.lostOver : ''}`}
            data-status="perdu"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={spring.default}
          >
            Perdu
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Sheet open={!!lostFor} onClose={() => setLostFor(null)} label="Raison">
        <p className="t-headline" style={{ marginBottom: 12 }}>{lostFor?.name}</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className={fieldClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Raison" autoFocus aria-label="Raison" />
          <Button
            variant="danger"
            disabled={!reason.trim()}
            onClick={() => {
              const c = lostFor!;
              setItems((list) => list.filter((x) => x.id !== c.id));
              start(() => setStatus(c.id, 'perdu', reason));
              setLostFor(null);
              setReason('');
            }}
          >
            Perdu
          </Button>
        </div>
      </Sheet>
    </LayoutGroup>
  );
}

'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, CornerDownLeft } from 'lucide-react';
import { NAV } from './nav';
import { spring } from '@/lib/motion';
import s from './shell.module.css';

type Item = { id: string; label: string; hint?: string; href: string; kind: 'nav' | 'prospect' };

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const [remote, setRemote] = useState<Item[]>([]);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setSel(0);
      requestAnimationFrame(() => input.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setRemote([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (!r.ok) return;
        const rows: { id: string; name: string; city: string | null; status: string }[] = await r.json();
        setRemote(rows.map((p) => ({ id: p.id, label: p.name, hint: p.city ?? '', href: `/prospects/${p.id}`, kind: 'prospect' })));
      } catch {
        /* requête annulée */
      }
    }, 120);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const items = useMemo<Item[]>(() => {
    const needle = q.trim().toLowerCase();
    const nav = NAV.filter((n) => !needle || n.label.toLowerCase().includes(needle)).map((n) => ({
      id: n.href,
      label: n.label,
      hint: n.key,
      href: n.href,
      kind: 'nav' as const,
    }));
    return [...remote, ...nav];
  }, [q, remote]);

  useEffect(() => setSel(0), [items.length]);

  const go = (it: Item | undefined) => {
    if (!it) return;
    onClose();
    router.push(it.href);
  };

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div className={s.paletteScrim} onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={spring.snappy} />
          <motion.div
            className={s.palette}
            role="dialog"
            aria-modal="true"
            aria-label="Rechercher"
            style={{ x: '-50%' }}
            initial={{ opacity: 0, scale: 0.97, filter: 'blur(8px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.98, filter: 'blur(8px)' }}
            transition={spring.snappy}
          >
            <input
              ref={input}
              className={s.paletteInput}
              placeholder="Entreprise, écran…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setSel((v) => Math.min(items.length - 1, v + 1)); }
                if (e.key === 'ArrowUp') { e.preventDefault(); setSel((v) => Math.max(0, v - 1)); }
                if (e.key === 'Enter') go(items[sel]);
                if (e.key === 'Escape') onClose();
              }}
              aria-activedescendant={items[sel] ? `cmd-${items[sel].id}` : undefined}
            />
            <div className={s.paletteList} role="listbox">
              {items.map((it, i) => {
                const Icon = it.kind === 'nav' ? NAV.find((n) => n.href === it.href)!.icon : Building2;
                return (
                  <div
                    key={it.id}
                    id={`cmd-${it.id}`}
                    role="option"
                    aria-selected={i === sel}
                    className={`${s.paletteItem} ${i === sel ? s.paletteItemOn : ''}`}
                    onPointerMove={() => setSel(i)}
                    onPointerDown={() => go(it)}
                  >
                    <Icon />
                    <span>{it.label}</span>
                    <small>{i === sel ? <CornerDownLeft size={13} /> : it.hint}</small>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

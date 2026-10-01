'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { useEffect, useState, type ReactNode } from 'react';
import { Ellipsis, Search } from 'lucide-react';
import { NAV, MOBILE_TABS } from './nav';
import { CommandPalette } from './CommandPalette';
import { ToastProvider, Sheet, Group, Row, Kbd } from '@/components/ui';
import { spring } from '@/lib/motion';
import s from './shell.module.css';

export type ShellCounts = Partial<Record<string, number>>;

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
}

export function Shell({ children, counts }: { children: ReactNode; counts: ShellCounts }) {
  const pathname = usePathname();
  const router = useRouter();
  const [palette, setPalette] = useState(false);
  const [more, setMore] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((v) => !v);
        return;
      }
      if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      const item = NAV.find((n) => n.key === e.key);
      if (item) {
        e.preventDefault();
        router.push(item.href);
      }
      if (e.key === '/') {
        e.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <ToastProvider>
      <div className={s.app}>
        <nav className={s.sidebar} aria-label="Navigation principale">
          <div className={s.brand}>
            <span className={s.logoSlot} aria-hidden />
            <span className={s.wordmark}>placeHolder</span>
          </div>
          {NAV.map((n) => {
            const on = active(n.href);
            return (
              <Link key={n.href} href={n.href} className={`${s.navLink} ${on ? s.navActive : ''}`} aria-current={on ? 'page' : undefined}>
                {on ? <motion.span layoutId="nav-pill" className={s.navPill} transition={spring.snappy} /> : null}
                <n.icon />
                <span>{n.label}</span>
                {counts[n.href] ? <span className={s.navCount}>{counts[n.href]}</span> : null}
              </Link>
            );
          })}
          <div className={s.sidebarFoot}>
            <button type="button" onClick={() => setPalette(true)}>
              <Search size={15} /><span>Rechercher</span><Kbd>⌘K</Kbd>
            </button>
          </div>
        </nav>

        <main className={s.main}>{children}</main>

        <nav className={s.tabbar} aria-label="Onglets">
          {NAV.filter((n) => MOBILE_TABS.includes(n.href)).map((n) => (
            <Link key={n.href} href={n.href} className={`${s.tab} ${active(n.href) ? s.tabOn : ''}`}>
              <n.icon />
              {n.label}
            </Link>
          ))}
          <button type="button" className={s.tab} onClick={() => setMore(true)}>
            <Ellipsis />
            Plus
          </button>
        </nav>

        <Sheet open={more} onClose={() => setMore(false)} label="Plus">
          <Group>
            {NAV.filter((n) => !MOBILE_TABS.includes(n.href)).map((n) => (
              <Row key={n.href} onClick={() => { setMore(false); router.push(n.href); }}>
                <n.icon size={20} color="var(--accent)" />
                <span style={{ flex: 1 }}>{n.label}</span>
              </Row>
            ))}
          </Group>
        </Sheet>

        <CommandPalette open={palette} onClose={() => setPalette(false)} />
      </div>
    </ToastProvider>
  );
}

export function PageHeader({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <header className={s.header}>
      <div className={s.headerTitle}>
        <h1>{title}</h1>
        {sub ? <p className="num">{sub}</p> : null}
      </div>
      {actions ? <div className={s.headerActions}>{actions}</div> : null}
    </header>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <div className={s.page}>{children}</div>;
}

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Ellipsis, Search } from 'lucide-react';
import type { NavItem } from './nav';
import { NAV, MOBILE_TABS, SECTIONS, SETTINGS } from './nav';
import { CommandPalette } from './CommandPalette';
import { ToastProvider, Sheet, Group, Row, Kbd } from '@/components/ui';
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
          <div className={s.brand}>placeHolder</div>
          <button type="button" className={s.search} onClick={() => setPalette(true)}>
            <Search size={15} />
            <span>Rechercher</span>
            <Kbd>⌘K</Kbd>
          </button>
          {SECTIONS.map((sec) => (
            <div key={sec.title} className={s.section}>
              <p className={s.sectionTitle}>{sec.title}</p>
              {sec.items.map((n) => (
                <NavLink key={n.href} item={n} on={active(n.href)} count={counts[n.href]} />
              ))}
            </div>
          ))}
          <div className={s.sidebarFoot}>
            <NavLink item={SETTINGS} on={active(SETTINGS.href)} />
          </div>
        </nav>

        <main className={s.main}>{children}</main>

        <nav className={s.tabbar} aria-label="Onglets">
          {NAV.filter((n) => MOBILE_TABS.includes(n.href)).map((n) => (
            <Link key={n.href} href={n.href} prefetch className={`${s.tab} ${active(n.href) ? s.tabOn : ''}`}>
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
                <span className={s.tile} style={{ background: n.tint }}><n.icon /></span>
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

function NavLink({ item, on, count }: { item: NavItem; on: boolean; count?: number }) {
  return (
    <Link href={item.href} prefetch className={`${s.navLink} ${on ? s.navActive : ''}`} aria-current={on ? 'page' : undefined}>
      <span className={s.tile} style={{ background: item.tint }}>
        <item.icon />
      </span>
      <span className={s.navLabel}>{item.label}</span>
      {count ? <span className={s.navCount}>{count}</span> : null}
    </Link>
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

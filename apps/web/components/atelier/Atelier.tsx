'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { TerminalSquare, RefreshCw, Upload, ExternalLink, Wand2, GitBranch, Check, X, MessageSquareWarning, Mail } from 'lucide-react';
import { Button, Group, Row, Segmented, Badge, Empty, Kbd, fieldClass, useToast } from '@/components/ui';
import { createSiteAction, pushBriefAction, redeployAction, setFormEmail } from '@/app/(app)/site-actions';
import { relative } from '@/lib/format';
import { spring } from '@/lib/motion';
import s from './atelier.module.css';

type Quality = {
  passed?: boolean;
  deploy?: string;
  lighthouse?: { performance: number; accessibility: number; bestPractices: number; seo: number } | null;
  axe?: string[] | null;
  slop?: string[];
  legal?: string[];
  links?: string[];
  todo?: number;
};
type Version = { id: string; sha: string; message: string | null; url: string | null; quality: Quality | null; created_at: string };

function Frame({ url, width, height, label }: { url: string; width: number; height: number; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(Math.min(1, e!.contentRect.width / width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={box} className={s.frameBox} style={{ aspectRatio: `${width} / ${height}` }}>
      <iframe
        title={label}
        src={url}
        className={s.frame}
        style={{ width, height, transform: `scale(${scale})` }}
        sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
        loading="lazy"
      />
    </div>
  );
}

function Score({ v, label }: { v: number; label: string }) {
  const tone = v >= 95 ? 'var(--green)' : v >= 80 ? 'var(--orange)' : 'var(--red)';
  return (
    <span className={s.score} title={label}>
      <span style={{ color: tone }} className="num">{v}</span>
      <small>{label}</small>
    </span>
  );
}

export function Atelier({
  prospect,
  site,
  versions,
  changes,
  ready,
}: {
  prospect: { id: string; name: string; slug: string | null; email: string | null; hasBrand: boolean };
  site: { previewUrl: string | null; repo: string; mode: string; domain: string | null; formEmail: string | null } | null;
  versions: Version[];
  changes: { message: string | null; at: string }[];
  ready: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [view, setView] = useState<'both' | 'mobile' | 'desktop'>('both');
  const [pending, start] = useTransition();
  const [nonce, setNonce] = useState(0);
  const [email, setEmail] = useState(site?.formEmail ?? prospect.email ?? '');
  const last = versions[0];
  const command = `ph site ${prospect.slug}`;

  // Rafraîchissement auto tant qu'un déploiement est attendu.
  useEffect(() => {
    if (!site) return;
    const t = setInterval(() => router.refresh(), 15_000);
    return () => clearInterval(t);
  }, [site, router]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) =>
    start(async () => {
      const r = await fn();
      toast({ text: r.ok ? done : r.error ?? 'Erreur' });
      router.refresh();
    });

  if (!site) {
    return (
      <Empty
        icon={<Wand2 />}
        title="Pas encore de site"
        action={
          <Button variant="primary" size="lg" disabled={!ready || pending || !prospect.slug} onClick={() => run(() => createSiteAction(prospect.id), 'Site créé')}>
            {pending ? 'Création…' : 'Créer le site'}
          </Button>
        }
      />
    );
  }

  const url = site.previewUrl ? `${site.previewUrl}?v=${nonce}${last?.sha ?? ''}` : null;

  return (
    <div className={s.layout}>
      <section className={s.previewCol}>
        <div className={s.toolbar}>
          <Segmented label="Affichage" value={view} onChange={setView} options={[{ value: 'both', label: 'Les deux' }, { value: 'mobile', label: 'Mobile' }, { value: 'desktop', label: 'Ordinateur' }]} />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button icon aria-label="Recharger" onClick={() => setNonce((n) => n + 1)}><RefreshCw /></Button>
            {site.previewUrl ? <Button icon aria-label="Ouvrir" onClick={() => window.open(site.previewUrl!, '_blank')}><ExternalLink /></Button> : null}
          </div>
        </div>
        {url && last?.url ? (
          <motion.div layout className={`${s.frames} ${s[view]}`} transition={spring.layout}>
            <AnimatePresence initial={false}>
              {view !== 'desktop' ? (
                <motion.div key="m" layout className={s.mobile} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={spring.default}>
                  <Frame url={url} width={390} height={844} label="Aperçu mobile" />
                </motion.div>
              ) : null}
              {view !== 'mobile' ? (
                <motion.div key="d" layout className={s.desktop} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={spring.default}>
                  <Frame url={url} width={1440} height={900} label="Aperçu ordinateur" />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        ) : (
          <div className={s.waiting}>
            <motion.span className={s.pulse} animate={{ opacity: [0.35, 1, 0.35] }} transition={{ repeat: Infinity, duration: 1.8 }} />
            <span className="t-sub c2">En attente du premier déploiement</span>
          </div>
        )}
      </section>

      <aside className={s.side}>
        <Group title="Claude Code">
          <Row>
            <TerminalSquare size={18} color="var(--purple)" />
            <code className="t-mono t-sub" style={{ flex: 1 }}>{command}</code>
            <Button size="sm" variant="primary" onClick={() => { navigator.clipboard.writeText(command); toast({ text: 'Commande copiée' }); }}>Copier</Button>
          </Row>
          <Row>
            <span className="t-foot c2" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <Kbd>/brand</Kbd><Kbd>/directions</Kbd><Kbd>/build</Kbd><Kbd>/humanize</Kbd><Kbd>/audit</Kbd><Kbd>/ship</Kbd>
            </span>
          </Row>
          {!prospect.hasBrand ? <Row><span className="t-foot c2">ADN non généré dans l’outil : <Kbd>/brand</Kbd> le fera.</span></Row> : null}
        </Group>

        {changes.length ? (
          <Group title={<><MessageSquareWarning size={13} /> Demandes du client</>}>
            {changes.map((c, i) => (
              <Row key={i}><span className="t-sub" style={{ flex: 1 }}>{c.message}</span><span className="t-foot c3">{relative(c.at)}</span></Row>
            ))}
          </Group>
        ) : null}

        {last?.quality ? (
          <Group title="Qualité">
            {last.quality.lighthouse ? (
              <Row>
                <div className={s.scores}>
                  <Score v={last.quality.lighthouse.performance} label="Perf" />
                  <Score v={last.quality.lighthouse.accessibility} label="Access." />
                  <Score v={last.quality.lighthouse.bestPractices} label="Pratiques" />
                  <Score v={last.quality.lighthouse.seo} label="SEO" />
                </div>
              </Row>
            ) : null}
            <Row label="Anti-slop" value={last.quality.slop?.length ? <Badge tone="red">{last.quality.slop.length}</Badge> : <Check size={16} color="var(--green)" />} />
            <Row label="Légal" value={last.quality.legal?.length ? <Badge tone="red">{last.quality.legal.length}</Badge> : <Check size={16} color="var(--green)" />} />
            <Row label="Accessibilité" value={last.quality.axe?.length ? <Badge tone="red">{last.quality.axe.length}</Badge> : <Check size={16} color="var(--green)" />} />
            <Row label="Liens" value={last.quality.links?.length ? <Badge tone="red">{last.quality.links.length}</Badge> : <Check size={16} color="var(--green)" />} />
            <Row label="À compléter" value={last.quality.todo ? <Badge tone="orange">{last.quality.todo}</Badge> : <Check size={16} color="var(--green)" />} />
          </Group>
        ) : null}

        <Group title="Formulaire">
          <form className={s.inline} onSubmit={(e) => { e.preventDefault(); run(() => setFormEmail(prospect.id, email), 'Email enregistré'); }}>
            <Mail size={16} color="var(--label-2)" />
            <input className={fieldClass} type="email" placeholder="Email du client" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email du client" />
            <Button type="submit" size="sm" disabled={pending}>OK</Button>
          </form>
        </Group>

        <Group title="Versions">
          {versions.length ? (
            versions.map((v) => (
              <Row key={v.id}>
                {v.quality?.deploy === 'failure' ? <X size={15} color="var(--red)" /> : v.quality?.passed ? <Check size={15} color="var(--green)" /> : <span className={s.dot} />}
                <span className="t-sub" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.message}</span>
                <code className="t-mono t-foot c3">{v.sha.slice(0, 7)}</code>
                <span className="t-foot c3">{relative(v.created_at)}</span>
              </Row>
            ))
          ) : (
            <Row><span className="t-foot c2">Aucune version</span></Row>
          )}
        </Group>

        <div className={s.actions}>
          <Button disabled={pending} onClick={() => run(() => pushBriefAction(prospect.id), 'Brief poussé')}><Upload />Repousser le brief</Button>
          <Button disabled={pending} onClick={() => run(() => redeployAction(prospect.id), 'Déploiement lancé')}><RefreshCw />Redéployer</Button>
          <Button variant="plain" onClick={() => window.open(site.repo, '_blank')}><GitBranch />Repo</Button>
        </div>
      </aside>
    </div>
  );
}

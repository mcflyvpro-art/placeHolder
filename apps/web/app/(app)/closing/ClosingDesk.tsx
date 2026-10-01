'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Copy, Check, Globe, CreditCard, Search, ShieldCheck, Send, Repeat, PackageCheck } from 'lucide-react';
import { OFFER_LABEL, type OfferKind, type Status } from '@ph/core';
import { Button, Group, Row, Badge, Sheet, fieldClass, useToast } from '@/components/ui';
import type { Effective } from '@/lib/offers';
import { euro, dateFr } from '@/lib/format';
import { spring } from '@/lib/motion';
import {
  createQuoteAction,
  balanceLinkAction,
  subscriptionLinkAction,
  checkDomainAction,
  registerDomainAction,
  connectDomainAction,
  transferRepoAction,
  documentUrl,
} from '../closing-actions';
import s from './closing.module.css';

type Quote = { id: string; number: string; offer: OfferKind; total: number; monthly: number | null; status: string; sign_token: string; created_at: string; signature: { name?: string } | null };
type Invoice = { id: string; number: string; total: number; kind: string; paid_at: string | null; status: string };

export function ClosingDesk({
  prospect,
  offers,
  quotes,
  invoices,
  site,
  domains,
  subscriptions,
  ready,
}: {
  prospect: { id: string; name: string; status: Status; email: string | null; phone: string | null; address: string | null; postalCode: string | null; city: string | null; firstName: string; lastName: string };
  offers: Effective | null;
  quotes: Quote[];
  invoices: Invoice[];
  site: { previewUrl: string | null; domain: string | null; mode: string } | null;
  domains: { name: string; status: string }[];
  subscriptions: { monthly: number; status: string; unpaid_since: string | null }[];
  ready: { company: boolean; stripe: boolean; porkbun: boolean; cloudflare: boolean; github: boolean };
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [link, setLink] = useState<{ title: string; url: string; qr?: string } | null>(null);
  const [domain, setDomain] = useState('');
  const [check, setCheck] = useState<{ available: boolean; price: number; renewal: number | null; balance: number | null; sufficient: boolean | null } | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [forward, setForward] = useState(prospect.email ?? '');
  const [ghUser, setGhUser] = useState('');
  const [contact, setContact] = useState({
    firstName: prospect.firstName,
    lastName: prospect.lastName,
    organization: prospect.name,
    address1: prospect.address?.split(',')[0] ?? '',
    city: prospect.city ?? '',
    postalCode: prospect.postalCode ?? '',
    phone: (prospect.phone ?? '').replace(/\D/g, '').replace(/^0/, ''),
    email: prospect.email ?? '',
  });

  const signed = quotes.find((q) => q.status === 'signed');
  const copy = (url: string) => { navigator.clipboard.writeText(url); toast({ text: 'Lien copié' }); };
  const open = async (kind: 'quotes' | 'invoices', id: string) => {
    const url = await documentUrl(kind, id);
    if (url) window.open(url, '_blank');
  };

  const offerRows: { kind: OfferKind; main: string; sub: string }[] = offers
    ? [
        { kind: 'oneOff', main: euro(offers.oneOff), sub: 'Tout transféré' },
        { kind: 'hybrid', main: euro(offers.setup), sub: `+ ${euro(offers.hybridMonthly)}/mois · 12 mois` },
        { kind: 'subscription', main: `${euro(offers.subMonthly)}/mois`, sub: '12 mois' },
      ]
    : [];

  return (
    <div className={s.desk}>
      <Group title={<><FileText size={13} /> Devis</>}>
        {offers ? (
          <div className={s.offers}>
            {offerRows.map((o) => (
              <button
                key={o.kind}
                type="button"
                className={s.offer}
                disabled={!ready.company || pending}
                onClick={() =>
                  start(async () => {
                    const r = await createQuoteAction(prospect.id, o.kind);
                    if (!r.ok) return toast({ text: r.error });
                    setLink({ title: `Devis ${r.number}`, url: r.signUrl, qr: r.qr });
                    router.refresh();
                  })
                }
              >
                <span className="t-caption c2">{OFFER_LABEL[o.kind]}</span>
                <span className={s.price}>{o.main}</span>
                <span className="t-foot c2 num">{o.sub}</span>
              </button>
            ))}
          </div>
        ) : (
          <Row><span className="t-sub c2">Définissez les prix dans la fiche du prospect.</span></Row>
        )}
        {quotes.map((q) => (
          <Row key={q.id}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <b className="num">{q.number}</b> <span className="c2 t-foot">· {OFFER_LABEL[q.offer]} · {dateFr(q.created_at)}</span>
            </span>
            {q.status === 'signed' ? <Badge tone="green"><Check size={11} />Signé</Badge> : <Badge>{q.status === 'sent' ? 'Envoyé' : q.status}</Badge>}
            <Button size="sm" icon aria-label="PDF" onClick={() => open('quotes', q.id)}><FileText /></Button>
            <Button size="sm" icon aria-label="Lien de signature" onClick={() => copy(`${location.origin}/signer/${q.sign_token}`)}><Copy /></Button>
          </Row>
        ))}
      </Group>

      <Group title={<><CreditCard size={13} /> Paiements</>}>
        {!ready.stripe ? <Row><span className="t-sub c2">Stripe non configuré (Réglages).</span></Row> : null}
        {signed && ready.stripe ? (
          <div className={s.inline}>
            {signed.offer !== 'subscription' ? (
              <Button disabled={pending} onClick={() => start(async () => { const r = await balanceLinkAction(signed.id); if (r.ok) setLink({ title: 'Paiement du solde', url: r.url }); else toast({ text: r.error }); })}>
                <Send />Lien du solde
              </Button>
            ) : null}
            {signed.offer === 'hybrid' ? (
              <Button disabled={pending} onClick={() => start(async () => { const r = await subscriptionLinkAction(signed.id); if (r.ok) setLink({ title: 'Activation de l’abonnement', url: r.url }); else toast({ text: r.error }); })}>
                <Repeat />Lien d’abonnement
              </Button>
            ) : null}
          </div>
        ) : null}
        {subscriptions.map((x, i) => (
          <Row key={i} label={`Abonnement ${euro(Number(x.monthly))}/mois`} value={x.unpaid_since ? <Badge tone="red">Impayé</Badge> : <Badge tone="green">{x.status === 'active' ? 'Actif' : x.status}</Badge>} />
        ))}
        {invoices.map((f) => (
          <Row key={f.id}>
            <span style={{ flex: 1 }}><b className="num">{f.number}</b> <span className="c2 t-foot">· {euro(Number(f.total), 2)} · {f.paid_at ? `payée ${dateFr(f.paid_at)}` : 'à payer'}</span></span>
            <Button size="sm" icon aria-label="PDF" onClick={() => open('invoices', f.id)}><FileText /></Button>
          </Row>
        ))}
      </Group>

      <Group title={<><Globe size={13} /> Domaine et mise en ligne</>}>
        {site?.mode === 'production' ? (
          <Row label="En ligne" value={<a href={`https://${site.domain}`} target="_blank" rel="noreferrer">{site.domain}</a>} />
        ) : null}
        {domains.map((d) => <Row key={d.name} label={d.name} value={<Badge tone={d.status === 'live' ? 'green' : undefined}>{d.status === 'live' ? 'Branché' : 'Enregistré'}</Badge>} />)}
        <form
          className={s.inline}
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await checkDomainAction(domain);
              if (r.ok) setCheck(r);
              else toast({ text: r.error });
            });
          }}
        >
          <input className={fieldClass} style={{ flex: 1, minWidth: 180 }} placeholder="plomberie-martin.fr" value={domain} onChange={(e) => { setDomain(e.target.value); setCheck(null); }} aria-label="Nom de domaine" />
          <Button type="submit" disabled={!ready.porkbun || pending || !domain}><Search />Vérifier</Button>
        </form>
        <AnimatePresence>
          {check ? (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={spring.default}>
              {check.available ? (
                <>
                  <Row label="Disponible" value={<span className="num">{check.price.toFixed(2)} $ puis {check.renewal?.toFixed(2) ?? '—'} $/an</span>} />
                  {check.sufficient === false ? <Row><span className="t-foot" style={{ color: 'var(--orange)' }}>Crédit Porkbun insuffisant ({check.balance?.toFixed(2)} $) : rechargez votre compte Porkbun.</span></Row> : null}
                  <div className={s.inline}><Button variant="primary" disabled={check.sufficient === false} onClick={() => setBuyOpen(true)}><ShieldCheck />Acheter au nom du client</Button></div>
                </>
              ) : (
                <Row label="Déjà pris" value={<span className="t-foot c2">Le client le possède ? Branchez-le ci-dessous.</span>} />
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
        <div className={s.inline}>
          <input className={fieldClass} style={{ flex: 1, minWidth: 180 }} type="email" placeholder="contact@ redirigé vers…" value={forward} onChange={(e) => setForward(e.target.value)} aria-label="Redirection email" />
          <Button
            disabled={!ready.cloudflare || !site || pending || !domain}
            onClick={() =>
              start(async () => {
                const r = await connectDomainAction(prospect.id, domain, forward || null);
                if (!r.ok) return toast({ text: r.error });
                setLink({ title: `Serveurs DNS à déclarer chez le registrar si le domaine n’a pas été acheté ici : ${r.nameservers.join(' · ')}`, url: `https://${domain}` });
                router.refresh();
              })
            }
          >
            <Globe />Brancher et mettre en ligne
          </Button>
        </div>
      </Group>

      <Group title={<><PackageCheck size={13} /> Remise</>}>
        <ol className={s.steps}>
          <li>Vérifier HTTPS sur le domaine et le formulaire de contact (envoyer un test).</li>
          <li>Soumettre <code>https://{site?.domain ?? 'domaine'}/sitemap-index.xml</code> dans Google Search Console (compte du client).</li>
          <li>Ajouter l’adresse du site sur la fiche Google du client.</li>
          <li>Le client confirme l’email de redirection reçu de Cloudflare.</li>
        </ol>
        {signed?.offer === 'oneOff' ? (
          <div className={s.inline}>
            <input className={fieldClass} style={{ flex: 1 }} placeholder="Compte GitHub du client" value={ghUser} onChange={(e) => setGhUser(e.target.value)} aria-label="Compte GitHub du client" />
            <Button disabled={!ghUser || pending} onClick={() => start(async () => { const r = await transferRepoAction(prospect.id, ghUser); toast({ text: r.ok ? 'Transfert demandé' : r.error }); })}>Transférer le code</Button>
          </div>
        ) : null}
      </Group>

      <Sheet open={!!link} onClose={() => setLink(null)} label="Lien">
        {link ? (
          <div className={s.linkBox}>
            <p className="t-headline" style={{ textAlign: 'center' }}>{link.title}</p>
            {link.qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={link.qr} alt="QR code" width={170} height={170} style={{ background: '#fff', padding: 8, borderRadius: 12 }} />
            ) : null}
            <code className="t-mono t-foot" style={{ wordBreak: 'break-all', textAlign: 'center' }}>{link.url}</code>
            <Button variant="primary" size="lg" onClick={() => copy(link.url)}><Copy />Copier</Button>
          </div>
        ) : null}
      </Sheet>

      <Sheet open={buyOpen} onClose={() => setBuyOpen(false)} label="Acheter le domaine">
        <p className="t-headline">Acheter {domain}</p>
        <p className="t-sub c2" style={{ margin: '6px 0 14px' }}>Débité de votre crédit Porkbun : {check?.price.toFixed(2)} $. Titulaire : le client.</p>
        <div className={s.grid2} style={{ padding: 0 }}>
          {(['firstName', 'lastName', 'organization', 'address1', 'postalCode', 'city', 'phone', 'email'] as const).map((k) => (
            <input key={k} className={fieldClass} value={contact[k]} onChange={(e) => setContact({ ...contact, [k]: e.target.value })} placeholder={{ firstName: 'Prénom', lastName: 'Nom', organization: 'Société', address1: 'Adresse', postalCode: 'Code postal', city: 'Ville', phone: 'Téléphone (sans 0)', email: 'Email' }[k]} aria-label={k} />
          ))}
        </div>
        <p className="t-foot c2" style={{ margin: '14px 0 6px' }}>Tapez le nom du domaine pour confirmer l’achat</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className={fieldClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={domain} aria-label="Confirmation" />
          <Button
            variant="primary"
            disabled={confirm.trim().toLowerCase() !== domain.trim().toLowerCase() || pending || !contact.email}
            onClick={() =>
              start(async () => {
                const r = await registerDomainAction(prospect.id, domain, confirm, { ...contact, country: 'FR', phoneCountryCode: '33' });
                toast({ text: r.ok ? 'Domaine acheté' : r.error });
                if (r.ok) { setBuyOpen(false); router.refresh(); }
              })
            }
          >
            Acheter
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

import Link from 'next/link';
import { CalendarClock, Eye, MessageSquareWarning, PenTool, AlertTriangle, Layers, Flame } from 'lucide-react';
import { requireOwner } from '@/lib/auth';
import { PageHeader, Page } from '@/components/shell/Shell';
import { Group, Row, Empty, Badge } from '@/components/ui';
import { CallButton } from '@/components/prospect/CallSheet';
import { euro, relative } from '@/lib/format';
import s from './today.module.css';

export const metadata = { title: 'Aujourd’hui' };

export default async function TodayPage() {
  const sb = await requireOwner();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const twoDays = new Date(Date.now() - 48 * 3600e3).toISOString();

  const [due, hot, views, changes, building, unpaid, paid, subs, pending] = await Promise.all([
    sb.from('ph_prospects').select('id, name, city, phone, next_action_at').lte('next_action_at', new Date(Date.now() + 12 * 3600e3).toISOString()).not('status', 'in', '(perdu,en_ligne,abonnement_actif)').order('next_action_at').limit(30),
    sb.from('ph_prospects').select('id, name, city, phone').eq('triage', 'hot').eq('status', 'a_appeler').limit(20),
    sb.from('ph_share_events').select('created_at, device, share_links:ph_share_links!inner(prospect_id, prospects:ph_prospects!inner(id, name, phone))').eq('kind', 'view').gte('created_at', twoDays).order('created_at', { ascending: false }).limit(20),
    sb.from('ph_share_events').select('created_at, message, kind, share_links:ph_share_links!inner(prospect_id, prospects:ph_prospects!inner(id, name))').in('kind', ['change_request', 'like']).gte('created_at', new Date(Date.now() - 14 * 864e5).toISOString()).order('created_at', { ascending: false }).limit(20),
    sb.from('ph_prospects').select('id, name, city').eq('status', 'maquette_en_cours').limit(20),
    sb.from('ph_subscriptions').select('id, monthly, unpaid_since, prospects:ph_prospects(id, name)').not('unpaid_since', 'is', null),
    sb.from('ph_invoices').select('total').gte('paid_at', monthStart),
    sb.from('ph_subscriptions').select('monthly').eq('status', 'active'),
    sb.from('ph_prospects').select('id', { count: 'exact', head: true }).eq('triage', 'pending'),
  ]);

  const revenue = (paid.data ?? []).reduce((a, r) => a + Number(r.total), 0);
  const mrr = (subs.data ?? []).reduce((a, r) => a + Number(r.monthly), 0);

  type Joined = { share_links: { prospects: { id: string; name: string; phone?: string | null } } };
  const viewRows = (views.data ?? []) as unknown as (Joined & { created_at: string; device: string | null })[];
  const changeRows = (changes.data ?? []) as unknown as (Joined & { created_at: string; message: string | null; kind: string })[];
  const seen = new Set<string>();
  const uniqueViews = viewRows.filter((v) => {
    const id = v.share_links.prospects.id;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  const nothing = !due.data?.length && !hot.data?.length && !uniqueViews.length && !changeRows.length && !building.data?.length;

  return (
    <>
      <PageHeader title="Aujourd’hui" sub={new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(now)} />
      <Page>
        <div className={s.kpis}>
          <Kpi label="Encaissé ce mois" value={euro(revenue)} />
          <Kpi label="Récurrent" value={`${euro(mrr)}/mois`} />
          <Link href="/triage" className={s.kpiLink}><Kpi label="À trier" value={String(pending.count ?? 0)} /></Link>
        </div>

        <div className={s.grid}>
          {hot.data?.length ? (
            <Group title={<><Flame size={13} color="var(--orange)" /> Chauds</>}>
              {hot.data.map((p) => (
                <Row key={p.id}>
                  <Link href={`/prospects/${p.id}`} className={s.link}><b>{p.name}</b><span className="c2">{p.city}</span></Link>
                  <CallButton id={p.id} name={p.name} phone={p.phone} size="sm" />
                </Row>
              ))}
            </Group>
          ) : null}

          {due.data?.length ? (
            <Group title={<><CalendarClock size={13} /> À rappeler</>}>
              {due.data.map((p) => (
                <Row key={p.id}>
                  <Link href={`/prospects/${p.id}`} className={s.link}>
                    <b>{p.name}</b>
                    <span className={new Date(p.next_action_at!) < now ? s.late : 'c2'}>{relative(p.next_action_at!)}</span>
                  </Link>
                  <CallButton id={p.id} name={p.name} phone={p.phone} size="sm" />
                </Row>
              ))}
            </Group>
          ) : null}

          {uniqueViews.length ? (
            <Group title={<><Eye size={13} color="var(--purple)" /> Maquettes ouvertes</>}>
              {uniqueViews.map((v) => (
                <Row key={v.share_links.prospects.id}>
                  <Link href={`/prospects/${v.share_links.prospects.id}`} className={s.link}>
                    <b>{v.share_links.prospects.name}</b>
                    <span className="c2">{relative(v.created_at)}{v.device ? ` · ${v.device}` : ''}</span>
                  </Link>
                  <CallButton id={v.share_links.prospects.id} name={v.share_links.prospects.name} phone={v.share_links.prospects.phone ?? null} size="sm" />
                </Row>
              ))}
            </Group>
          ) : null}

          {changeRows.length ? (
            <Group title={<><MessageSquareWarning size={13} /> Retours clients</>}>
              {changeRows.map((c, i) => (
                <Row key={i}>
                  <Link href={`/atelier/${c.share_links.prospects.id}`} className={s.link}>
                    <b>{c.share_links.prospects.name}</b>
                    <span className="c2">{c.kind === 'like' ? 'Aime la maquette' : c.message}</span>
                  </Link>
                  {c.kind === 'like' ? <Badge tone="green">♥</Badge> : null}
                </Row>
              ))}
            </Group>
          ) : null}

          {building.data?.length ? (
            <Group title={<><PenTool size={13} /> Maquettes en cours</>}>
              {building.data.map((p) => (
                <Row key={p.id}>
                  <Link href={`/atelier/${p.id}`} className={s.link}><b>{p.name}</b><span className="c2">{p.city}</span></Link>
                </Row>
              ))}
            </Group>
          ) : null}

          {unpaid.data?.length ? (
            <Group title={<><AlertTriangle size={13} color="var(--red)" /> Impayés</>}>
              {(unpaid.data as unknown as { id: string; monthly: number; unpaid_since: string; prospects: { id: string; name: string } }[]).map((u) => (
                <Row key={u.id}>
                  <Link href={`/closing?p=${u.prospects.id}`} className={s.link}><b>{u.prospects.name}</b><span className={s.late}>{relative(u.unpaid_since)}</span></Link>
                  <span className="num">{euro(u.monthly)}</span>
                </Row>
              ))}
            </Group>
          ) : null}
        </div>

        {nothing ? <Empty icon={<Layers />} title="Rien d’urgent" action={<Link href="/triage">Trier des prospects</Link>} /> : null}
      </Page>
    </>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className={s.kpi}>
      <span className="t-foot c2">{label}</span>
      <span className="t-title1 num">{value}</span>
    </div>
  );
}

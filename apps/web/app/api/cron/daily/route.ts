import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { placeDetails } from '@/lib/sources/google';

export const maxDuration = 60;

/** Tâche quotidienne (Vercel Cron) : purge RGPD, expirations, rafraîchissement Google > 30 jours. */
export async function GET(req: Request) {
  if (!env.cronSecret || req.headers.get('authorization') !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const sb = supabaseAdmin();
  const now = new Date().toISOString();
  const report: Record<string, number> = {};

  // 1. Purge des prospects arrivés à échéance (sans document comptable : contrainte FK).
  const { data: toPurge } = await sb.from('prospects').select('id').lt('purge_at', now).limit(500);
  let purged = 0;
  for (const p of toPurge ?? []) {
    const { error } = await sb.from('prospects').delete().eq('id', p.id);
    if (!error) purged++;
  }
  report.purged = purged;

  // 2. Messages de formulaire > 3 ans.
  const { count: forms } = await sb.from('form_messages').delete({ count: 'exact' }).lt('purge_at', now);
  report.forms = forms ?? 0;

  // 3. Expirations.
  const today = now.slice(0, 10);
  const { count: quotes } = await sb.from('quotes').update({ status: 'expired' }, { count: 'exact' }).eq('status', 'sent').lt('valid_until', today);
  report.quotesExpired = quotes ?? 0;
  const { count: links } = await sb.from('share_links').update({ active: false }, { count: 'exact' }).eq('active', true).lt('expires_at', now);
  report.linksExpired = links ?? 0;

  // 4. Données Google > 30 jours (conditions Google) : rafraîchies pour les prospects actifs, 25/jour max.
  const old = new Date(Date.now() - 30 * 864e5).toISOString();
  const { data: stale } = await sb
    .from('prospects')
    .select('id, place_id')
    .in('triage', ['kept', 'hot'])
    .neq('status', 'perdu')
    .lt('google_fetched_at', old)
    .not('place_id', 'is', null)
    .limit(25);
  let refreshed = 0;
  for (const p of stale ?? []) {
    const d = await placeDetails(p.place_id!);
    if (!d) continue;
    await sb.from('prospects').update({ phone: d.phone, website: d.website, rating: d.rating, reviews: d.reviews, hours: d.hours, maps_url: d.mapsUrl, google_fetched_at: now }).eq('id', p.id);
    refreshed++;
  }
  // Prospects non suivis (en attente de tri) : on efface les données Google trop anciennes plutôt que de les payer.
  await sb.from('prospects').update({ rating: null, reviews: null, hours: null }).eq('triage', 'pending').lt('google_fetched_at', old);
  report.googleRefreshed = refreshed;

  // 5. Impayés > 30 jours : rappel dans le journal.
  const { data: unpaid } = await sb.from('subscriptions').select('prospect_id, unpaid_since').lt('unpaid_since', old).gte('unpaid_since', new Date(Date.now() - 31 * 864e5).toISOString());
  for (const u of unpaid ?? []) {
    await sb.from('activities').insert({ prospect_id: u.prospect_id, kind: 'note', data: { text: 'Impayé depuis plus de 30 jours : suspension possible (CGV)' } });
  }
  report.unpaid = unpaid?.length ?? 0;

  return NextResponse.json(report);
}

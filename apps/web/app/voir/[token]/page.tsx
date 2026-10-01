import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { Viewer } from './Viewer';

export const metadata: Metadata = { title: 'Aperçu de votre site', robots: { index: false, follow: false } };

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sb = supabaseAdmin();
  const { data: link } = await sb.from('ph_share_links').select('id, prospect_id, expires_at, password_hash, active').eq('token', token).maybeSingle();
  if (!link || !link.active) notFound();
  const expired = new Date(link.expires_at) < new Date();
  const [{ data: p }, { data: site }] = await Promise.all([
    sb.from('ph_prospects').select('name').eq('id', link.prospect_id).single(),
    sb.from('ph_sites').select('preview_url').eq('prospect_id', link.prospect_id).maybeSingle(),
  ]);
  const store = await cookies();
  const unlocked = !link.password_hash || store.get(`ph_share_${link.id}`)?.value === 'ok';
  return <Viewer token={token} name={p?.name ?? ''} url={site?.preview_url ?? null} expired={expired} locked={!unlocked} />;
}

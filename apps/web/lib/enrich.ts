import 'server-only';
import { needScore, payScore, priority, sectorByKey, type SiteAudit } from '@ph/core';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { pagespeed } from '@/lib/sources/pagespeed';
import { auditSite } from '@/lib/sources/fetchsite';
import { companyBySiren } from '@/lib/sources/gouv';

/**
 * Enrichissement complet d'un prospect gardé : PageSpeed + capture, audit rafraîchi, registre à jour, scores recalculés.
 * Tourne après la réponse (after()) avec le client service role.
 */
export async function enrichProspect(id: string) {
  const sb = supabaseAdmin();
  const { data: p } = await sb.from('ph_prospects').select('*').eq('id', id).single();
  if (!p) return;

  const [audit, ps, company] = await Promise.all([
    p.website ? auditSite(p.website) : Promise.resolve(null as SiteAudit | null),
    p.website && !String(p.website).match(/facebook|instagram|pagesjaunes/) ? pagespeed(p.website) : Promise.resolve(null),
    p.siren ? companyBySiren(p.siren) : Promise.resolve(null),
  ]);

  let screenshotPath: string | null = p.screenshot_path;
  if (ps?.screenshot?.startsWith('data:image')) {
    const [meta, b64] = ps.screenshot.split(',');
    const type = meta?.match(/data:(.*?);/)?.[1] ?? 'image/jpeg';
    const path = `screenshots/${id}.${type.includes('webp') ? 'webp' : 'jpg'}`;
    const { error } = await sb.storage.from('ph-assets').upload(path, Buffer.from(b64 ?? '', 'base64'), { contentType: type, upsert: true });
    if (!error) screenshotPath = path;
  }

  const need = needScore({ website: p.website, audit, pagespeed: ps?.performance ?? null });
  const pay = payScore({
    trancheEffectif: company?.trancheEffectif ?? p.tranche_effectif,
    ca: company?.ca ?? null,
    dateCreation: company?.dateCreation ?? p.date_creation,
    reviews: p.reviews,
    rating: p.rating === null ? null : Number(p.rating),
    sectorTier: sectorByKey(p.sector ?? '')?.tier ?? 'mid',
    entrepreneurIndividuel: company?.entrepreneurIndividuel ?? p.entrepreneur_individuel,
  });

  await sb
    .from('ph_prospects')
    .update({
      audit: audit ?? p.audit,
      pagespeed: ps ? { performance: ps.performance, seo: ps.seo, accessibility: ps.accessibility } : p.pagespeed,
      screenshot_path: screenshotPath,
      dirigeants: company?.dirigeants ?? p.dirigeants,
      finances: company?.finances ?? p.finances,
      tranche_effectif: company?.trancheEffectif ?? p.tranche_effectif,
      need_score: need.score,
      pay_score: pay.score,
      priority: priority(need.score, pay.score),
      score_reasons: { need: need.reasons, pay: pay.reasons },
    })
    .eq('id', id);
}

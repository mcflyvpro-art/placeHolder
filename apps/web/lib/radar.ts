import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  citiesForZone,
  exclusionReason,
  needScore,
  payScore,
  pickSirenMatch,
  priority,
  sectorByKey,
  sha256Hex,
  type Zone,
} from '@ph/core';
import { textSearch, type Place } from '@/lib/sources/google';
import { searchCompanies, type Company } from '@/lib/sources/gouv';
import { hasActiveProcedure } from '@/lib/sources/bodacc';
import { auditSite } from '@/lib/sources/fetchsite';

export type RadarTask = {
  sector: string;
  keyword: string;
  city: string;
  cp: string;
  page: number;
  token: string | null;
  done: boolean;
};

/** Découpe une recherche en tâches (mot-clé × ville), villes les plus peuplées d'abord, plafonnée au budget. */
export function planTasks(sectors: string[], zone: Zone, budget: number): RadarTask[] {
  const cities = citiesForZone(zone).sort((a, b) => b.pop - a.pop);
  const tasks: RadarTask[] = [];
  for (const city of cities) {
    for (const key of sectors) {
      const sector = sectorByKey(key);
      if (!sector) continue;
      tasks.push({ sector: key, keyword: sector.keywords[0]!, city: city.name, cp: city.cp, page: 0, token: null, done: false });
      if (tasks.length >= budget) return tasks;
    }
  }
  return tasks;
}

async function googleQuota(sb: SupabaseClient): Promise<{ ok: boolean; used: number; cap: number }> {
  const { data } = await sb.from('settings').select('google_calls_month, google_month, google_cap').single();
  const month = new Date().toISOString().slice(0, 7);
  if (!data) return { ok: false, used: 0, cap: 0 };
  if (data.google_month !== month) {
    await sb.from('settings').update({ google_calls_month: 0, google_month: month }).eq('id', true);
    return { ok: true, used: 0, cap: data.google_cap };
  }
  return { ok: data.google_calls_month < data.google_cap, used: data.google_calls_month, cap: data.google_cap };
}

async function countGoogleCall(sb: SupabaseClient) {
  const { data } = await sb.from('settings').select('google_calls_month').single();
  await sb.from('settings').update({ google_calls_month: (data?.google_calls_month ?? 0) + 1 }).eq('id', true);
}

async function pool<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]!);
      }
    }),
  );
  return out;
}

type Outcome = 'kept' | 'excluded' | 'duplicate';

async function processPlace(sb: SupabaseClient, place: Place, task: RadarTask, searchId: string): Promise<Outcome> {
  const placeHash = await sha256Hex(`place:${place.id}`);
  const [{ data: existing }, { data: banned }] = await Promise.all([
    sb.from('prospects').select('id').eq('place_id', place.id).maybeSingle(),
    sb.from('blacklist').select('hash').eq('hash', placeHash).maybeSingle(),
  ]);
  if (existing || banned) return 'duplicate';

  const sector = sectorByKey(task.sector);
  const candidates = await searchCompanies(place.name, place.postalCode);
  const match = pickSirenMatch(
    { name: place.name, postalCode: place.postalCode, lat: place.lat, lng: place.lng },
    candidates.map((c) => ({ siren: c.siren, names: c.names, postalCode: c.postalCode, lat: c.lat, lng: c.lng })),
  );
  const company: Company | undefined = match ? candidates.find((c) => c.siren === match.siren) : undefined;

  if (company) {
    const sirenHash = await sha256Hex(`siren:${company.siren}`);
    const { data: bannedSiren } = await sb.from('blacklist').select('hash').eq('hash', sirenHash).maybeSingle();
    if (bannedSiren) return 'duplicate';
  }

  // Chaîne : même nom déjà vu dans d'autres villes.
  const { count: sameName } = await sb
    .from('prospects')
    .select('id', { count: 'exact', head: true })
    .ilike('name', place.name)
    .neq('city', place.city ?? '');

  const procedure = company ? await hasActiveProcedure(company.siren) : false;
  const excluded = exclusionReason({
    naf: company?.naf ?? null,
    natureJuridique: company?.natureJuridique ?? null,
    etat: company?.etat ?? null,
    businessStatus: place.businessStatus,
    chain: (sameName ?? 0) >= 2,
    procedure,
  });
  if (excluded) return 'excluded';

  const audit = place.website ? await auditSite(place.website) : null;
  const need = needScore({ website: place.website, audit, pagespeed: null });
  const pay = payScore({
    trancheEffectif: company?.trancheEffectif ?? null,
    ca: company?.ca ?? null,
    dateCreation: company?.dateCreation ?? null,
    reviews: place.reviews,
    rating: place.rating,
    sectorTier: sector?.tier ?? 'mid',
    entrepreneurIndividuel: company?.entrepreneurIndividuel ?? false,
  });

  const { error } = await sb.from('prospects').insert({
    search_id: searchId,
    name: place.name,
    sector: task.sector,
    siren: company?.siren ?? null,
    siret: company?.siret ?? null,
    naf: company?.naf ?? null,
    nature_juridique: company?.natureJuridique ?? null,
    entrepreneur_individuel: company?.entrepreneurIndividuel ?? false,
    address: place.address,
    postal_code: place.postalCode,
    city: place.city ?? task.city,
    departement: place.postalCode?.slice(0, place.postalCode.startsWith('97') ? 3 : 2) ?? null,
    lat: place.lat,
    lng: place.lng,
    dirigeants: company?.dirigeants ?? null,
    finances: company?.finances ?? null,
    date_creation: company?.dateCreation ?? null,
    tranche_effectif: company?.trancheEffectif ?? null,
    unverified: !company,
    place_id: place.id,
    phone: place.phone,
    website: place.website,
    rating: place.rating,
    reviews: place.reviews,
    hours: place.hours,
    maps_url: place.mapsUrl,
    google_fetched_at: new Date().toISOString(),
    audit,
    need_score: need.score,
    pay_score: pay.score,
    priority: priority(need.score, pay.score),
    score_reasons: { need: need.reasons, pay: pay.reasons },
  });
  return error ? 'duplicate' : 'kept';
}

export type StepResult = { done: boolean; progress: number; total: number; found: number; kept: number; excluded: number; quota: { used: number; cap: number }; error?: string };

/** Traite une tâche (une page Google = jusqu'à 20 entreprises). Appelé en boucle par l'UI. */
export async function radarStep(sb: SupabaseClient, searchId: string): Promise<StepResult> {
  const { data: search } = await sb.from('searches').select('*').eq('id', searchId).single();
  if (!search) throw new Error('Recherche introuvable');
  const tasks = search.tasks as RadarTask[];
  const total = tasks.length;
  const idx = tasks.findIndex((t) => !t.done);
  const base = { total, found: search.found, kept: search.kept, excluded: search.excluded };

  if (idx === -1 || search.status !== 'running') {
    if (search.status === 'running') await sb.from('searches').update({ status: 'done' }).eq('id', searchId);
    const q = await googleQuota(sb);
    return { ...base, done: true, progress: total, quota: { used: q.used, cap: q.cap } };
  }

  const quota = await googleQuota(sb);
  if (!quota.ok) {
    await sb.from('searches').update({ status: 'paused', error: 'Quota Google du mois atteint' }).eq('id', searchId);
    return { ...base, done: true, progress: idx, quota: { used: quota.used, cap: quota.cap }, error: 'quota' };
  }

  const task = tasks[idx]!;
  const { places, next } = await textSearch(`${task.keyword} ${task.city}`, task.token);
  await countGoogleCall(sb);

  const outcomes = await pool(places, 5, (p) => processPlace(sb, p, task, searchId).catch(() => 'excluded' as Outcome));
  const kept = outcomes.filter((o) => o === 'kept').length;
  const excluded = outcomes.filter((o) => o === 'excluded').length;

  // Page suivante : seulement si la page courante a encore produit des nouveautés (évite de brûler le quota).
  if (next && task.page < 2 && kept > 0) {
    tasks[idx] = { ...task, page: task.page + 1, token: next };
  } else {
    tasks[idx] = { ...task, done: true };
  }

  const found = search.found + places.length;
  const keptTotal = search.kept + kept;
  const excludedTotal = search.excluded + excluded;
  const finished = tasks.every((t) => t.done);
  await sb
    .from('searches')
    .update({ tasks, found, kept: keptTotal, excluded: excludedTotal, status: finished ? 'done' : 'running' })
    .eq('id', searchId);

  return {
    done: finished,
    progress: tasks.filter((t) => t.done).length,
    total,
    found,
    kept: keptTotal,
    excluded: excludedTotal,
    quota: { used: quota.used + 1, cap: quota.cap },
  };
}

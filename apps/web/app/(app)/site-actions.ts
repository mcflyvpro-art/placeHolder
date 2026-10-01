'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth';
import { integrations } from '@/lib/env';
import { createSite, pushBrief } from '@/lib/sites';
import { dispatchDeploy } from '@/lib/integrations/github';

type Result = { ok: true } | { ok: false; error: string };

const wrap = async (fn: () => Promise<unknown>): Promise<Result> => {
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur' };
  }
};

export async function createSiteAction(prospectId: string): Promise<Result> {
  const sb = await requireOwner();
  const i = integrations();
  if (!i.github || !i.cloudflare) return { ok: false, error: 'GitHub et Cloudflare doivent être configurés (Réglages)' };
  const r = await wrap(() => createSite(sb, prospectId));
  revalidatePath(`/atelier/${prospectId}`);
  return r;
}

export async function pushBriefAction(prospectId: string): Promise<Result> {
  const sb = await requireOwner();
  const r = await wrap(() => pushBrief(sb, prospectId, 'brief : mise à jour placeHolder'));
  revalidatePath(`/atelier/${prospectId}`);
  return r;
}

export async function redeployAction(prospectId: string): Promise<Result> {
  const sb = await requireOwner();
  const { data: site } = await sb.from('sites').select('repo').eq('prospect_id', prospectId).single();
  if (!site) return { ok: false, error: 'Site introuvable' };
  return wrap(() => dispatchDeploy(site.repo));
}

export async function setFormEmail(prospectId: string, email: string): Promise<Result> {
  const sb = await requireOwner();
  await sb.from('sites').update({ form_email: email || null }).eq('prospect_id', prospectId);
  await sb.from('prospects').update({ client_email: email || null }).eq('id', prospectId);
  revalidatePath(`/atelier/${prospectId}`);
  return { ok: true };
}

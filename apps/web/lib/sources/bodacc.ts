import 'server-only';

const CLOSED = /cl[ôo]ture|jugement mettant fin|homologation|plan de (sauvegarde|redressement) arr[êe]t/i;

/** Vrai si la dernière annonce de procédure collective (< 5 ans) n'est pas une clôture. */
export async function hasActiveProcedure(siren: string): Promise<boolean> {
  const url = new URL('https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records');
  url.searchParams.set('where', `registre="${siren}" and familleavis="collective"`);
  url.searchParams.set('order_by', 'dateparution desc');
  url.searchParams.set('limit', '3');
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return false;
    const json = (await res.json()) as { results?: { dateparution: string; jugement: string | null }[] };
    const last = json.results?.[0];
    if (!last) return false;
    if (Date.now() - new Date(last.dateparution).getTime() > 5 * 365 * 24 * 3600 * 1000) return false;
    const nature = (() => {
      try {
        return (JSON.parse(last.jugement ?? '{}') as { nature?: string }).nature ?? '';
      } catch {
        return '';
      }
    })();
    return !CLOSED.test(nature);
  } catch {
    return false;
  }
}

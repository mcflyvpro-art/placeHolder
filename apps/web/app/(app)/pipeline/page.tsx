import { Suspense } from 'react';
import { requireOwner } from '@/lib/auth';
import { loadCrm } from '@/lib/crm';
import { PageHeader } from '@/components/shell/Shell';
import { Pipeline } from '@/components/crm/Pipeline';

export const metadata = { title: 'Pipeline' };

export default async function PipelinePage() {
  const sb = await requireOwner();
  const items = await loadCrm(sb);
  const active = items.filter((i) => i.status !== 'perdu' && i.status !== 'client').length;
  return (
    <>
      <PageHeader title="Pipeline" sub={`${active} en cours · ${items.filter((i) => i.status === 'client').length} clients`} />
      <Suspense>
        <Pipeline items={items} />
      </Suspense>
    </>
  );
}

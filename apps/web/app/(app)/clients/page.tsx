import { requireOwner } from '@/lib/auth';
import { loadCrm } from '@/lib/crm';
import { PageHeader, Page } from '@/components/shell/Shell';
import { ClientsTable } from '@/components/crm/ClientsTable';

export const metadata = { title: 'Clients' };

export default async function ClientsPage() {
  const sb = await requireOwner();
  const items = await loadCrm(sb);
  return (
    <>
      <PageHeader title="Clients" sub={`${items.length} suivis`} />
      <Page>
        <ClientsTable items={items} />
      </Page>
    </>
  );
}

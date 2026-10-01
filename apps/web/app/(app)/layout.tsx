import { Shell } from '@/components/shell/Shell';
import { requireOwner } from '@/lib/auth';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sb = await requireOwner();
  const [pending, due] = await Promise.all([
    sb.from('prospects').select('id', { count: 'exact', head: true }).eq('triage', 'pending'),
    sb
      .from('prospects')
      .select('id', { count: 'exact', head: true })
      .lte('next_action_at', new Date().toISOString())
      .neq('status', 'perdu'),
  ]);
  return <Shell counts={{ '/triage': pending.count ?? 0, '/today': due.count ?? 0 }}>{children}</Shell>;
}

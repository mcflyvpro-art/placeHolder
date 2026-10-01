import { requireOwner } from '@/lib/auth';
import { integrations } from '@/lib/env';
import { loadSettings } from '@/lib/settings';
import { PageHeader, Page } from '@/components/shell/Shell';
import { Group, Row, Badge } from '@/components/ui';
import { SettingsForms } from './SettingsForms';

export const metadata = { title: 'Réglages' };

const INTEGRATIONS: { key: keyof ReturnType<typeof integrations>; label: string; env: string }[] = [
  { key: 'google', label: 'Google Places', env: 'GOOGLE_PLACES_KEY' },
  { key: 'github', label: 'GitHub', env: 'GITHUB_TOKEN' },
  { key: 'cloudflare', label: 'Cloudflare', env: 'CLOUDFLARE_API_TOKEN · CLOUDFLARE_ACCOUNT_ID' },
  { key: 'stripe', label: 'Stripe', env: 'STRIPE_SECRET_KEY · STRIPE_WEBHOOK_SECRET' },
  { key: 'porkbun', label: 'Porkbun', env: 'PORKBUN_API_KEY · PORKBUN_SECRET_KEY' },
  { key: 'smtp', label: 'Email (Gmail)', env: 'SMTP_USER · SMTP_PASS' },
];

export default async function SettingsPage() {
  const sb = await requireOwner();
  const settings = await loadSettings(sb);
  const { data: register } = await sb.from('legal_register').select('*').order('created_at');
  const i = integrations();
  const raw = settings.raw ?? {};
  return (
    <>
      <PageHeader title="Réglages" />
      <Page>
        <div style={{ display: 'grid', gap: 28, maxWidth: 760 }}>
          <SettingsForms
            company={settings.company}
            general={{ preview_domain: raw.preview_domain ?? '', google_cap: raw.google_cap ?? 950, retention_days: raw.retention_days ?? 30, tva: (raw.thresholds as { tva?: number })?.tva ?? 37500 }}
            grid={settings.grid}
          />
          <Group title="Intégrations">
            <div id="integrations" />
            {INTEGRATIONS.map((x) => (
              <Row key={x.key} label={x.label} value={i[x.key] ? <Badge tone="green">Connecté</Badge> : <code className="t-mono t-foot">{x.env}</code>} />
            ))}
          </Group>
          <Group title="Registre des traitements (RGPD)">
            {(register ?? []).map((r) => (
              <Row key={r.id}>
                <div style={{ display: 'grid', gap: 2 }}>
                  <b>{r.name}</b>
                  <span className="t-foot c2">{r.purpose}</span>
                  <span className="t-foot c2">Base : {r.legal_basis} · Conservation : {r.retention} · Destinataires : {r.recipients}</span>
                </div>
              </Row>
            ))}
          </Group>
        </div>
      </Page>
    </>
  );
}

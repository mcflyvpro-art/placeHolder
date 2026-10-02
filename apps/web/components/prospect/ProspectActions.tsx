'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { STAGES, STATUS_LABEL, type Stage, type Status } from '@ph/core';
import { PenTool, Share2, FileSignature, UserX, Copy, QrCode } from 'lucide-react';
import { Button, Sheet, Group, Row, Segmented, fieldClass, useToast } from '@/components/ui';
import { forgetProspect } from '@/app/(app)/actions';
import { moveTo, markLost } from '@/app/(app)/crm-actions';
import { createShareLink } from '@/app/(app)/share-actions';
import { CallButton } from './CallSheet';

export function ProspectActions({ id, name, phone, status, hasSite }: { id: string; name: string; phone: string | null; status: Status; hasSite: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [statusOpen, setStatusOpen] = useState(false);
  const [lost, setLost] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [days, setDays] = useState<'7' | '14' | '30'>('14');
  const [password, setPassword] = useState('');
  const [link, setLink] = useState<{ url: string; qr: string } | null>(null);

  const label = STATUS_LABEL[status] ?? status;

  return (
    <>
      <CallButton id={id} name={name} phone={phone} />
      <Button onClick={() => setStatusOpen(true)}>{label}</Button>
      <Button icon aria-label="Atelier" onClick={() => router.push(`/atelier/${id}`)}><PenTool /></Button>
      <Button icon aria-label="Lien de présentation" disabled={!hasSite} onClick={() => setShareOpen(true)}><Share2 /></Button>
      <Button icon aria-label="Closing" onClick={() => router.push(`/closing?p=${id}`)}><FileSignature /></Button>

      <Sheet open={statusOpen} onClose={() => setStatusOpen(false)} label="Statut">
        <Group>
          {STAGES.map((st) => (
            <Row key={st.key} onClick={() => start(async () => { await moveTo(id, st.key as Stage); setStatusOpen(false); router.refresh(); })}>
              <span style={{ width: 10, height: 10, borderRadius: 5, background: st.tint }} />
              <span style={{ flex: 1, fontWeight: st.key === status ? 800 : 500 }}>{st.label}</span>
            </Row>
          ))}
        </Group>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <input className={fieldClass} placeholder="Raison de la perte" value={lost} onChange={(e) => setLost(e.target.value)} aria-label="Raison" />
          <Button variant="danger" disabled={!lost.trim() || pending} onClick={() => start(async () => { await markLost(id, lost); setStatusOpen(false); router.refresh(); })}>Perdu</Button>
        </div>
        <Button
          variant="plain"
          style={{ marginTop: 16, color: 'var(--red)' }}
          onClick={() =>
            start(async () => {
              const r = await forgetProspect(id);
              if (!r.ok) return toast({ text: r.reason });
              toast({ text: 'Supprimé et ajouté à la liste d’opposition' });
              router.push('/pipeline');
            })
          }
        >
          <UserX />Ne plus contacter
        </Button>
      </Sheet>

      <Sheet open={shareOpen} onClose={() => { setShareOpen(false); setLink(null); }} label="Lien de présentation">
        {link ? (
          <div style={{ display: 'grid', gap: 16, justifyItems: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={link.qr} alt="QR code du lien" width={180} height={180} style={{ borderRadius: 12, background: '#fff', padding: 8 }} />
            <code className="t-mono t-foot" style={{ wordBreak: 'break-all', textAlign: 'center' }}>{link.url}</code>
            <Button variant="primary" size="lg" onClick={() => { navigator.clipboard.writeText(link.url); toast({ text: 'Lien copié' }); }}>
              <Copy />Copier
            </Button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            <Segmented label="Durée" value={days} onChange={setDays} options={[{ value: '7', label: '7 jours' }, { value: '14', label: '14 jours' }, { value: '30', label: '30 jours' }]} />
            <input className={fieldClass} placeholder="Mot de passe (optionnel)" value={password} onChange={(e) => setPassword(e.target.value)} aria-label="Mot de passe" />
            <Button variant="primary" size="lg" disabled={pending} onClick={() => start(async () => setLink(await createShareLink(id, Number(days), password || null)))}>
              <QrCode />Générer
            </Button>
          </div>
        )}
      </Sheet>
    </>
  );
}

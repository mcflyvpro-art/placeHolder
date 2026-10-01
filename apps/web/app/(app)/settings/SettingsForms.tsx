'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { LogOut } from 'lucide-react';
import type { Grid } from '@ph/core';
import { Button, Group, Row, inlineFieldClass, useToast } from '@/components/ui';
import type { Company } from '@/lib/settings';
import { saveCompany, saveGeneral, saveGrid, signOut } from './actions';

const GRID_LABEL: Record<string, string> = {
  default: 'Par défaut', btp: 'Bâtiment', auto: 'Auto', restauration: 'Restauration', beaute: 'Beauté', commerce: 'Commerce', services: 'Services', sante: 'Santé & sport',
};

function Field({ name, label, defaultValue, type = 'text', placeholder }: { name: string; label: string; defaultValue?: string | number; type?: string; placeholder?: string }) {
  return (
    <Row label={<label htmlFor={name}>{label}</label>}>
      <input id={name} name={name} type={type} defaultValue={defaultValue} placeholder={placeholder} className={inlineFieldClass} style={{ maxWidth: 360 }} />
    </Row>
  );
}

export function SettingsForms({ company, general, grid }: { company: Company; general: { preview_domain: string; google_cap: number; retention_days: number; tva: number }; grid: Grid }) {
  const toast = useToast();
  const [cState, cAction, cPending] = useActionState(saveCompany, { ok: false });
  const [gState, gAction, gPending] = useActionState(saveGeneral, { ok: false });
  const [g, setG] = useState(grid);
  const [, start] = useTransition();

  useEffect(() => { if (cState.ok) toast({ text: 'Fiche entreprise enregistrée' }); else if (cState.error) toast({ text: cState.error }); }, [cState, toast]);
  useEffect(() => { if (gState.ok) toast({ text: 'Réglages enregistrés' }); }, [gState, toast]);

  return (
    <>
      <form action={cAction} id="entreprise">
        <Group title="Ma micro-entreprise">
          <Field name="nom" label="Nom (EI)" defaultValue={company.nom} placeholder="Prénom Nom" />
          <Field name="siret" label="SIRET" defaultValue={company.siret} placeholder="14 chiffres" />
          <Field name="adresse" label="Adresse" defaultValue={company.adresse} />
          <Field name="email" label="Email" type="email" defaultValue={company.email} />
          <Field name="telephone" label="Téléphone" defaultValue={company.telephone} />
          <Field name="iban" label="IBAN" defaultValue={company.iban} />
          <Field name="bic" label="BIC" defaultValue={company.bic} />
          <Row><span style={{ flex: 1 }} /><Button type="submit" variant="primary" size="sm" disabled={cPending}>Enregistrer</Button></Row>
        </Group>
      </form>

      <form action={gAction}>
        <Group title="Général">
          <Field name="preview_domain" label="Domaine des maquettes" defaultValue={general.preview_domain} placeholder="maquettes.mondomaine.fr" />
          <Field name="google_cap" label="Plafond Google / mois" type="number" defaultValue={general.google_cap} />
          <Field name="retention_days" label="Purge des rejetés (jours)" type="number" defaultValue={general.retention_days} />
          <Field name="tva" label="Seuil franchise TVA (€)" type="number" defaultValue={general.tva} />
          <Row><span style={{ flex: 1 }} /><Button type="submit" variant="primary" size="sm" disabled={gPending}>Enregistrer</Button></Row>
        </Group>
      </form>

      <Group title="Grilles de prix">
        {Object.entries(g).map(([k, v]) => (
          <Row key={k} label={GRID_LABEL[k] ?? k}>
            <span className="t-foot c2">€/page</span>
            <input className={inlineFieldClass} style={{ width: 70 }} inputMode="numeric" defaultValue={Math.round(v.perPage)} onBlur={(e) => setG({ ...g, [k]: { ...v, perPage: Number(e.target.value) || v.perPage } })} aria-label={`Prix par page ${k}`} />
            <span className="t-foot c2">€/mois</span>
            <input className={inlineFieldClass} style={{ width: 60 }} inputMode="numeric" defaultValue={v.monthly} onBlur={(e) => setG({ ...g, [k]: { ...v, monthly: Number(e.target.value) || v.monthly } })} aria-label={`Mensualité ${k}`} />
          </Row>
        ))}
        <Row><span style={{ flex: 1 }} /><Button size="sm" variant="primary" onClick={() => start(async () => { await saveGrid(g); toast({ text: 'Grilles enregistrées' }); })}>Enregistrer</Button></Row>
      </Group>

      <form action={signOut}>
        <Button type="submit" variant="danger"><LogOut />Se déconnecter</Button>
      </form>
    </>
  );
}

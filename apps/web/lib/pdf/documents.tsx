import 'server-only';
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import { VAT_MENTION, LATE_PAYMENT_MENTION, cgv, formatSiren, type Client, type OfferKind, type QuoteLine, type Seller } from '@ph/core';

// Les polices standard PDF ne contiennent pas l'espace fine insécable : on la remplace.
const money = (n: number) =>
  `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n).replace(/[  ]/g, ' ')} €`;
const date = (d: Date | string) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d));

const ink = '#1d1d1f';
const muted = '#6e6e73';
const line = '#e5e5ea';
const accent = '#0071e3';

const st = StyleSheet.create({
  page: { padding: 48, fontSize: 9.5, fontFamily: 'Helvetica', color: ink, lineHeight: 1.45 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  brand: { fontSize: 16, fontFamily: 'Helvetica-Bold', letterSpacing: -0.4 },
  brandAccent: { color: accent },
  docTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginTop: 28, letterSpacing: -0.4 },
  meta: { color: muted, marginTop: 4 },
  parties: { flexDirection: 'row', gap: 24, marginTop: 24 },
  party: { flex: 1, padding: 12, borderRadius: 6, backgroundColor: '#f5f5f7' },
  label: { fontSize: 7.5, color: muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  bold: { fontFamily: 'Helvetica-Bold' },
  table: { marginTop: 24 },
  th: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: ink, paddingBottom: 5, fontFamily: 'Helvetica-Bold', fontSize: 8.5 },
  tr: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: line, paddingVertical: 8 },
  cDesc: { flex: 1, paddingRight: 12 },
  cQty: { width: 40, textAlign: 'right' },
  cUnit: { width: 80, textAlign: 'right' },
  cTotal: { width: 80, textAlign: 'right' },
  detail: { color: muted, fontSize: 8.5, marginTop: 2 },
  totals: { marginTop: 12, alignSelf: 'flex-end', width: 240 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  grand: { fontSize: 13, fontFamily: 'Helvetica-Bold', borderTopWidth: 1, borderTopColor: ink, paddingTop: 6, marginTop: 4 },
  note: { marginTop: 20, color: muted, fontSize: 8.5 },
  sign: { marginTop: 28, flexDirection: 'row', gap: 24 },
  signBox: { flex: 1, height: 80, borderWidth: 0.5, borderColor: line, borderRadius: 6, padding: 10 },
  footer: { position: 'absolute', bottom: 28, left: 48, right: 48, fontSize: 7.5, color: muted, textAlign: 'center' },
  h2: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 12 },
  art: { marginBottom: 9 },
  artTitle: { fontFamily: 'Helvetica-Bold', marginBottom: 2 },
});

function Header() {
  return (
    <Text style={st.brand}>
      place<Text style={st.brandAccent}>Holder</Text>
    </Text>
  );
}

function Parties({ seller, client }: { seller: Seller; client: Client }) {
  return (
    <View style={st.parties}>
      <View style={st.party}>
        <Text style={st.label}>Prestataire</Text>
        <Text style={st.bold}>{seller.nom}</Text>
        <Text>Entrepreneur individuel — SIRET {seller.siret}</Text>
        <Text>{seller.adresse}</Text>
        <Text>{seller.email}{seller.telephone ? ` · ${seller.telephone}` : ''}</Text>
      </View>
      <View style={st.party}>
        <Text style={st.label}>Client</Text>
        <Text style={st.bold}>{client.denomination}</Text>
        {client.siren ? <Text>SIREN {formatSiren(client.siren)}</Text> : null}
        {client.adresse ? <Text>{client.adresse}</Text> : null}
        {client.representant ? <Text>Représenté par {client.representant}</Text> : null}
        {client.email ? <Text>{client.email}</Text> : null}
      </View>
    </View>
  );
}

function Lines({ lines }: { lines: QuoteLine[] }) {
  return (
    <View style={st.table}>
      <View style={st.th}>
        <Text style={st.cDesc}>Désignation</Text>
        <Text style={st.cQty}>Qté</Text>
        <Text style={st.cUnit}>Prix unitaire</Text>
        <Text style={st.cTotal}>Total</Text>
      </View>
      {lines.map((l, i) => (
        <View key={i} style={st.tr} wrap={false}>
          <View style={st.cDesc}>
            <Text style={st.bold}>{l.label}</Text>
            {l.detail ? <Text style={st.detail}>{l.detail}</Text> : null}
          </View>
          <Text style={st.cQty}>{l.qty}</Text>
          <Text style={st.cUnit}>{money(l.unit)}{l.recurring ? ' /mois' : ''}</Text>
          <Text style={st.cTotal}>{money(l.unit * l.qty)}{l.recurring ? ' /mois' : ''}</Text>
        </View>
      ))}
    </View>
  );
}

export type QuoteDoc = {
  number: string;
  createdAt: string;
  validUntil: string;
  offer: OfferKind;
  lines: QuoteLine[];
  total: number;
  monthly: number | null;
  commitment: number | null;
  depositRate: number;
  seller: Seller;
  client: Client;
};

export async function renderQuote(q: QuoteDoc): Promise<Buffer> {
  const terms = cgv(q.offer, q.seller);
  const doc = (
    <Document title={`Devis ${q.number}`} author={q.seller.nom} language="fr">
      <Page size="A4" style={st.page}>
        <View style={st.row}>
          <Header />
          <Text style={st.meta}>{q.seller.email}</Text>
        </View>
        <Text style={st.docTitle}>Devis {q.number}</Text>
        <Text style={st.meta}>Émis le {date(q.createdAt)} · valable jusqu’au {date(q.validUntil)}</Text>
        <Parties seller={q.seller} client={q.client} />
        <Lines lines={q.lines} />
        <View style={st.totals}>
          {q.total > 0 ? (
            <View style={[st.totalRow, st.grand]}>
              <Text>Total création</Text>
              <Text>{money(q.total)}</Text>
            </View>
          ) : null}
          {q.monthly ? (
            <View style={[st.totalRow, q.total > 0 ? {} : st.grand]}>
              <Text>Abonnement</Text>
              <Text>{money(q.monthly)} /mois · {q.commitment} mois</Text>
            </View>
          ) : null}
          {q.total > 0 && q.offer !== 'subscription' ? (
            <View style={st.totalRow}>
              <Text style={{ color: muted }}>Acompte à la signature ({Math.round(q.depositRate * 100)} %)</Text>
              <Text>{money(Math.round(q.total * q.depositRate * 100) / 100)}</Text>
            </View>
          ) : null}
        </View>
        <Text style={st.note}>{VAT_MENTION}. Conditions générales de vente en annexe. {LATE_PAYMENT_MENTION}</Text>
        <View style={st.sign}>
          <View style={st.signBox}><Text style={st.label}>Le prestataire</Text><Text>{q.seller.nom}</Text></View>
          <View style={st.signBox}><Text style={st.label}>Bon pour accord — le client</Text><Text style={{ color: muted }}>Signature électronique</Text></View>
        </View>
        <Text style={st.footer} fixed>{q.seller.nom} · SIRET {q.seller.siret} · {VAT_MENTION}</Text>
      </Page>
      <Page size="A4" style={st.page}>
        <Text style={st.h2}>Conditions générales de vente</Text>
        {terms.map((t, i) => (
          <View key={t.title} style={st.art} wrap={false}>
            <Text style={st.artTitle}>{i + 1}. {t.title}</Text>
            <Text>{t.body}</Text>
          </View>
        ))}
        <Text style={st.footer} fixed>{q.seller.nom} · SIRET {q.seller.siret} · Devis {q.number}</Text>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}

export type InvoiceDoc = {
  number: string;
  createdAt: string;
  paidAt: string | null;
  lines: QuoteLine[];
  total: number;
  seller: Seller;
  client: Client;
  quoteNumber: string | null;
  kindLabel: string;
};

export async function renderInvoice(f: InvoiceDoc): Promise<Buffer> {
  const doc = (
    <Document title={`Facture ${f.number}`} author={f.seller.nom} language="fr">
      <Page size="A4" style={st.page}>
        <View style={st.row}>
          <Header />
          <Text style={st.meta}>{f.seller.email}</Text>
        </View>
        <Text style={st.docTitle}>Facture {f.number}</Text>
        <Text style={st.meta}>
          Date d’émission : {date(f.createdAt)} · Date de la prestation : {date(f.createdAt)}
          {f.quoteNumber ? ` · Devis ${f.quoteNumber}` : ''}
        </Text>
        <Parties seller={f.seller} client={f.client} />
        <Lines lines={f.lines} />
        <View style={st.totals}>
          <View style={[st.totalRow, st.grand]}>
            <Text>Total à payer</Text>
            <Text>{money(f.total)}</Text>
          </View>
          <Text style={{ color: muted, marginTop: 4, textAlign: 'right' }}>{f.kindLabel}</Text>
        </View>
        <Text style={st.note}>
          {f.paidAt ? `Payée le ${date(f.paidAt)} par carte bancaire.` : `Paiement à réception.${f.seller.iban ? ` IBAN ${f.seller.iban}${f.seller.bic ? ` · BIC ${f.seller.bic}` : ''}.` : ''}`} {VAT_MENTION}. {LATE_PAYMENT_MENTION}
        </Text>
        <Text style={st.footer} fixed>{f.seller.nom} · Entrepreneur individuel · SIRET {f.seller.siret} · {f.seller.adresse}</Text>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}

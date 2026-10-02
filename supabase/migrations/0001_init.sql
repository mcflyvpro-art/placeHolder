-- placeHolder — schéma initial
create extension if not exists pgcrypto;

-- Réglages --------------------------------------------------------------------
create table ph_settings (
  id boolean primary key default true check (id),
  company jsonb not null default '{}'::jsonb,         -- nom, siret, adresse, email, tel, iban, statut
  thresholds jsonb not null default '{}'::jsonb,      -- seuils scoring
  grid jsonb not null default '{}'::jsonb,            -- grilles de prix
  preview_domain text,
  retention_days int not null default 30,
  google_calls_month int not null default 0,
  google_month text not null default to_char(now(), 'YYYY-MM'),
  google_cap int not null default 950,
  owner_password_hash text,
  updated_at timestamptz not null default now()
);
insert into ph_settings default values;

create table ph_login_attempts (
  id bigint generated always as identity primary key,
  ip text,
  ok boolean not null,
  created_at timestamptz not null default now()
);
create index ph_login_attempts_recent on ph_login_attempts (created_at desc);

-- Recherches ------------------------------------------------------------------
create table ph_searches (
  id uuid primary key default gen_random_uuid(),
  sectors text[] not null,
  zone jsonb not null,
  tasks jsonb not null default '[]'::jsonb,          -- [{keyword, city, cp, lat, lng, page, token, done}]
  cursor int not null default 0,
  status text not null default 'running' check (status in ('running','paused','done','error')),
  found int not null default 0,
  kept int not null default 0,
  excluded int not null default 0,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Prospects -------------------------------------------------------------------
create table ph_prospects (
  id uuid primary key default gen_random_uuid(),
  search_id uuid references ph_searches(id) on delete set null,
  name text not null,
  slug text unique,
  sector text,
  -- registre
  siren text,
  siret text,
  naf text,
  nature_juridique text,
  forme_juridique text,
  entrepreneur_individuel boolean not null default false,
  address text,
  postal_code text,
  city text,
  departement text,
  lat double precision,
  lng double precision,
  dirigeants jsonb,
  finances jsonb,
  date_creation date,
  tranche_effectif text,
  unverified boolean not null default false,
  -- google
  place_id text unique,
  phone text,
  website text,
  rating numeric(2,1),
  reviews int,
  hours jsonb,
  maps_url text,
  google_fetched_at timestamptz,
  -- audit
  audit jsonb,
  pagespeed jsonb,
  screenshot_path text,
  -- scores
  need_score int not null default 0,
  pay_score int not null default 0,
  priority int not null default 0,
  score_reasons jsonb not null default '{"need":[],"pay":[]}'::jsonb,
  -- crm
  triage text not null default 'pending' check (triage in ('pending','kept','dropped','hot')),
  status text not null default 'a_appeler',
  next_action_at timestamptz,
  lost_reason text,
  call_attempts int not null default 0,
  -- ia & prix
  brand_dna text,
  ai_analysis jsonb,
  directions jsonb,
  pricing jsonb,
  final_price jsonb,
  client_email text,
  -- rgpd
  purge_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ph_prospects_triage_priority on ph_prospects (triage, priority desc);
create index ph_prospects_status on ph_prospects (status);
create index ph_prospects_next_action on ph_prospects (next_action_at) where next_action_at is not null;
create index ph_prospects_siren on ph_prospects (siren);

create table ph_blacklist (
  hash text primary key,
  created_at timestamptz not null default now()
);

create table ph_activities (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references ph_prospects(id) on delete cascade,
  kind text not null,          -- call, status, note, share_view, share_like, share_change, quote, payment, site
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index ph_activities_prospect on ph_activities (prospect_id, created_at desc);

-- File IA ---------------------------------------------------------------------
create table ph_ai_jobs (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references ph_prospects(id) on delete cascade,
  type text not null check (type in ('analyse','brand_dna','directions')),
  status text not null default 'queued' check (status in ('queued','running','done','error')),
  attempts int not null default 0,
  result jsonb,
  error text,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index ph_ai_jobs_queue on ph_ai_jobs (status, created_at);

-- Sites -----------------------------------------------------------------------
create table ph_sites (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null unique references ph_prospects(id) on delete cascade,
  repo text not null,
  pages_project text not null,
  preview_url text,
  production_domain text,
  mode text not null default 'preview' check (mode in ('preview','production','suspended')),
  form_email text,
  turnstile_sitekey text,
  turnstile_secret text,
  analytics_token text,
  created_at timestamptz not null default now()
);

create table ph_site_versions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references ph_sites(id) on delete cascade,
  sha text not null,
  message text,
  url text,
  quality jsonb,              -- {lighthouse:{performance,accessibility,best,seo}, axe, links, slop, legal, todo, passed}
  created_at timestamptz not null default now()
);
create index ph_site_versions_site on ph_site_versions (site_id, created_at desc);

create table ph_form_messages (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references ph_sites(id) on delete cascade,
  payload jsonb not null,
  forwarded boolean not null default false,
  purge_at timestamptz not null default now() + interval '3 years',
  created_at timestamptz not null default now()
);

-- Lien de présentation --------------------------------------------------------
create table ph_share_links (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references ph_prospects(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  password_hash text,
  views int not null default 0,
  last_view_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table ph_share_events (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references ph_share_links(id) on delete cascade,
  kind text not null check (kind in ('view','like','change_request')),
  device text,
  message text,
  created_at timestamptz not null default now()
);

-- Numérotation sans trou --------------------------------------------------------
create table ph_counters (
  kind text not null,
  year int not null,
  value int not null default 0,
  primary key (kind, year)
);

create or replace function ph_next_number(p_kind text) returns text
language plpgsql security definer set search_path = public as $$
declare
  y int := extract(year from now())::int;
  v int;
begin
  insert into ph_counters(kind, year, value) values (p_kind, y, 0) on conflict do nothing;
  update ph_counters set value = value + 1 where kind = p_kind and year = y returning value into v;
  return p_kind || '-' || y || '-' || lpad(v::text, 3, '0');
end $$;

-- Devis, factures, avoirs -------------------------------------------------------
create table ph_quotes (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references ph_prospects(id) on delete restrict,
  number text not null unique,
  offer text not null check (offer in ('oneOff','hybrid','subscription')),
  lines jsonb not null,
  total numeric(10,2) not null,
  monthly numeric(10,2),
  commitment_months int,
  deposit_rate numeric(3,2) not null default 0.30,
  valid_until date not null,
  client jsonb not null,
  seller jsonb not null,
  status text not null default 'draft' check (status in ('draft','sent','signed','expired','cancelled')),
  sign_token text unique,
  pdf_path text,
  pdf_sha256 text,
  signature jsonb,
  created_at timestamptz not null default now()
);

create table ph_invoices (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references ph_prospects(id) on delete restrict,
  quote_id uuid references ph_quotes(id),
  number text not null unique,
  kind text not null check (kind in ('deposit','balance','subscription','one_off')),
  lines jsonb not null,
  total numeric(10,2) not null,
  client jsonb not null,
  seller jsonb not null,
  paid_at timestamptz,
  status text not null default 'issued' check (status in ('issued','paid','credited')),
  stripe_ref text unique,
  pdf_path text,
  created_at timestamptz not null default now()
);

create or replace function ph_invoices_immutable() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Une facture ne peut pas être supprimée (émettre un avoir).';
  end if;
  if new.number <> old.number or new.lines <> old.lines or new.total <> old.total
     or new.client <> old.client or new.seller <> old.seller or new.created_at <> old.created_at then
    raise exception 'Une facture émise est immuable.';
  end if;
  return new;
end $$;
create trigger ph_invoices_immutable before update or delete on ph_invoices
  for each row execute function ph_invoices_immutable();

create table ph_credit_notes (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references ph_invoices(id),
  number text not null unique,
  total numeric(10,2) not null,
  reason text not null,
  pdf_path text,
  created_at timestamptz not null default now()
);

create table ph_subscriptions (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references ph_prospects(id) on delete restrict,
  stripe_customer text,
  stripe_subscription text unique,
  monthly numeric(10,2) not null,
  status text not null default 'active',
  current_period_end timestamptz,
  unpaid_since timestamptz,
  commitment_end date,
  created_at timestamptz not null default now()
);

create table ph_domains (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references ph_prospects(id) on delete restrict,
  name text not null unique,
  registrar text not null default 'porkbun',
  status text not null default 'registered',
  expires_at date,
  registrant jsonb,
  forwards jsonb,
  created_at timestamptz not null default now()
);

create table ph_legal_register (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  purpose text not null,
  legal_basis text not null,
  data_categories text not null,
  retention text not null,
  recipients text not null,
  created_at timestamptz not null default now()
);
insert into ph_legal_register (name, purpose, legal_basis, data_categories, retention, recipients) values
 ('Prospection', 'Identifier et contacter par téléphone des entreprises susceptibles d''avoir besoin d''un site', 'Intérêt légitime', 'Dénomination, dirigeants, coordonnées professionnelles, avis publics', 'Rejetés : 30 jours. Perdus : 12 mois. Liste d''opposition : empreinte irréversible', 'Aucun'),
 ('Clients', 'Gestion des devis, contrats, factures et abonnements', 'Exécution du contrat, obligation légale (factures)', 'Identité, coordonnées, données de facturation', 'Factures : 10 ans. Autres : 5 ans après la fin du contrat', 'Stripe (paiement), Porkbun (domaine)'),
 ('Formulaires des sites clients', 'Acheminer les messages des visiteurs au client (sous-traitance)', 'Instruction du client (art. 28 RGPD)', 'Nom, coordonnées, message', '3 ans', 'Client destinataire');

-- updated_at --------------------------------------------------------------------
create or replace function ph_touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;
create trigger ph_prospects_touch before update on ph_prospects for each row execute function ph_touch_updated_at();
create trigger ph_searches_touch before update on ph_searches for each row execute function ph_touch_updated_at();
create trigger ph_settings_touch before update on ph_settings for each row execute function ph_touch_updated_at();

-- RLS : activée partout, aucune politique → seul le service role (serveur) accède.
-- Isolation totale vis-à-vis des autres apps du même projet Supabase.
do $$
declare t text;
begin
  foreach t in array array['ph_settings','ph_searches','ph_prospects','ph_blacklist','ph_activities','ph_ai_jobs',
    'ph_sites','ph_site_versions','ph_form_messages','ph_share_links','ph_share_events','ph_counters','ph_quotes','ph_invoices',
    'ph_credit_notes','ph_subscriptions','ph_domains','ph_legal_register','ph_login_attempts']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon, authenticated', t);
  end loop;
end $$;

revoke execute on function ph_next_number(text) from public, anon, authenticated;
grant execute on function ph_next_number(text) to service_role;

-- Storage : buckets privés, aucune politique → accès service role uniquement.
insert into storage.buckets (id, name, public) values ('ph-assets', 'ph-assets', false), ('ph-documents', 'ph-documents', false)
  on conflict do nothing;

-- 0002 : budget de requêtes Google par recherche
alter table ph_searches add column budget int not null default 1, add column calls int not null default 0;

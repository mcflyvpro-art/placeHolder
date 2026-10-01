-- placeHolder — schéma initial
create extension if not exists pgcrypto;

-- Propriétaire unique ---------------------------------------------------------
create table app_config (
  id boolean primary key default true check (id),
  owner_email text not null
);

create or replace function is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select owner_email from app_config) = (auth.jwt() ->> 'email'), false)
$$;

-- Réglages --------------------------------------------------------------------
create table settings (
  id boolean primary key default true check (id),
  company jsonb not null default '{}'::jsonb,         -- nom, siret, adresse, email, tel, iban, statut
  thresholds jsonb not null default '{}'::jsonb,      -- seuils scoring
  grid jsonb not null default '{}'::jsonb,            -- grilles de prix
  preview_domain text,
  retention_days int not null default 30,
  google_calls_month int not null default 0,
  google_month text not null default to_char(now(), 'YYYY-MM'),
  google_cap int not null default 950,
  updated_at timestamptz not null default now()
);
insert into settings default values;

-- Recherches ------------------------------------------------------------------
create table searches (
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
create table prospects (
  id uuid primary key default gen_random_uuid(),
  search_id uuid references searches(id) on delete set null,
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
create index prospects_triage_priority on prospects (triage, priority desc);
create index prospects_status on prospects (status);
create index prospects_next_action on prospects (next_action_at) where next_action_at is not null;
create index prospects_siren on prospects (siren);

create table blacklist (
  hash text primary key,
  created_at timestamptz not null default now()
);

create table activities (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references prospects(id) on delete cascade,
  kind text not null,          -- call, status, note, share_view, share_like, share_change, quote, payment, site
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activities_prospect on activities (prospect_id, created_at desc);

-- File IA ---------------------------------------------------------------------
create table ai_jobs (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references prospects(id) on delete cascade,
  type text not null check (type in ('analyse','brand_dna','directions')),
  status text not null default 'queued' check (status in ('queued','running','done','error')),
  attempts int not null default 0,
  result jsonb,
  error text,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index ai_jobs_queue on ai_jobs (status, created_at);

-- Sites -----------------------------------------------------------------------
create table sites (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null unique references prospects(id) on delete cascade,
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

create table site_versions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  sha text not null,
  message text,
  url text,
  quality jsonb,              -- {lighthouse:{performance,accessibility,best,seo}, axe, links, slop, legal, todo, passed}
  created_at timestamptz not null default now()
);
create index site_versions_site on site_versions (site_id, created_at desc);

create table form_messages (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  payload jsonb not null,
  forwarded boolean not null default false,
  purge_at timestamptz not null default now() + interval '3 years',
  created_at timestamptz not null default now()
);

-- Lien de présentation --------------------------------------------------------
create table share_links (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references prospects(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  password_hash text,
  views int not null default 0,
  last_view_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table share_events (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references share_links(id) on delete cascade,
  kind text not null check (kind in ('view','like','change_request')),
  device text,
  message text,
  created_at timestamptz not null default now()
);

-- Numérotation sans trou --------------------------------------------------------
create table counters (
  kind text not null,
  year int not null,
  value int not null default 0,
  primary key (kind, year)
);

create or replace function next_number(p_kind text) returns text
language plpgsql security definer set search_path = public as $$
declare
  y int := extract(year from now())::int;
  v int;
begin
  insert into counters(kind, year, value) values (p_kind, y, 0) on conflict do nothing;
  update counters set value = value + 1 where kind = p_kind and year = y returning value into v;
  return p_kind || '-' || y || '-' || lpad(v::text, 3, '0');
end $$;

-- Devis, factures, avoirs -------------------------------------------------------
create table quotes (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references prospects(id) on delete restrict,
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

create table invoices (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references prospects(id) on delete restrict,
  quote_id uuid references quotes(id),
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

create or replace function invoices_immutable() returns trigger
language plpgsql as $$
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
create trigger invoices_immutable before update or delete on invoices
  for each row execute function invoices_immutable();

create table credit_notes (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id),
  number text not null unique,
  total numeric(10,2) not null,
  reason text not null,
  pdf_path text,
  created_at timestamptz not null default now()
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references prospects(id) on delete restrict,
  stripe_customer text,
  stripe_subscription text unique,
  monthly numeric(10,2) not null,
  status text not null default 'active',
  current_period_end timestamptz,
  unpaid_since timestamptz,
  commitment_end date,
  created_at timestamptz not null default now()
);

create table domains (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references prospects(id) on delete restrict,
  name text not null unique,
  registrar text not null default 'porkbun',
  status text not null default 'registered',
  expires_at date,
  registrant jsonb,
  forwards jsonb,
  created_at timestamptz not null default now()
);

create table legal_register (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  purpose text not null,
  legal_basis text not null,
  data_categories text not null,
  retention text not null,
  recipients text not null,
  created_at timestamptz not null default now()
);
insert into legal_register (name, purpose, legal_basis, data_categories, retention, recipients) values
 ('Prospection', 'Identifier et contacter par téléphone des entreprises susceptibles d''avoir besoin d''un site', 'Intérêt légitime', 'Dénomination, dirigeants, coordonnées professionnelles, avis publics', 'Rejetés : 30 jours. Perdus : 12 mois. Liste d''opposition : empreinte irréversible', 'Aucun'),
 ('Clients', 'Gestion des devis, contrats, factures et abonnements', 'Exécution du contrat, obligation légale (factures)', 'Identité, coordonnées, données de facturation', 'Factures : 10 ans. Autres : 5 ans après la fin du contrat', 'Stripe (paiement), Porkbun (domaine)'),
 ('Formulaires des sites clients', 'Acheminer les messages des visiteurs au client (sous-traitance)', 'Instruction du client (art. 28 RGPD)', 'Nom, coordonnées, message', '3 ans', 'Client destinataire');

-- updated_at --------------------------------------------------------------------
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger prospects_touch before update on prospects for each row execute function touch_updated_at();
create trigger searches_touch before update on searches for each row execute function touch_updated_at();
create trigger settings_touch before update on settings for each row execute function touch_updated_at();

-- RLS ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['app_config','settings','searches','prospects','blacklist','activities','ai_jobs',
    'sites','site_versions','form_messages','share_links','share_events','counters','quotes','invoices',
    'credit_notes','subscriptions','domains','legal_register']
  loop
    execute format('alter table %I enable row level security', t);
    if t <> 'app_config' then
      execute format('create policy owner_all on %I for all to authenticated using (is_owner()) with check (is_owner())', t);
    end if;
  end loop;
end $$;

revoke execute on function next_number(text) from public, anon, authenticated;
grant execute on function next_number(text) to service_role;

-- Storage -----------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('assets', 'assets', false), ('documents', 'documents', false)
  on conflict do nothing;
create policy owner_storage on storage.objects for all to authenticated
  using (bucket_id in ('assets','documents') and is_owner())
  with check (bucket_id in ('assets','documents') and is_owner());

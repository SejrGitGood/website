-- Blessings of Valkyriegade: databaseskema
-- Kør denne fil i Supabase -> SQL Editor -> New query -> Run.

create extension if not exists pgcrypto;

-- Kun mailen i denne tabel må læse/skrive noget som helst.
-- Skal være PRÆCIS den samme adresse som den delte konto, du opretter i
-- Supabase (Authentication -> Users), og som står i js/config.js.
create table if not exists allowed_users (
  email text primary key
);

insert into allowed_users (email) values
  ('sejr1234@gmail.com')
on conflict (email) do nothing;

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  number int not null,
  title text not null,
  session_date date,
  summary text not null,
  images text[] not null default '{}',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table sessions add column if not exists images text[] not null default '{}';

create table if not exists lore_entries (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'Andet',
  body text not null,
  images text[] not null default '{}',
  shop_data jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Struktureret data for gemte butiksgenerator-resultater (tier, befolkning,
-- butikker med varer) — så en gemt by kan tegnes som kort igen uden at
-- spørge Open5e på ny. Almindelige lore-indgange lader denne stå tom (null).
alter table lore_entries add column if not exists shop_data jsonb;
alter table lore_entries add column if not exists images text[] not null default '{}';
-- Holdning/omdømme for NPC-indgange (5e's klassiske Fjendtlig..Hjælpsom-skala).
-- Kun meningsfuld for kategori "NPC", ellers null.
alter table lore_entries add column if not exists relationship text;
-- Status for NPC-indgange (Levende/Død/Forsvundet/Ukendt). Samme princip:
-- kun meningsfuld for kategori "NPC", ellers null.
alter table lore_entries add column if not exists status text;

-- Karakterroster, hentet fra D&D Beyond. `data` er en renset opsummering
-- (klasse, HP, ability scores, udstyr, portræt) — kun sat, når karakteren er
-- gjort offentlig på D&D Beyond og hentet. Ellers viser siden bare navnet.
create table if not exists characters (
  id uuid primary key default gen_random_uuid(),
  player_name text not null,
  character_name text not null,
  ddb_character_id bigint not null unique,
  sort_order int not null default 0,
  is_public boolean not null default false,
  data jsonb,
  updated_at timestamptz not null default now()
);
-- Inspiration er tracket her, ikke i `data` — `data` bliver overskrevet ved
-- hver D&D Beyond-synk, så den ville forsvinde igen ved næste "Opdater nu".
alter table characters add column if not exists has_inspiration boolean not null default false;

-- Kort, offentlig teaser til karakteren (ikke fuld baggrundshistorie) — vises
-- for alle, uanset D&D Beyond-synk. Skrives af spilleren selv via
-- min-karakter.html, som bruger en PERSONLIG konto pr. spiller, adskilt fra
-- den delte login. `owner_email` binder karakteren til den personlige konto.
alter table characters add column if not exists teaser text;
alter table characters add column if not exists owner_email text unique;

-- Den fulde, private baggrundshistorie — i en helt separat tabel (ikke bare
-- en kolonne på characters), så RLS nedenfor kan gøre den ulæselig for ALLE
-- andre end ejeren selv, inklusive den delte konto alle fem logger ind med.
create table if not exists character_private_notes (
  character_id uuid primary key references characters(id) on delete cascade,
  owner_email text not null,
  backstory text,
  updated_at timestamptz not null default now()
);

-- Hvilke mails der må oprette en PERSONLIG konto og kræve en karakter via
-- min-karakter.html. Uden denne liste ville policyerne nedenfor ("se ledige
-- karakterer" / "kræv en karakter") gælde for enhver, der selv opretter en
-- konto med den offentlige anon-nøgle (som ligger frit i det offentlige
-- repo) — dvs. hvem som helst på internettet, ikke kun jer fem. Tilføj hver
-- spillers valgte mail her, én gang, når de fortæller dig den:
-- insert into approved_personal_emails (email) values ('spiller@eksempel.dk');
create table if not exists approved_personal_emails (
  email text primary key
);

create table if not exists logistics (
  id int primary key default 1,
  next_session_date timestamptz,
  house_rules text,
  notes text,
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);

insert into logistics (id) values (1) on conflict (id) do nothing;

-- Dag-tæller for kampagnen (Barovia kører på egen kalender, ikke den
-- rigtige verdens dato) — DM'en trykker +/- manuelt, ingen datomatematik.
alter table logistics add column if not exists campaign_day int not null default 1;

-- Fælles bytte/loot: løs liste af fund, hvem der bærer dem, og en delt guldpose.
create table if not exists loot_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  quantity int not null default 1,
  carried_by text,
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists party_treasury (
  id int primary key default 1,
  gold numeric not null default 0,
  notes text,
  updated_at timestamptz not null default now(),
  constraint single_row_treasury check (id = 1)
);

insert into party_treasury (id) values (1) on conflict (id) do nothing;

-- Kort liste over aktive/fuldførte mål, adskilt fra Lore's opslagsværk.
create table if not exists quests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  notes text,
  done boolean not null default false,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Interaktivt kort: et eller flere kortbilleder (uploades via samme
-- billed-pipeline som Ctrl+V-indsætning), med markører der kan linke til en
-- lore-indgang. x/y er procent (0-100) af billedets bredde/højde, så
-- markøren altid rammer rigtigt uanset hvor stort billedet vises.
create table if not exists maps (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  image_url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists map_markers (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references maps(id) on delete cascade,
  x numeric not null,
  y numeric not null,
  label text not null,
  lore_id uuid references lore_entries(id) on delete set null,
  notes text,
  created_by text,
  created_at timestamptz not null default now()
);

alter table sessions enable row level security;
alter table lore_entries enable row level security;
alter table logistics enable row level security;
alter table allowed_users enable row level security;
alter table characters enable row level security;
alter table loot_items enable row level security;
alter table party_treasury enable row level security;
alter table quests enable row level security;
alter table character_private_notes enable row level security;
alter table maps enable row level security;
alter table map_markers enable row level security;
alter table approved_personal_emails enable row level security;

-- Rydder op efter en evt. tidligere, mere åben version af dette skema,
-- så denne fil altid trygt kan køres igen fra toppen.
drop policy if exists "authenticated full access" on sessions;
drop policy if exists "authenticated full access" on lore_entries;
drop policy if exists "authenticated full access" on logistics;
drop policy if exists "read own membership" on allowed_users;
drop policy if exists "allow-listed users only" on sessions;
drop policy if exists "allow-listed users only" on lore_entries;
drop policy if exists "allow-listed users only" on logistics;

-- Enhver logget-ind bruger må slå sin egen mail op (nødvendigt for at policies nedenfor kan tjekke den).
create policy "read own membership" on allowed_users
  for select using (auth.jwt() ->> 'email' = email);

-- Kun mails på listen må læse/skrive sessions, lore og logistik.
create policy "allow-listed users only" on sessions
  for all
  using (exists (select 1 from allowed_users au where au.email = auth.jwt() ->> 'email'))
  with check (exists (select 1 from allowed_users au where au.email = auth.jwt() ->> 'email'));

create policy "allow-listed users only" on lore_entries
  for all
  using (exists (select 1 from allowed_users au where au.email = auth.jwt() ->> 'email'))
  with check (exists (select 1 from allowed_users au where au.email = auth.jwt() ->> 'email'));

create policy "allow-listed users only" on logistics
  for all
  using (exists (select 1 from allowed_users au where au.email = auth.jwt() ->> 'email'))
  with check (exists (select 1 from allowed_users au where au.email = auth.jwt() ->> 'email'));

drop policy if exists "allow-listed users only" on characters;
create policy "allow-listed users only" on characters
  for all
  using (exists (select 1 from allowed_users au where au.email = auth.jwt() ->> 'email'))
  with check (exists (select 1 from allowed_users au where au.email = auth.jwt() ->> 'email'));

drop policy if exists "allow-listed users only" on loot_items;
create policy "allow-listed users only" on loot_items
  for all
  using (exists (select 1 from allowed_users au where au.email = auth.jwt() ->> 'email'))
  with check (exists (select 1 from allowed_users au where au.email = auth.jwt() ->> 'email'));

drop policy if exists "allow-listed users only" on party_treasury;
create policy "allow-listed users only" on party_treasury
  for all
  using (exists (select 1 from allowed_users au where au.email = auth.jwt() ->> 'email'))
  with check (exists (select 1 from allowed_users au where au.email = auth.jwt() ->> 'email'));

drop policy if exists "allow-listed users only" on quests;
create policy "allow-listed users only" on quests
  for all
  using (exists (select 1 from allowed_users au where au.email = auth.jwt() ->> 'email'))
  with check (exists (select 1 from allowed_users au where au.email = auth.jwt() ->> 'email'));

drop policy if exists "allow-listed users only" on maps;
create policy "allow-listed users only" on maps
  for all
  using (exists (select 1 from allowed_users au where au.email = auth.jwt() ->> 'email'))
  with check (exists (select 1 from allowed_users au where au.email = auth.jwt() ->> 'email'));

drop policy if exists "allow-listed users only" on map_markers;
create policy "allow-listed users only" on map_markers
  for all
  using (exists (select 1 from allowed_users au where au.email = auth.jwt() ->> 'email'))
  with check (exists (select 1 from allowed_users au where au.email = auth.jwt() ->> 'email'));

-- --- Personlige konti (min-karakter.html) ---
-- Disse politikker gælder UDOVER "allow-listed users only" ovenfor (Postgres
-- OR'er alle policies for samme kommando sammen) — en personlig konto behøver
-- ALDRIG stå i allowed_users, den kan kun røre sin egen karakterrække.

-- En konto må slå sin egen mail op i godkendelseslisten (nødvendigt for at
-- de to policies nedenfor kan bruge exists(...) til at tjekke den).
drop policy if exists "read own approval" on approved_personal_emails;
create policy "read own approval" on approved_personal_emails
  for select using (auth.jwt() ->> 'email' = email);

-- En spiller, der endnu ikke har valgt sin karakter, må se hvilke rækker der
-- stadig er ledige (owner_email er null), så min-karakter.html kan vise en
-- vælger. KRÆVER at mailen står i approved_personal_emails — ellers ville
-- dette gælde for enhver, der selv opretter en konto med den offentlige
-- anon-nøgle, ikke kun jer fem.
drop policy if exists "select unclaimed characters" on characters;
create policy "select unclaimed characters" on characters
  for select
  using (
    owner_email is null
    and exists (select 1 from approved_personal_emails ape where ape.email = auth.jwt() ->> 'email')
  );

-- Ejeren må altid læse sin egen række (for at forudfylde redigeringsformularen).
drop policy if exists "owner can select own character" on characters;
create policy "owner can select own character" on characters
  for select
  using (auth.jwt() ->> 'email' = owner_email);

-- Selvbetjent "claim": en godkendt personlig konto må sætte sig selv som
-- ejer af en karakter, der endnu ikke er krævet af nogen. Når owner_email
-- først er sat, matcher "unclaimed"-betingelsen (using) ikke længere, så
-- karakteren kan ikke kapres af en anden konto bagefter. Samme
-- godkendelseskrav som ovenfor.
drop policy if exists "claim unclaimed character" on characters;
create policy "claim unclaimed character" on characters
  for update
  using (
    owner_email is null
    and exists (select 1 from approved_personal_emails ape where ape.email = auth.jwt() ->> 'email')
  )
  with check (auth.jwt() ->> 'email' = owner_email);

-- Ejeren må opdatere sin egen karakter (bruges til at gemme teaser).
drop policy if exists "owner can update own character" on characters;
create policy "owner can update own character" on characters
  for update
  using (auth.jwt() ->> 'email' = owner_email)
  with check (auth.jwt() ->> 'email' = owner_email);

-- Privat baggrundshistorie: KUN ejeren selv, ingen andre — heller ikke den
-- delte konto. Bevidst ingen "allow-listed users only"-politik på denne tabel.
drop policy if exists "owner only" on character_private_notes;
create policy "owner only" on character_private_notes
  for all
  using (auth.jwt() ->> 'email' = owner_email)
  with check (auth.jwt() ->> 'email' = owner_email);

-- Vil du senere tilføje eller fjerne en spiller, uden at køre hele filen igen:
-- insert into allowed_users (email) values ('ny@eksempel.dk');
-- delete from allowed_users where email = 'gammel@eksempel.dk';

-- Samme for personlige Min Karakter-konti — kør én gang pr. spiller, når du
-- kender deres valgte mail (kræves FØR de kan vælge/kræve deres karakter):
-- insert into approved_personal_emails (email) values ('spiller@eksempel.dk');

-- Billeder: en offentligt-læsbar bucket (så <img src> altid virker uden ekstra
-- login-håndtering), men kun allow-listede brugere må lægge noget op eller slette.
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

drop policy if exists "allow-listed can upload photos" on storage.objects;
drop policy if exists "allow-listed can delete photos" on storage.objects;

create policy "allow-listed can upload photos" on storage.objects
  for insert
  with check (
    bucket_id = 'photos'
    and exists (select 1 from allowed_users au where au.email = auth.jwt() ->> 'email')
  );

create policy "allow-listed can delete photos" on storage.objects
  for delete
  using (
    bucket_id = 'photos'
    and exists (select 1 from allowed_users au where au.email = auth.jwt() ->> 'email')
  );

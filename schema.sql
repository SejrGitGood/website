-- Daggerford-Krøniken: databaseskema
-- Kør denne fil i Supabase -> SQL Editor -> New query -> Run.

create extension if not exists pgcrypto;

-- Kun mails i denne tabel må læse/skrive noget som helst.
-- Ret listen herunder til jeres fem rigtige mailadresser, FØR du trykker Run.
create table if not exists allowed_users (
  email text primary key
);

insert into allowed_users (email) values
  ('spiller1@eksempel.dk'),
  ('spiller2@eksempel.dk'),
  ('spiller3@eksempel.dk'),
  ('spiller4@eksempel.dk'),
  ('spiller5@eksempel.dk')
on conflict (email) do nothing;

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  number int not null,
  title text not null,
  session_date date,
  summary text not null,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists lore_entries (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'Andet',
  body text not null,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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

alter table sessions enable row level security;
alter table lore_entries enable row level security;
alter table logistics enable row level security;
alter table allowed_users enable row level security;

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

-- Vil du senere tilføje eller fjerne en spiller, uden at køre hele filen igen:
-- insert into allowed_users (email) values ('ny@eksempel.dk');
-- delete from allowed_users where email = 'gammel@eksempel.dk';

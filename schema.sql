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
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table lore_entries add column if not exists images text[] not null default '{}';

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

-- Vil du senere tilføje eller fjerne en spiller, uden at køre hele filen igen:
-- insert into allowed_users (email) values ('ny@eksempel.dk');
-- delete from allowed_users where email = 'gammel@eksempel.dk';

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

-- Daggerford-Krøniken: databaseskema
-- Kør denne fil i Supabase -> SQL Editor -> New query -> Run.

create extension if not exists pgcrypto;

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

-- Alle logget-ind brugere (dvs. de fem af jer, når I er inviteret) må læse og skrive alt.
create policy "authenticated full access" on sessions
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated full access" on lore_entries
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated full access" on logistics
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

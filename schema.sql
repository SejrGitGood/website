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

-- AFLØST af members (se "Personlige konti og roller" længere nede): DM'en
-- godkender nu konti på spillere.html. Tabellen bruges kun til at føre konti,
-- der blev godkendt her før, over som godkendte medlemmer.
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

-- Tid på dagen (Ved Bordet/Tavlen): fire faser pr. kampagnedag — morgen,
-- eftermiddag, aften, nat. Efter natten tæller kampagnedagen op. Sidste korte
-- og lange hvil gemmes som (dag, fase), så man kan se, hvor længe siden det er.
alter table logistics add column if not exists time_of_day text not null default 'morgen';
alter table logistics add column if not exists last_long_rest_day int;
alter table logistics add column if not exists last_long_rest_phase text;
alter table logistics add column if not exists last_short_rest_day int;
alter table logistics add column if not exists last_short_rest_phase text;

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
-- Prioritet ('Høj'/'Normal'/'Lav'), så Ved Bordet kan vise det vigtigste
-- mål øverst under en session i stedet for bare oprettelsesrækkefølge.
alter table quests add column if not exists priority text not null default 'Normal';

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

-- Kampbygger (encounters.html): en kamp bygges som kladde (party + monstre
-- som jsonb), og når den startes, foldes den ud til én række pr. deltager i
-- encounter_combatants, som initiativ, HP og tilstande spores på.
-- status: 'kladde' | 'aktiv' | 'afsluttet'. round 0 = initiativ slås endnu.
create table if not exists encounters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  notes text,
  party jsonb not null default '[]',
  monsters jsonb not null default '[]',
  status text not null default 'kladde',
  round int not null default 0,
  turn_combatant_id uuid,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Spillerkarakterers HP læses live fra characters.data (D&D Beyond), ikke
-- herfra — hp_*-kolonnerne bruges kun for monstre og for karakterer, der
-- ikke er sat til offentlig på D&D Beyond.
create table if not exists encounter_combatants (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references encounters(id) on delete cascade,
  kind text not null,
  character_id uuid references characters(id) on delete set null,
  name text not null,
  initiative int,
  init_bonus int not null default 0,
  hp_current int,
  hp_max int,
  hp_temp int not null default 0,
  ac int,
  xp int not null default 0,
  conditions text[] not null default '{}',
  monster_slug text,
  created_at timestamptz not null default now()
);
-- Frie noter pr. deltager (vises i detaljepanelet) — f.eks. handlingerne for
-- et eget monster, der ikke findes i Open5e.
alter table encounter_combatants add column if not exists notes text;
-- Legendariske handlinger pr. runde (0 = ingen; null = ukendt, ældre rækker)
-- og hvor mange der er brugt, siden monsterets egen tur startede.
alter table encounter_combatants add column if not exists legendary_max int;
alter table encounter_combatants add column if not exists legendary_used int not null default 0;
-- Varighed pr. tilstand: {"Poisoned": {"until": 4, "anchor": "<combatant-id>", "rounds": 3}}
-- = udløber ved starten af anchors tur i runde 4 (uden anchor: ved rundens start).
alter table encounter_combatants add column if not exists condition_timers jsonb not null default '{}';

-- Monsterbibliotek (monsterbibliotek.html): egne monstre og NPC'er med fuld
-- stat block — indsat som tekst og tolket til samme form som Open5e's data
-- (block), så Kampbyggeren kan bruge dem som SRD-monstrene. source er den
-- indsatte tekst og overrides det, der er rettet i hånden (navn, CR, HP …).
-- Ligger bevidst uden for lore_entries, så spillerne ikke ser stats i Lore.
create table if not exists monster_library (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  block jsonb not null default '{}',
  source text,
  overrides jsonb not null default '{}',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Handouts (handouts.html): breve, billeder og kort, som DM'en forbereder og
-- viser for bordet. revealed_at = null betyder forberedt, men ikke vist endnu
-- (kun i DM-visningen). on_table = den, der vises på Tavlen og popper op på
-- Ved Bordet lige nu — højst én ad gangen. shown_at er sidste gang, den blev vist.
create table if not exists handouts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  image_url text,
  revealed_at timestamptz,
  shown_at timestamptz,
  on_table boolean not null default false,
  campaign_day int,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Madam Evas Tarokka-læsning (tarokka.html): fem faste pladser. Kortet og
-- hendes ord ser alle; betydningen (answer) vises først, når DM'en afslører
-- den, og resolved markerer, at tingen er fundet / allieret / konfronteret.
create table if not exists tarokka_reading (
  slot text primary key,
  card text,
  prophecy text,
  answer text,
  answer_revealed boolean not null default false,
  resolved boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into tarokka_reading (slot) values ('tome'), ('symbol'), ('sword'), ('ally'), ('strahd')
on conflict (slot) do nothing;

-- Aftenens log (Ved Bordet): korte noter, skrevet undervejs i en session af
-- hvem som helst ved bordet. session_id er null, så længe noten hører til den
-- åbne log; når loggen laves om til et sessionsreferat, peger noterne på den
-- session (og forsvinder med den, hvis referatet slettes).
create table if not exists session_log_entries (
  id uuid primary key default gen_random_uuid(),
  body text not null,
  author text,
  campaign_day int,
  session_id uuid references sessions(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Tarokka-kortenes betydning ligger i en tabel, kun DM'en kan læse;
-- tarokka_reading.answer udfyldes først, når DM'en afslører den (tarokka.html).
create table if not exists tarokka_answers (
  slot text primary key,
  answer text,
  updated_at timestamptz not null default now()
);
insert into tarokka_answers (slot, answer)
select slot, answer from tarokka_reading where answer is not null
on conflict (slot) do nothing;
update tarokka_reading set answer = null where not answer_revealed;

-- --- Personlige konti og roller ---
-- Alle opretter deres egen konto (login.html) og venter, til DM'en godkender
-- dem (spillere.html). role: 'player' eller 'dm'. status: 'pending',
-- 'approved' eller 'rejected'. Den gamle fælles login (allowed_users) tæller
-- som spiller, indtil DM'en lukker den.
create table if not exists members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  role text not null default 'player' check (role in ('player', 'dm')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

-- Bruges af alle policies nedenfor. security definer, så de kan læse members
-- og allowed_users uden selv at ramme RLS (og uden rekursion i members' egne).
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members m where m.user_id = auth.uid() and m.status = 'approved')
      or exists (select 1 from allowed_users au where au.email = auth.jwt() ->> 'email');
$$;
create or replace function public.is_dm() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members m where m.user_id = auth.uid() and m.status = 'approved' and m.role = 'dm');
$$;

-- Min konto (konto.html): en godkendt konto må ændre sit eget navn — og kun
-- det; rolle og status styrer DM'en. Derfor en funktion frem for en
-- update-politik på members (RLS kan ikke begrænse til én kolonne).
create or replace function public.set_my_name(new_name text) returns void
language sql security definer set search_path = public as $$
  update members set display_name = nullif(left(trim(new_name), 40), '')
  where user_id = auth.uid() and status = 'approved';
$$;
revoke all on function public.set_my_name(text) from public;
grant execute on function public.set_my_name(text) to authenticated;

-- En ny konto bliver automatisk en ventende spiller (navnet sendes med ved oprettelsen).
create or replace function public.handle_new_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.members (user_id, email, display_name)
  values (new.id, new.email, nullif(trim(new.raw_user_meta_data ->> 'name'), ''))
  on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_member();

-- Konti oprettet før dette (via Min Karakter) kommer med: godkendt, hvis mailen
-- var godkendt eller ejer en karakter, og med karakterens spillernavn. Den
-- fælles login springes over — den dækkes af allowed_users.
insert into members (user_id, email, display_name, status, approved_at)
select u.id, u.email,
  coalesce(nullif(trim(u.raw_user_meta_data ->> 'name'), ''), (select c.player_name from characters c where c.owner_email = u.email limit 1)),
  case when ok then 'approved' else 'pending' end,
  case when ok then now() end
from (
  select u.*, (exists (select 1 from approved_personal_emails a where a.email = u.email)
            or exists (select 1 from characters c where c.owner_email = u.email)) as ok
  from auth.users u
) u
where not exists (select 1 from allowed_users au where au.email = u.email)
on conflict (user_id) do nothing;

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
alter table encounters enable row level security;
alter table encounter_combatants enable row level security;
alter table session_log_entries enable row level security;
alter table monster_library enable row level security;
alter table handouts enable row level security;
alter table tarokka_reading enable row level security;
alter table tarokka_answers enable row level security;
alter table members enable row level security;

-- === Adgang (RLS) ===
-- Godkendte medlemmer (spillere og DM) deler alt det, selskabet deler; kun
-- DM'en ser og ændrer DM-værktøjernes data. Den gamle fælles login
-- (allowed_users) tæller som spiller, indtil DM'en lukker den på spillere.html.
-- Idempotent: filen kan stadig køres igen fra toppen.

-- Ryd op efter tidligere versioner af politikkerne.
do $$
declare t text;
begin
  foreach t in array array['sessions', 'lore_entries', 'logistics', 'characters', 'loot_items', 'party_treasury',
    'quests', 'maps', 'map_markers', 'encounters', 'encounter_combatants', 'session_log_entries',
    'monster_library', 'handouts', 'tarokka_reading'] loop
    execute format('drop policy if exists "authenticated full access" on %I', t);
    execute format('drop policy if exists "allow-listed users only" on %I', t);
  end loop;
end $$;
drop policy if exists "select unclaimed characters" on characters;
drop policy if exists "claim unclaimed character" on characters;

-- Enhver logget-ind bruger må slå sin egen mail op (sådan genkendes den fælles login).
drop policy if exists "read own membership" on allowed_users;
create policy "read own membership" on allowed_users
  for select using (auth.jwt() ->> 'email' = email);
-- DM'en må se og lukke den fælles login.
drop policy if exists "dm manages shared login" on allowed_users;
create policy "dm manages shared login" on allowed_users
  for all using ((select public.is_dm())) with check ((select public.is_dm()));

-- Det, hele selskabet deler: godkendte medlemmer må læse og skrive.
do $$
declare t text;
begin
  foreach t in array array['sessions', 'lore_entries', 'logistics', 'characters', 'loot_items', 'party_treasury',
    'quests', 'maps', 'map_markers', 'session_log_entries'] loop
    execute format('drop policy if exists "members only" on %I', t);
    execute format('create policy "members only" on %I for all using ((select public.is_member())) with check ((select public.is_member()))', t);
  end loop;
end $$;

-- Kampe: spillerne ser kampe, der er i gang (Ved Bordet, Tavlen) — ikke DM'ens
-- kladder — og kun DM'en kører dem. (Monstrenes HP kan stadig læses direkte i
-- databasen af den, der ved hvordan; siderne viser dem aldrig for spillerne.)
drop policy if exists "members read running fights" on encounters;
create policy "members read running fights" on encounters
  for select using ((select public.is_member()) and status <> 'kladde');
drop policy if exists "dm runs fights" on encounters;
create policy "dm runs fights" on encounters
  for all using ((select public.is_dm())) with check ((select public.is_dm()));
drop policy if exists "members read combatants" on encounter_combatants;
create policy "members read combatants" on encounter_combatants
  for select using ((select public.is_member()));
drop policy if exists "dm runs combatants" on encounter_combatants;
create policy "dm runs combatants" on encounter_combatants
  for all using ((select public.is_dm())) with check ((select public.is_dm()));

-- Handouts: spillerne ser kun dem, der er vist for bordet; forberedte er DM'ens.
drop policy if exists "members read shown handouts" on handouts;
create policy "members read shown handouts" on handouts
  for select using ((select public.is_member()) and revealed_at is not null);
drop policy if exists "dm manages handouts" on handouts;
create policy "dm manages handouts" on handouts
  for all using ((select public.is_dm())) with check ((select public.is_dm()));

-- Tarokka: alle ser kortene og de afslørede betydninger; kun DM'en redigerer
-- og ser de skjulte (tarokka_answers).
drop policy if exists "members read tarokka" on tarokka_reading;
create policy "members read tarokka" on tarokka_reading
  for select using ((select public.is_member()));
drop policy if exists "dm manages tarokka" on tarokka_reading;
create policy "dm manages tarokka" on tarokka_reading
  for all using ((select public.is_dm())) with check ((select public.is_dm()));
drop policy if exists "dm only" on tarokka_answers;
create policy "dm only" on tarokka_answers
  for all using ((select public.is_dm())) with check ((select public.is_dm()));

-- Monsterbiblioteket er kun DM'ens.
drop policy if exists "dm only" on monster_library;
create policy "dm only" on monster_library
  for all using ((select public.is_dm())) with check ((select public.is_dm()));

-- Medlemmer: man ser altid sin egen række (også mens man venter), godkendte
-- ser hinandens navne, og kun DM'en godkender, ændrer roller og fjerner.
-- Rækker oprettes kun af triggeren, når en konto oprettes.
drop policy if exists "read members" on members;
create policy "read members" on members
  for select using (user_id = auth.uid() or (select public.is_member()));
drop policy if exists "dm manages members" on members;
create policy "dm manages members" on members
  for update using ((select public.is_dm())) with check ((select public.is_dm()));
drop policy if exists "dm removes members" on members;
create policy "dm removes members" on members
  for delete using ((select public.is_dm()));

-- Min Karakter bruger "members only" ovenfor. De gamle ejer-politikker (kun
-- mail-match) er fjernet: uden mailbekræftelse kan enhver oprette en konto med
-- en andens mail, så alt skal også kræve en godkendt konto.
drop policy if exists "owner can select own character" on characters;
drop policy if exists "owner can update own character" on characters;

-- Privat baggrundshistorie: KUN ejeren selv (og kun med en godkendt konto) —
-- ingen andre, heller ikke DM'en.
drop policy if exists "owner only" on character_private_notes;
create policy "owner only" on character_private_notes
  for all
  using (auth.jwt() ->> 'email' = owner_email and (select public.is_member()))
  with check (auth.jwt() ->> 'email' = owner_email and (select public.is_member()));

-- approved_personal_emails er afløst af members (godkendelse på spillere.html)
-- og bruges kun til at føre gamle Min Karakter-konti over.
drop policy if exists "read own approval" on approved_personal_emails;
create policy "read own approval" on approved_personal_emails
  for select using (auth.jwt() ->> 'email' = email);

-- Gør din egen konto til DM (én gang, efter du har oprettet den på login.html):
-- update members set role = 'dm', status = 'approved', approved_at = now() where email = 'din@mail.dk';

-- Billeder: en offentligt-læsbar bucket (så <img src> altid virker uden ekstra
-- login-håndtering), men kun godkendte medlemmer må lægge noget op eller slette.
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

drop policy if exists "allow-listed can upload photos" on storage.objects;
drop policy if exists "allow-listed can delete photos" on storage.objects;
drop policy if exists "members can upload photos" on storage.objects;
drop policy if exists "members can delete photos" on storage.objects;

create policy "members can upload photos" on storage.objects
  for insert
  with check (bucket_id = 'photos' and (select public.is_member()));

create policy "members can delete photos" on storage.objects
  for delete
  using (bucket_id = 'photos' and (select public.is_member()));

-- Live-opdatering (Supabase Realtime) af kamptrackeren og Ved Bordet på tværs
-- af enheder. RLS gælder stadig for hvad hver abonnent får at se. Idempotent:
-- tilføjer kun tabeller, der ikke allerede er med i publikationen.
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['encounters', 'encounter_combatants', 'characters', 'session_log_entries', 'logistics', 'handouts', 'tarokka_reading'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

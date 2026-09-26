-- =====================================================================
-- Mors kalender – databaseoppsett for Supabase
--
-- Kjør hele denne fila i Supabase → SQL Editor på et nytt prosjekt.
-- Den kan trygt kjøres på nytt (idempotent der det er mulig).
--
-- Sikkerhetsmodell:
--   * Bare e-postadresser som står i tabellen `members` får lese eller
--     skrive noe som helst (Row Level Security på alle tabeller).
--   * Roller: admin (legger til/fjerner medlemmer), familie (kan redigere
--     timer og vakter), lege (kan lese alt og skrive kommentarer).
--   * Alt sensitivt innhold (hva slags time, hvor, notater, kommentarer)
--     er kryptert i nettleseren før det sendes hit (kolonnene iv/ct).
--     Serveren – og Supabase – ser bare kryptert tekst.
--   * Alle endringer logges i `audit_log` (hvem, hva, når).
-- =====================================================================

-- ---------- Hjelpefunksjoner -----------------------------------------

create or replace function public.current_email()
returns text
language sql stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

-- ---------- Medlemmer ------------------------------------------------

create table if not exists public.members (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique check (email = lower(email)),
  name        text not null check (length(name) between 1 and 60),
  role        text not null check (role in ('admin', 'familie', 'lege')),
  color       text not null default '#2f5d62' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at  timestamptz not null default now()
);

-- security definer: slår opp rollen uten å gå i loop på members sin RLS
create or replace function public.my_role()
returns text
language sql stable security definer
set search_path = public
as $$
  select role from public.members where email = public.current_email()
$$;

create or replace function public.is_member()
returns boolean language sql stable
as $$ select public.my_role() is not null $$;

create or replace function public.can_edit()
returns boolean language sql stable
as $$ select public.my_role() in ('admin', 'familie') $$;

create or replace function public.is_admin()
returns boolean language sql stable
as $$ select public.my_role() = 'admin' $$;

-- ---------- Krypteringsnøkkel-sjekk ("hvelvet") ----------------------
-- Inneholder bare salt og en kryptert kontrolltekst, slik at appen kan
-- sjekke at familiepassordet er riktig. Selve nøkkelen lagres aldri her.

create table if not exists public.vault (
  id          smallint primary key default 1 check (id = 1),
  salt        text not null,
  iterations  integer not null check (iterations >= 100000),
  check_iv    text not null,
  check_ct    text not null,
  created_by  text not null default public.current_email(),
  created_at  timestamptz not null default now()
);

-- ---------- Timer (lege, tannlege, audiolog …) -----------------------

create table if not exists public.appointments (
  id          uuid primary key default gen_random_uuid(),
  starts_at   timestamptz not null,
  iv          text not null,
  ct          text not null,
  created_by  text not null default public.current_email(),
  created_at  timestamptz not null default now(),
  updated_by  text not null default public.current_email(),
  updated_at  timestamptz not null default now()
);
create index if not exists appointments_starts_at_idx on public.appointments (starts_at);

-- ---------- Vaktordning ----------------------------------------------

create table if not exists public.duties (
  id          uuid primary key default gen_random_uuid(),
  start_date  date not null,
  end_date    date not null,
  member_id   uuid not null references public.members (id) on delete cascade,
  iv          text,
  ct          text,
  created_by  text not null default public.current_email(),
  created_at  timestamptz not null default now(),
  updated_by  text not null default public.current_email(),
  updated_at  timestamptz not null default now(),
  check (end_date >= start_date)
);
create index if not exists duties_start_date_idx on public.duties (start_date);

-- ---------- Kommentarer på timer -------------------------------------

create table if not exists public.comments (
  id              uuid primary key default gen_random_uuid(),
  appointment_id  uuid not null references public.appointments (id) on delete cascade,
  iv              text not null,
  ct              text not null,
  author          text not null default public.current_email(),
  created_at      timestamptz not null default now()
);
create index if not exists comments_appointment_idx on public.comments (appointment_id);

-- ---------- Endringslogg ---------------------------------------------

create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor       text not null,
  table_name  text not null,
  row_id      text not null,
  action      text not null
);

-- ---------- Triggere --------------------------------------------------

-- Hvem som opprettet noe kan ikke forfalskes, og "sist endret av"
-- settes alltid av serveren.
create or replace function public.stamp_row()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := public.current_email();
    new.created_at := now();
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_by := public.current_email();
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists stamp_appointments on public.appointments;
create trigger stamp_appointments before insert or update on public.appointments
  for each row execute function public.stamp_row();

drop trigger if exists stamp_duties on public.duties;
create trigger stamp_duties before insert or update on public.duties
  for each row execute function public.stamp_row();

create or replace function public.stamp_comment()
returns trigger
language plpgsql
as $$
begin
  new.author := public.current_email();
  new.created_at := now();
  return new;
end
$$;

drop trigger if exists stamp_comments on public.comments;
create trigger stamp_comments before insert on public.comments
  for each row execute function public.stamp_comment();

create or replace function public.write_audit()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.audit_log (actor, table_name, row_id, action)
  values (
    public.current_email(),
    tg_table_name,
    coalesce(new.id, old.id)::text,
    lower(tg_op)
  );
  return null;
end
$$;

drop trigger if exists audit_appointments on public.appointments;
create trigger audit_appointments after insert or update or delete on public.appointments
  for each row execute function public.write_audit();

drop trigger if exists audit_duties on public.duties;
create trigger audit_duties after insert or update or delete on public.duties
  for each row execute function public.write_audit();

drop trigger if exists audit_comments on public.comments;
create trigger audit_comments after insert or update or delete on public.comments
  for each row execute function public.write_audit();

drop trigger if exists audit_members on public.members;
create trigger audit_members after insert or update or delete on public.members
  for each row execute function public.write_audit();

-- ---------- Row Level Security ----------------------------------------

alter table public.members      enable row level security;
alter table public.vault        enable row level security;
alter table public.appointments enable row level security;
alter table public.duties       enable row level security;
alter table public.comments     enable row level security;
alter table public.audit_log    enable row level security;

-- Ingen tilgang i det hele tatt for ikke-innloggede
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from anon;

-- members
drop policy if exists members_select on public.members;
create policy members_select on public.members
  for select to authenticated using (public.is_member());
drop policy if exists members_insert on public.members;
create policy members_insert on public.members
  for insert to authenticated with check (public.is_admin());
drop policy if exists members_update on public.members;
create policy members_update on public.members
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists members_delete on public.members;
create policy members_delete on public.members
  for delete to authenticated using (public.is_admin() and email <> public.current_email());

-- vault: alle medlemmer kan lese, bare admin kan opprette (én gang)
drop policy if exists vault_select on public.vault;
create policy vault_select on public.vault
  for select to authenticated using (public.is_member());
drop policy if exists vault_insert on public.vault;
create policy vault_insert on public.vault
  for insert to authenticated with check (public.is_admin());

-- appointments
drop policy if exists appointments_select on public.appointments;
create policy appointments_select on public.appointments
  for select to authenticated using (public.is_member());
drop policy if exists appointments_insert on public.appointments;
create policy appointments_insert on public.appointments
  for insert to authenticated with check (public.can_edit());
drop policy if exists appointments_update on public.appointments;
create policy appointments_update on public.appointments
  for update to authenticated using (public.can_edit()) with check (public.can_edit());
drop policy if exists appointments_delete on public.appointments;
create policy appointments_delete on public.appointments
  for delete to authenticated using (public.can_edit());

-- duties
drop policy if exists duties_select on public.duties;
create policy duties_select on public.duties
  for select to authenticated using (public.is_member());
drop policy if exists duties_insert on public.duties;
create policy duties_insert on public.duties
  for insert to authenticated with check (public.can_edit());
drop policy if exists duties_update on public.duties;
create policy duties_update on public.duties
  for update to authenticated using (public.can_edit()) with check (public.can_edit());
drop policy if exists duties_delete on public.duties;
create policy duties_delete on public.duties
  for delete to authenticated using (public.can_edit());

-- comments: alle medlemmer (også lege) kan skrive; bare egne eller admin kan slettes
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments
  for select to authenticated using (public.is_member());
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments
  for insert to authenticated with check (public.is_member());
drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments
  for delete to authenticated using (author = public.current_email() or public.is_admin());

-- audit_log: kun lesing (skrives bare av triggeren)
drop policy if exists audit_select on public.audit_log;
create policy audit_select on public.audit_log
  for select to authenticated using (public.is_member());

-- ---------- Sanntid ----------------------------------------------------
-- Gjør at alle som har appen åpen får endringer umiddelbart.
-- (Sanntidsmeldinger følger de samme RLS-reglene som over.)

do $$
declare t text;
begin
  foreach t in array array['members', 'appointments', 'duties', 'comments'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;

alter table public.appointments replica identity full;
alter table public.duties       replica identity full;
alter table public.comments     replica identity full;
alter table public.members      replica identity full;

-- =====================================================================
-- TIL SLUTT: legg inn deg selv som første administrator.
-- Bytt ut e-post og navn, fjern "--" foran og kjør linjen:
--
-- insert into public.members (email, name, role, color)
-- values ('din.epost@eksempel.no', 'Ditt navn', 'admin', '#2f5d62');
-- =====================================================================

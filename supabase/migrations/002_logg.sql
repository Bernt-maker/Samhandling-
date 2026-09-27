-- =====================================================================
-- Logg over hendelser (innleggelser, telefonsamtaler, besøk, fall …)
--
-- Kjør denne fila i Supabase → SQL Editor på et prosjekt der
-- schema.sql allerede er kjørt. Kan trygt kjøres flere ganger.
-- =====================================================================

create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null,
  iv          text not null,
  ct          text not null,
  created_by  text not null default public.current_email(),
  created_at  timestamptz not null default now(),
  updated_by  text not null default public.current_email(),
  updated_at  timestamptz not null default now()
);
create index if not exists events_occurred_at_idx on public.events (occurred_at);

drop trigger if exists stamp_events on public.events;
create trigger stamp_events before insert or update on public.events
  for each row execute function public.stamp_row();

drop trigger if exists audit_events on public.events;
create trigger audit_events after insert or update or delete on public.events
  for each row execute function public.write_audit();

alter table public.events enable row level security;
revoke all on public.events from anon;

-- Alle medlemmer (også lege) kan lese og skrive i loggen.
-- Bare den som skrev en hendelse, eller admin, kan endre eller slette den.
drop policy if exists events_select on public.events;
create policy events_select on public.events
  for select to authenticated using (public.is_member());
drop policy if exists events_insert on public.events;
create policy events_insert on public.events
  for insert to authenticated with check (public.is_member());
drop policy if exists events_update on public.events;
create policy events_update on public.events
  for update to authenticated
  using (created_by = public.current_email() or public.is_admin())
  with check (public.is_member());
drop policy if exists events_delete on public.events;
create policy events_delete on public.events
  for delete to authenticated
  using (created_by = public.current_email() or public.is_admin());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'events'
  ) then
    alter publication supabase_realtime add table public.events;
  end if;
end
$$;

alter table public.events replica identity full;

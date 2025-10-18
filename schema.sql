create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;
create table if not exists public.preventivi(
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  numero text unique not null,
  cliente text, articolo text, ddt text, telefono text, email text,
  data_invio date, data_accettazione date, data_scadenza date,
  note text,
  linee jsonb not null default '[]',
  images jsonb not null default '[]',
  totale numeric
);
alter table public.preventivi enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='preventivi' and policyname='anon_read')
  then create policy "anon_read" on public.preventivi for select to anon using (true); end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='preventivi' and policyname='anon_write')
  then create policy "anon_write" on public.preventivi for insert to anon with check (true); end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='preventivi' and policyname='anon_update')
  then create policy "anon_update" on public.preventivi for update to anon using (true) with check (true); end if;
end $$;
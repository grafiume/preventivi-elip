-- Supabase schema for 'preventivi-elip' (run in SQL editor)
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

create table if not exists public.preventivi (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  numero text unique not null,
  cliente text,
  articolo text,
  ddt text,
  telefono text,
  email text,
  data_invio date,
  data_accettazione date,
  data_scadenza date,
  note text,
  linee jsonb not null default '[]',
  images jsonb not null default '[]',
  totale numeric
);

alter table public.preventivi enable row level security;
drop policy if exists "anon_read" on public.preventivi;
drop policy if exists "anon_write" on public.preventivi;
drop policy if exists "anon_update" on public.preventivi;
create policy "anon_read" on public.preventivi for select to anon using (true);
create policy "anon_write" on public.preventivi for insert with check (true);
create policy "anon_update" on public.preventivi for update using (true) with check (true);

-- Storage bucket: creare 'preventivi-img' (public) da Storage UI.

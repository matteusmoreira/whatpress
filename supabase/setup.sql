-- Supabase setup SQL for Whatsapp SaaS
-- This script creates the webhook_events table for storing incoming webhook payloads from the local server

-- Enable pgcrypto for gen_random_uuid (available by default in Supabase)
create extension if not exists pgcrypto;

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  instance text,
  data jsonb not null,
  created_at timestamptz not null default now()
);

-- Indexes to speed up filtering by event and creation time
create index if not exists webhook_events_event_idx on public.webhook_events (event);
create index if not exists webhook_events_created_at_idx on public.webhook_events (created_at);

-- Optional: if you plan to query this table from the frontend, enable RLS and add a read-only policy
-- Row Level Security is enabled by default in Supabase projects for new tables
alter table public.webhook_events enable row level security;

-- Policy example: allow authenticated users to read events
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'webhook_events' and policyname = 'Read events (authenticated)'
  ) then
    create policy "Read events (authenticated)" on public.webhook_events
      for select
      to authenticated
      using (true);
  end if;
end $$;

-- Note: inserts are performed by the backend using the service_role key, which bypasses RLS
-- No insert/update/delete policy is required for service_role operations
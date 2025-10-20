-- Create scheduled_messages table to support scheduled bulk messages
create table if not exists public.scheduled_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instance_id uuid not null references public.whatsapp_instances(id) on delete cascade,
  contact_number varchar(20) not null,
  message text not null,
  media_url text,
  scheduled_at timestamp with time zone not null,
  status text not null check (status in ('pending','scheduled','sent','failed','canceled')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Indexes
create index if not exists scheduled_messages_user_id_idx on public.scheduled_messages(user_id);
create index if not exists scheduled_messages_instance_id_idx on public.scheduled_messages(instance_id);
create index if not exists scheduled_messages_scheduled_at_idx on public.scheduled_messages(scheduled_at);
create index if not exists scheduled_messages_status_idx on public.scheduled_messages(status);

-- Enable Row Level Security and policies
alter table public.scheduled_messages enable row level security;

-- Allow authenticated users to manage their own scheduled messages
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'scheduled_messages' and policyname = 'Manage own scheduled messages'
  ) then
    create policy "Manage own scheduled messages" on public.scheduled_messages
      for all using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end;
$$;
BEGIN;

-- analytics_events table
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL,
  user_id uuid,
  tenant_id uuid,
  session_id text,
  timestamp timestamptz DEFAULT now(),
  properties jsonb DEFAULT '{}'::jsonb,
  context jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users can insert their own events
CREATE POLICY IF NOT EXISTS "analytics_events_insert_authenticated"
  ON public.analytics_events FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Policies: authenticated users can read by tenant or user
CREATE POLICY IF NOT EXISTS "analytics_events_select_authenticated"
  ON public.analytics_events FOR SELECT
  TO authenticated
  USING (
    tenant_id IS NULL OR user_id = auth.uid()
  );

-- Indexes
CREATE INDEX IF NOT EXISTS analytics_events_tenant_id_idx ON public.analytics_events(tenant_id);
CREATE INDEX IF NOT EXISTS analytics_events_timestamp_idx ON public.analytics_events(timestamp);

-- user_profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY, -- equals auth.users.id
  name text,
  company text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Policies: each user can read/update their own profile
CREATE POLICY IF NOT EXISTS "user_profiles_select_self"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY IF NOT EXISTS "user_profiles_update_self"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

COMMIT;


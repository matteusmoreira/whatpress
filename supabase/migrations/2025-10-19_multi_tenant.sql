-- Multi-tenant migration modeled after Astra Campaign
-- Creates tenants, user_tenants, tenant_quotas, global_settings and adds tenant_id to core tables

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tenants
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT,
  plan TEXT DEFAULT 'starter' CHECK (plan IN ('starter','pro','enterprise')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- User-Tenant association with roles
CREATE TABLE IF NOT EXISTS public.user_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('SUPERADMIN','ADMIN','USER')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active','invited','suspended')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);

-- Quotas per tenant
CREATE TABLE IF NOT EXISTS public.tenant_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  max_users INT DEFAULT 5,
  max_instances INT DEFAULT 2,
  max_campaigns INT DEFAULT 50,
  max_messages_per_month INT DEFAULT 10000,
  used_messages_current_month INT DEFAULT 0,
  reset_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id)
);

-- Optional global settings
CREATE TABLE IF NOT EXISTS public.global_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add tenant_id to core tables if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'whatsapp_instances' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.whatsapp_instances ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_tenant_id ON public.whatsapp_instances(tenant_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.contacts ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_contacts_tenant_id ON public.contacts(tenant_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'campaigns' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.campaigns ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_id ON public.campaigns(tenant_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'message_templates' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.message_templates ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_message_templates_tenant_id ON public.message_templates(tenant_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'automations' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.automations ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_automations_tenant_id ON public.automations(tenant_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_messages_tenant_id ON public.messages(tenant_id);
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;

-- Tenant policies
DO $$
BEGIN
  -- Users can read tenants they belong to
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='tenants' AND policyname='Read own tenants'
  ) THEN
    CREATE POLICY "Read own tenants" ON public.tenants FOR SELECT
      TO authenticated
      USING (id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));
  END IF;

  -- SUPERADMIN can manage all tenants (assign via user_tenants.role)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='tenants' AND policyname='Manage tenants (SUPERADMIN)'
  ) THEN
    CREATE POLICY "Manage tenants (SUPERADMIN)" ON public.tenants FOR ALL
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.user_tenants ut WHERE ut.user_id = auth.uid() AND ut.role = 'SUPERADMIN'
      ));
  END IF;

  -- User_tenants: users can view their own associations
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_tenants' AND policyname='Manage own user_tenants'
  ) THEN
    CREATE POLICY "Manage own user_tenants" ON public.user_tenants FOR ALL
      TO authenticated
      USING (user_id = auth.uid());
  END IF;

  -- Tenant_quotas: read by members of tenant; manage by SUPERADMIN/ADMIN of that tenant
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='tenant_quotas' AND policyname='Read quotas (member)'
  ) THEN
    CREATE POLICY "Read quotas (member)" ON public.tenant_quotas FOR SELECT
      TO authenticated
      USING (tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='tenant_quotas' AND policyname='Manage quotas (admin)'
  ) THEN
    CREATE POLICY "Manage quotas (admin)" ON public.tenant_quotas FOR ALL
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.user_tenants ut 
        WHERE ut.user_id = auth.uid() AND ut.tenant_id = tenant_id AND ut.role IN ('SUPERADMIN','ADMIN')
      ));
  END IF;

  -- Global settings: read-only for authenticated, writable by SUPERADMIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='global_settings' AND policyname='Read global settings'
  ) THEN
    CREATE POLICY "Read global settings" ON public.global_settings FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='global_settings' AND policyname='Manage global settings (SUPERADMIN)'
  ) THEN
    CREATE POLICY "Manage global settings (SUPERADMIN)" ON public.global_settings FOR ALL
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.user_tenants ut WHERE ut.user_id = auth.uid() AND ut.role = 'SUPERADMIN'
      ));
  END IF;
END $$;

-- Helper function: ensure updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tenants_updated_at') THEN
    CREATE TRIGGER tenants_updated_at BEFORE UPDATE ON public.tenants
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'global_settings_updated_at') THEN
    CREATE TRIGGER global_settings_updated_at BEFORE UPDATE ON public.global_settings
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;
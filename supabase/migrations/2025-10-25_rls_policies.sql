-- Enable RLS and set tenant-based policies across key tables
-- Assumes tables include tenant_id and campaigns have user relationships via user_tenants

-- Helper: allow authenticated users with membership in user_tenants to access rows with same tenant_id
-- Note: Adjust schema names if not 'public'

-- campaigns
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select_campaigns ON public.campaigns;
DROP POLICY IF EXISTS tenant_modify_campaigns ON public.campaigns;
CREATE POLICY tenant_select_campaigns ON public.campaigns
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_tenants ut
      WHERE ut.user_id = auth.uid() AND ut.tenant_id = public.campaigns.tenant_id
    )
  );
CREATE POLICY tenant_modify_campaigns ON public.campaigns
  FOR INSERT, UPDATE, DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_tenants ut
      WHERE ut.user_id = auth.uid() AND ut.tenant_id = public.campaigns.tenant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_tenants ut
      WHERE ut.user_id = auth.uid() AND ut.tenant_id = public.campaigns.tenant_id
    )
  );

-- campaign_metrics
ALTER TABLE public.campaign_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select_campaign_metrics ON public.campaign_metrics;
DROP POLICY IF EXISTS tenant_modify_campaign_metrics ON public.campaign_metrics;
CREATE POLICY tenant_select_campaign_metrics ON public.campaign_metrics
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_tenants ut
      WHERE ut.user_id = auth.uid() AND ut.tenant_id = public.campaign_metrics.tenant_id
    )
  );
CREATE POLICY tenant_modify_campaign_metrics ON public.campaign_metrics
  FOR INSERT, UPDATE, DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_tenants ut
      WHERE ut.user_id = auth.uid() AND ut.tenant_id = public.campaign_metrics.tenant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_tenants ut
      WHERE ut.user_id = auth.uid() AND ut.tenant_id = public.campaign_metrics.tenant_id
    )
  );

-- message_templates
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select_message_templates ON public.message_templates;
DROP POLICY IF EXISTS tenant_modify_message_templates ON public.message_templates;
CREATE POLICY tenant_select_message_templates ON public.message_templates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_tenants ut
      WHERE ut.user_id = auth.uid() AND ut.tenant_id = public.message_templates.tenant_id
    )
  );
CREATE POLICY tenant_modify_message_templates ON public.message_templates
  FOR INSERT, UPDATE, DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_tenants ut
      WHERE ut.user_id = auth.uid() AND ut.tenant_id = public.message_templates.tenant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_tenants ut
      WHERE ut.user_id = auth.uid() AND ut.tenant_id = public.message_templates.tenant_id
    )
  );

-- contacts
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select_contacts ON public.contacts;
DROP POLICY IF EXISTS tenant_modify_contacts ON public.contacts;
CREATE POLICY tenant_select_contacts ON public.contacts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_tenants ut
      WHERE ut.user_id = auth.uid() AND ut.tenant_id = public.contacts.tenant_id
    )
  );
CREATE POLICY tenant_modify_contacts ON public.contacts
  FOR INSERT, UPDATE, DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_tenants ut
      WHERE ut.user_id = auth.uid() AND ut.tenant_id = public.contacts.tenant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_tenants ut
      WHERE ut.user_id = auth.uid() AND ut.tenant_id = public.contacts.tenant_id
    )
  );

-- message_queue
ALTER TABLE public.message_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select_message_queue ON public.message_queue;
DROP POLICY IF EXISTS tenant_modify_message_queue ON public.message_queue;
CREATE POLICY tenant_select_message_queue ON public.message_queue
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_tenants ut
      WHERE ut.user_id = auth.uid() AND ut.tenant_id = public.message_queue.tenant_id
    )
  );
CREATE POLICY tenant_modify_message_queue ON public.message_queue
  FOR INSERT, UPDATE, DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_tenants ut
      WHERE ut.user_id = auth.uid() AND ut.tenant_id = public.message_queue.tenant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_tenants ut
      WHERE ut.user_id = auth.uid() AND ut.tenant_id = public.message_queue.tenant_id
    )
  );

-- campaign_execution_logs
ALTER TABLE public.campaign_execution_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select_campaign_execution_logs ON public.campaign_execution_logs;
DROP POLICY IF EXISTS tenant_modify_campaign_execution_logs ON public.campaign_execution_logs;
CREATE POLICY tenant_select_campaign_execution_logs ON public.campaign_execution_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_tenants ut
      WHERE ut.user_id = auth.uid() AND ut.tenant_id = public.campaign_execution_logs.tenant_id
    )
  );
CREATE POLICY tenant_modify_campaign_execution_logs ON public.campaign_execution_logs
  FOR INSERT, UPDATE, DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_tenants ut
      WHERE ut.user_id = auth.uid() AND ut.tenant_id = public.campaign_execution_logs.tenant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_tenants ut
      WHERE ut.user_id = auth.uid() AND ut.tenant_id = public.campaign_execution_logs.tenant_id
    )
  );

-- whatsapp_instances
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select_whatsapp_instances ON public.whatsapp_instances;
DROP POLICY IF EXISTS tenant_modify_whatsapp_instances ON public.whatsapp_instances;
CREATE POLICY tenant_select_whatsapp_instances ON public.whatsapp_instances
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_tenants ut
      WHERE ut.user_id = auth.uid() AND ut.tenant_id = public.whatsapp_instances.tenant_id
    )
  );
CREATE POLICY tenant_modify_whatsapp_instances ON public.whatsapp_instances
  FOR INSERT, UPDATE, DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_tenants ut
      WHERE ut.user_id = auth.uid() AND ut.tenant_id = public.whatsapp_instances.tenant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_tenants ut
      WHERE ut.user_id = auth.uid() AND ut.tenant_id = public.whatsapp_instances.tenant_id
    )
  );

-- instance_health_logs (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'instance_health_logs'
  ) THEN
    EXECUTE 'ALTER TABLE public.instance_health_logs ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'DROP POLICY IF EXISTS tenant_select_instance_health_logs ON public.instance_health_logs;';
    EXECUTE 'DROP POLICY IF EXISTS tenant_modify_instance_health_logs ON public.instance_health_logs;';
    EXECUTE 'CREATE POLICY tenant_select_instance_health_logs ON public.instance_health_logs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_tenants ut WHERE ut.user_id = auth.uid() AND ut.tenant_id = public.instance_health_logs.tenant_id));';
    EXECUTE 'CREATE POLICY tenant_modify_instance_health_logs ON public.instance_health_logs FOR INSERT, UPDATE, DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.user_tenants ut WHERE ut.user_id = auth.uid() AND ut.tenant_id = public.instance_health_logs.tenant_id)) WITH CHECK (EXISTS (SELECT 1 FROM public.user_tenants ut WHERE ut.user_id = auth.uid() AND ut.tenant_id = public.instance_health_logs.tenant_id));';
  END IF;
END $$;

-- tenants: allow only users with membership to select their tenant rows
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select_tenants ON public.tenants;
CREATE POLICY tenant_select_tenants ON public.tenants
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_tenants ut
      WHERE ut.user_id = auth.uid() AND ut.tenant_id = public.tenants.id
    )
  );

-- user_tenants: allow users to select their own memberships
ALTER TABLE public.user_tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_select_user_tenants ON public.user_tenants;
DROP POLICY IF EXISTS user_modify_user_tenants ON public.user_tenants;
CREATE POLICY user_select_user_tenants ON public.user_tenants
  FOR SELECT TO authenticated
  USING (public.user_tenants.user_id = auth.uid());
CREATE POLICY user_modify_user_tenants ON public.user_tenants
  FOR INSERT, UPDATE, DELETE TO authenticated
  USING (public.user_tenants.user_id = auth.uid())
  WITH CHECK (public.user_tenants.user_id = auth.uid());

-- Important: service role bypasses RLS, used by serverless worker (scheduler)
-- Make sure SUPABASE_SERVICE_ROLE_KEY is set in production envs
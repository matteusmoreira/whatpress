-- Sistema de Roles Aprimorado - Baseado no Astra Campaign
-- Adiciona controle granular de permissões e funções auxiliares

-- Função para verificar se usuário é SUPERADMIN
CREATE OR REPLACE FUNCTION public.is_superadmin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_tenants ut 
    WHERE ut.user_id = COALESCE(user_id, auth.uid()) 
    AND ut.role = 'SUPERADMIN'
    AND ut.status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar se usuário é ADMIN de um tenant específico
CREATE OR REPLACE FUNCTION public.is_tenant_admin(tenant_id UUID, user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_tenants ut 
    WHERE ut.user_id = COALESCE(user_id, auth.uid()) 
    AND ut.tenant_id = tenant_id
    AND ut.role IN ('SUPERADMIN', 'ADMIN')
    AND ut.status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar se usuário pertence a um tenant
CREATE OR REPLACE FUNCTION public.is_tenant_member(tenant_id UUID, user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_tenants ut 
    WHERE ut.user_id = COALESCE(user_id, auth.uid()) 
    AND ut.tenant_id = tenant_id
    AND ut.status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter role do usuário em um tenant
CREATE OR REPLACE FUNCTION public.get_user_role(tenant_id UUID, user_id UUID DEFAULT auth.uid())
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT ut.role INTO user_role
  FROM public.user_tenants ut 
  WHERE ut.user_id = COALESCE(user_id, auth.uid()) 
  AND ut.tenant_id = tenant_id
  AND ut.status = 'active';
  
  RETURN COALESCE(user_role, 'NONE');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter todos os tenants do usuário com suas roles
CREATE OR REPLACE FUNCTION public.get_user_tenants(user_id UUID DEFAULT auth.uid())
RETURNS TABLE (
  tenant_id UUID,
  tenant_name TEXT,
  tenant_plan TEXT,
  tenant_status TEXT,
  user_role TEXT,
  user_status TEXT,
  joined_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id as tenant_id,
    t.name as tenant_name,
    t.plan as tenant_plan,
    t.status as tenant_status,
    ut.role as user_role,
    ut.status as user_status,
    ut.created_at as joined_at
  FROM public.user_tenants ut
  JOIN public.tenants t ON t.id = ut.tenant_id
  WHERE ut.user_id = COALESCE(user_id, auth.uid())
  AND ut.status = 'active'
  ORDER BY ut.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Tabela de permissões por role
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL CHECK (role IN ('SUPERADMIN','ADMIN','USER')),
  resource TEXT NOT NULL, -- ex: 'campaigns', 'contacts', 'whatsapp', 'analytics', etc.
  action TEXT NOT NULL, -- ex: 'create', 'read', 'update', 'delete', 'manage'
  allowed BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(role, resource, action)
);

-- Inserir permissões padrão
INSERT INTO public.role_permissions (role, resource, action, allowed) VALUES
-- SUPERADMIN - Acesso total
('SUPERADMIN', 'tenants', 'create', true),
('SUPERADMIN', 'tenants', 'read', true),
('SUPERADMIN', 'tenants', 'update', true),
('SUPERADMIN', 'tenants', 'delete', true),
('SUPERADMIN', 'tenants', 'manage', true),
('SUPERADMIN', 'users', 'create', true),
('SUPERADMIN', 'users', 'read', true),
('SUPERADMIN', 'users', 'update', true),
('SUPERADMIN', 'users', 'delete', true),
('SUPERADMIN', 'users', 'manage', true),
('SUPERADMIN', 'quotas', 'create', true),
('SUPERADMIN', 'quotas', 'read', true),
('SUPERADMIN', 'quotas', 'update', true),
('SUPERADMIN', 'quotas', 'delete', true),
('SUPERADMIN', 'quotas', 'manage', true),
('SUPERADMIN', 'campaigns', 'create', true),
('SUPERADMIN', 'campaigns', 'read', true),
('SUPERADMIN', 'campaigns', 'update', true),
('SUPERADMIN', 'campaigns', 'delete', true),
('SUPERADMIN', 'campaigns', 'manage', true),
('SUPERADMIN', 'contacts', 'create', true),
('SUPERADMIN', 'contacts', 'read', true),
('SUPERADMIN', 'contacts', 'update', true),
('SUPERADMIN', 'contacts', 'delete', true),
('SUPERADMIN', 'contacts', 'manage', true),
('SUPERADMIN', 'whatsapp', 'create', true),
('SUPERADMIN', 'whatsapp', 'read', true),
('SUPERADMIN', 'whatsapp', 'update', true),
('SUPERADMIN', 'whatsapp', 'delete', true),
('SUPERADMIN', 'whatsapp', 'manage', true),
('SUPERADMIN', 'analytics', 'read', true),
('SUPERADMIN', 'settings', 'read', true),
('SUPERADMIN', 'settings', 'update', true),

-- ADMIN - Gerencia seu tenant
('ADMIN', 'users', 'create', true),
('ADMIN', 'users', 'read', true),
('ADMIN', 'users', 'update', true),
('ADMIN', 'users', 'delete', true),
('ADMIN', 'quotas', 'read', true),
('ADMIN', 'campaigns', 'create', true),
('ADMIN', 'campaigns', 'read', true),
('ADMIN', 'campaigns', 'update', true),
('ADMIN', 'campaigns', 'delete', true),
('ADMIN', 'campaigns', 'manage', true),
('ADMIN', 'contacts', 'create', true),
('ADMIN', 'contacts', 'read', true),
('ADMIN', 'contacts', 'update', true),
('ADMIN', 'contacts', 'delete', true),
('ADMIN', 'contacts', 'manage', true),
('ADMIN', 'whatsapp', 'create', true),
('ADMIN', 'whatsapp', 'read', true),
('ADMIN', 'whatsapp', 'update', true),
('ADMIN', 'whatsapp', 'delete', true),
('ADMIN', 'whatsapp', 'manage', true),
('ADMIN', 'analytics', 'read', true),
('ADMIN', 'settings', 'read', true),
('ADMIN', 'settings', 'update', true),

-- USER - Acesso limitado
('USER', 'campaigns', 'create', true),
('USER', 'campaigns', 'read', true),
('USER', 'campaigns', 'update', false),
('USER', 'campaigns', 'delete', false),
('USER', 'contacts', 'create', true),
('USER', 'contacts', 'read', true),
('USER', 'contacts', 'update', true),
('USER', 'contacts', 'delete', false),
('USER', 'whatsapp', 'read', true),
('USER', 'analytics', 'read', true),
('USER', 'settings', 'read', true)
ON CONFLICT (role, resource, action) DO NOTHING;

-- Função para verificar permissão
CREATE OR REPLACE FUNCTION public.has_permission(
  user_id UUID,
  tenant_id UUID,
  resource TEXT,
  action TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
  has_perm BOOLEAN := false;
BEGIN
  -- Obter role do usuário no tenant
  user_role := public.get_user_role(tenant_id, user_id);
  
  -- Se não tem role, não tem permissão
  IF user_role = 'NONE' THEN
    RETURN false;
  END IF;
  
  -- Verificar permissão na tabela
  SELECT rp.allowed INTO has_perm
  FROM public.role_permissions rp
  WHERE rp.role = user_role
  AND rp.resource = resource
  AND rp.action = action;
  
  RETURN COALESCE(has_perm, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Tabela de auditoria de ações
CREATE TABLE IF NOT EXISTS public.user_actions_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  tenant_id UUID REFERENCES public.tenants(id),
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Função para registrar ação
CREATE OR REPLACE FUNCTION public.log_user_action(
  p_user_id UUID,
  p_tenant_id UUID,
  p_action TEXT,
  p_resource TEXT,
  p_resource_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.user_actions_log (
    user_id, tenant_id, action, resource, resource_id, details
  ) VALUES (
    p_user_id, p_tenant_id, p_action, p_resource, p_resource_id, p_details
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- RLS para novas tabelas
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_actions_log ENABLE ROW LEVEL SECURITY;

-- Políticas para role_permissions (somente leitura para todos autenticados)
CREATE POLICY "Read role permissions" ON public.role_permissions FOR SELECT
  TO authenticated USING (true);

-- Políticas para user_actions_log
CREATE POLICY "Read own actions log" ON public.user_actions_log FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR 
    public.is_superadmin() OR
    (tenant_id IS NOT NULL AND public.is_tenant_admin(tenant_id))
  );

CREATE POLICY "Insert own actions log" ON public.user_actions_log FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Atualizar políticas existentes para usar as novas funções
DROP POLICY IF EXISTS "Manage tenants (SUPERADMIN)" ON public.tenants;
CREATE POLICY "Manage tenants (SUPERADMIN)" ON public.tenants FOR ALL
  TO authenticated
  USING (public.is_superadmin());

DROP POLICY IF EXISTS "Manage quotas (admin)" ON public.tenant_quotas;
CREATE POLICY "Manage quotas (admin)" ON public.tenant_quotas FOR ALL
  TO authenticated
  USING (public.is_superadmin() OR public.is_tenant_admin(tenant_id));

DROP POLICY IF EXISTS "Manage global settings (SUPERADMIN)" ON public.global_settings;
CREATE POLICY "Manage global settings (SUPERADMIN)" ON public.global_settings FOR ALL
  TO authenticated
  USING (public.is_superadmin());

-- Atualizar políticas das tabelas principais para usar as novas funções
DO $$
BEGIN
  -- WhatsApp Instances
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'whatsapp_instances') THEN
    DROP POLICY IF EXISTS "Tenant isolation whatsapp_instances" ON public.whatsapp_instances;
    CREATE POLICY "Tenant isolation whatsapp_instances" ON public.whatsapp_instances FOR ALL
      TO authenticated
      USING (public.is_superadmin() OR public.is_tenant_member(tenant_id));
  END IF;

  -- Contacts
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contacts') THEN
    DROP POLICY IF EXISTS "Tenant isolation contacts" ON public.contacts;
    CREATE POLICY "Tenant isolation contacts" ON public.contacts FOR ALL
      TO authenticated
      USING (public.is_superadmin() OR public.is_tenant_member(tenant_id));
  END IF;

  -- Campaigns
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaigns') THEN
    DROP POLICY IF EXISTS "Tenant isolation campaigns" ON public.campaigns;
    CREATE POLICY "Tenant isolation campaigns" ON public.campaigns FOR ALL
      TO authenticated
      USING (public.is_superadmin() OR public.is_tenant_member(tenant_id));
  END IF;

  -- Message Templates
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'message_templates') THEN
    DROP POLICY IF EXISTS "Tenant isolation message_templates" ON public.message_templates;
    CREATE POLICY "Tenant isolation message_templates" ON public.message_templates FOR ALL
      TO authenticated
      USING (public.is_superadmin() OR public.is_tenant_member(tenant_id));
  END IF;

  -- Automations
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'automations') THEN
    DROP POLICY IF EXISTS "Tenant isolation automations" ON public.automations;
    CREATE POLICY "Tenant isolation automations" ON public.automations FOR ALL
      TO authenticated
      USING (public.is_superadmin() OR public.is_tenant_member(tenant_id));
  END IF;

  -- Messages
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages') THEN
    DROP POLICY IF EXISTS "Tenant isolation messages" ON public.messages;
    CREATE POLICY "Tenant isolation messages" ON public.messages FOR ALL
      TO authenticated
      USING (public.is_superadmin() OR public.is_tenant_member(tenant_id));
  END IF;
END $$;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_resource ON public.role_permissions(resource);
CREATE INDEX IF NOT EXISTS idx_user_actions_log_user_id ON public.user_actions_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_actions_log_tenant_id ON public.user_actions_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_actions_log_created_at ON public.user_actions_log(created_at);

-- Comentários para documentação
COMMENT ON FUNCTION public.is_superadmin IS 'Verifica se o usuário é SUPERADMIN';
COMMENT ON FUNCTION public.is_tenant_admin IS 'Verifica se o usuário é ADMIN de um tenant específico';
COMMENT ON FUNCTION public.is_tenant_member IS 'Verifica se o usuário pertence a um tenant';
COMMENT ON FUNCTION public.get_user_role IS 'Obtém a role do usuário em um tenant';
COMMENT ON FUNCTION public.get_user_tenants IS 'Obtém todos os tenants do usuário com suas roles';
COMMENT ON FUNCTION public.has_permission IS 'Verifica se o usuário tem permissão para uma ação específica';
COMMENT ON FUNCTION public.log_user_action IS 'Registra uma ação do usuário para auditoria';

COMMENT ON TABLE public.role_permissions IS 'Define as permissões por role no sistema';
COMMENT ON TABLE public.user_actions_log IS 'Log de auditoria das ações dos usuários';
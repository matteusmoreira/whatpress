-- Enhanced Quota System Migration
-- Expande o sistema de quotas existente com funcionalidades avançadas

-- Verificar se a tabela tenant_quotas já existe e expandir se necessário
DO $$
BEGIN
  -- Adicionar colunas de quota se não existirem
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_quotas' AND column_name = 'max_users') THEN
    ALTER TABLE public.tenant_quotas ADD COLUMN max_users INTEGER DEFAULT 5;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_quotas' AND column_name = 'max_contacts') THEN
    ALTER TABLE public.tenant_quotas ADD COLUMN max_contacts INTEGER DEFAULT 1000;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_quotas' AND column_name = 'max_campaigns') THEN
    ALTER TABLE public.tenant_quotas ADD COLUMN max_campaigns INTEGER DEFAULT 10;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_quotas' AND column_name = 'max_connections') THEN
    ALTER TABLE public.tenant_quotas ADD COLUMN max_connections INTEGER DEFAULT 2;
  END IF;
  
  -- Contadores de uso atual
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_quotas' AND column_name = 'current_users') THEN
    ALTER TABLE public.tenant_quotas ADD COLUMN current_users INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_quotas' AND column_name = 'current_contacts') THEN
    ALTER TABLE public.tenant_quotas ADD COLUMN current_contacts INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_quotas' AND column_name = 'current_campaigns') THEN
    ALTER TABLE public.tenant_quotas ADD COLUMN current_campaigns INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_quotas' AND column_name = 'current_connections') THEN
    ALTER TABLE public.tenant_quotas ADD COLUMN current_connections INTEGER DEFAULT 0;
  END IF;
  
  -- Configurações de alertas
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_quotas' AND column_name = 'alert_85_enabled') THEN
    ALTER TABLE public.tenant_quotas ADD COLUMN alert_85_enabled BOOLEAN DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_quotas' AND column_name = 'alert_100_enabled') THEN
    ALTER TABLE public.tenant_quotas ADD COLUMN alert_100_enabled BOOLEAN DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_quotas' AND column_name = 'last_alert_85') THEN
    ALTER TABLE public.tenant_quotas ADD COLUMN last_alert_85 TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_quotas' AND column_name = 'last_alert_100') THEN
    ALTER TABLE public.tenant_quotas ADD COLUMN last_alert_100 TIMESTAMPTZ;
  END IF;
  
  -- Status de bloqueio
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_quotas' AND column_name = 'blocked_features') THEN
    ALTER TABLE public.tenant_quotas ADD COLUMN blocked_features JSONB DEFAULT '[]'::jsonb;
  END IF;
  
  -- Timestamps
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_quotas' AND column_name = 'updated_at') THEN
    ALTER TABLE public.tenant_quotas ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

-- Criar tabela de histórico de alertas de quota
CREATE TABLE IF NOT EXISTS public.quota_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('85_percent', '100_percent')),
  resource_type TEXT NOT NULL CHECK (resource_type IN ('users', 'contacts', 'campaigns', 'connections')),
  current_usage INTEGER NOT NULL,
  max_limit INTEGER NOT NULL,
  percentage DECIMAL(5,2) NOT NULL,
  message TEXT NOT NULL,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_quota_alerts_tenant_id ON public.quota_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quota_alerts_created_at ON public.quota_alerts(created_at);

-- Função para calcular percentual de uso
DROP FUNCTION IF EXISTS public.calculate_quota_percentage(INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION public.calculate_quota_percentage(current_val INTEGER, max_val INTEGER)
RETURNS DECIMAL(5,2) AS $$
BEGIN
  IF max_val = 0 OR max_val IS NULL THEN
    RETURN 0;
  END IF;
  RETURN ROUND((current_val::DECIMAL / max_val::DECIMAL) * 100, 2);
END;
$$ LANGUAGE plpgsql;

-- Função para verificar se deve enviar alerta
CREATE OR REPLACE FUNCTION public.should_send_quota_alert(
  tenant_uuid UUID,
  resource_type TEXT,
  alert_type TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  last_alert TIMESTAMPTZ;
  alert_cooldown INTERVAL := '1 hour'; -- Cooldown de 1 hora entre alertas
BEGIN
  -- Buscar último alerta do mesmo tipo
  SELECT created_at INTO last_alert
  FROM public.quota_alerts
  WHERE tenant_id = tenant_uuid
    AND resource_type = should_send_quota_alert.resource_type
    AND alert_type = should_send_quota_alert.alert_type
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Se nunca enviou alerta ou passou do cooldown
  RETURN (last_alert IS NULL OR (now() - last_alert) > alert_cooldown);
END;
$$ LANGUAGE plpgsql;

-- Função para atualizar contadores de quota automaticamente
CREATE OR REPLACE FUNCTION public.update_tenant_quota_counters(tenant_uuid UUID)
RETURNS VOID AS $$
DECLARE
  users_count INTEGER;
  contacts_count INTEGER;
  campaigns_count INTEGER;
  connections_count INTEGER;
BEGIN
  -- Contar usuários do tenant
  SELECT COUNT(*) INTO users_count
  FROM public.user_tenants
  WHERE tenant_id = tenant_uuid;
  
  -- Contar contatos do tenant
  SELECT COUNT(*) INTO contacts_count
  FROM public.contacts
  WHERE tenant_id = tenant_uuid;
  
  -- Contar campanhas do tenant
  SELECT COUNT(*) INTO campaigns_count
  FROM public.campaigns
  WHERE tenant_id = tenant_uuid;
  
  -- Contar conexões WhatsApp do tenant
  SELECT COUNT(*) INTO connections_count
  FROM public.whatsapp_instances
  WHERE tenant_id = tenant_uuid;
  
  -- Atualizar contadores na tabela tenant_quotas
  UPDATE public.tenant_quotas
  SET 
    current_users = users_count,
    current_contacts = contacts_count,
    current_campaigns = campaigns_count,
    current_connections = connections_count,
    updated_at = now()
  WHERE tenant_id = tenant_uuid;
  
  -- Se não existe registro de quota para o tenant, criar um
  IF NOT FOUND THEN
    INSERT INTO public.tenant_quotas (
      tenant_id,
      current_users,
      current_contacts,
      current_campaigns,
      current_connections
    ) VALUES (
      tenant_uuid,
      users_count,
      contacts_count,
      campaigns_count,
      connections_count
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Função para verificar e criar alertas de quota
CREATE OR REPLACE FUNCTION public.check_and_create_quota_alerts(tenant_uuid UUID)
RETURNS VOID AS $$
DECLARE
  quota_record RECORD;
  alert_message TEXT;
  percentage DECIMAL(5,2);
BEGIN
  -- Buscar dados de quota do tenant
  SELECT * INTO quota_record
  FROM public.tenant_quotas
  WHERE tenant_id = tenant_uuid;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Verificar cada tipo de recurso
  
  -- USUÁRIOS
  percentage := public.calculate_quota_percentage(quota_record.current_users, quota_record.max_users);
  
  IF percentage >= 100 AND public.should_send_quota_alert(tenant_uuid, 'users', '100_percent') THEN
    alert_message := format('Limite de usuários atingido: %s/%s (100%%)', quota_record.current_users, quota_record.max_users);
    INSERT INTO public.quota_alerts (tenant_id, alert_type, resource_type, current_usage, max_limit, percentage, message)
    VALUES (tenant_uuid, '100_percent', 'users', quota_record.current_users, quota_record.max_users, percentage, alert_message);
  ELSIF percentage >= 85 AND public.should_send_quota_alert(tenant_uuid, 'users', '85_percent') THEN
    alert_message := format('Limite de usuários próximo: %s/%s (%.1f%%)', quota_record.current_users, quota_record.max_users, percentage);
    INSERT INTO public.quota_alerts (tenant_id, alert_type, resource_type, current_usage, max_limit, percentage, message)
    VALUES (tenant_uuid, '85_percent', 'users', quota_record.current_users, quota_record.max_users, percentage, alert_message);
  END IF;
  
  -- CONTATOS
  percentage := public.calculate_quota_percentage(quota_record.current_contacts, quota_record.max_contacts);
  
  IF percentage >= 100 AND public.should_send_quota_alert(tenant_uuid, 'contacts', '100_percent') THEN
    alert_message := format('Limite de contatos atingido: %s/%s (100%%)', quota_record.current_contacts, quota_record.max_contacts);
    INSERT INTO public.quota_alerts (tenant_id, alert_type, resource_type, current_usage, max_limit, percentage, message)
    VALUES (tenant_uuid, '100_percent', 'contacts', quota_record.current_contacts, quota_record.max_contacts, percentage, alert_message);
  ELSIF percentage >= 85 AND public.should_send_quota_alert(tenant_uuid, 'contacts', '85_percent') THEN
    alert_message := format('Limite de contatos próximo: %s/%s (%.1f%%)', quota_record.current_contacts, quota_record.max_contacts, percentage);
    INSERT INTO public.quota_alerts (tenant_id, alert_type, resource_type, current_usage, max_limit, percentage, message)
    VALUES (tenant_uuid, '85_percent', 'contacts', quota_record.current_contacts, quota_record.max_contacts, percentage, alert_message);
  END IF;
  
  -- CAMPANHAS
  percentage := public.calculate_quota_percentage(quota_record.current_campaigns, quota_record.max_campaigns);
  
  IF percentage >= 100 AND public.should_send_quota_alert(tenant_uuid, 'campaigns', '100_percent') THEN
    alert_message := format('Limite de campanhas atingido: %s/%s (100%%)', quota_record.current_campaigns, quota_record.max_campaigns);
    INSERT INTO public.quota_alerts (tenant_id, alert_type, resource_type, current_usage, max_limit, percentage, message)
    VALUES (tenant_uuid, '100_percent', 'campaigns', quota_record.current_campaigns, quota_record.max_campaigns, percentage, alert_message);
  ELSIF percentage >= 85 AND public.should_send_quota_alert(tenant_uuid, 'campaigns', '85_percent') THEN
    alert_message := format('Limite de campanhas próximo: %s/%s (%.1f%%)', quota_record.current_campaigns, quota_record.max_campaigns, percentage);
    INSERT INTO public.quota_alerts (tenant_id, alert_type, resource_type, current_usage, max_limit, percentage, message)
    VALUES (tenant_uuid, '85_percent', 'campaigns', quota_record.current_campaigns, quota_record.max_campaigns, percentage, alert_message);
  END IF;
  
  -- CONEXÕES
  percentage := public.calculate_quota_percentage(quota_record.current_connections, quota_record.max_connections);
  
  IF percentage >= 100 AND public.should_send_quota_alert(tenant_uuid, 'connections', '100_percent') THEN
    alert_message := format('Limite de conexões atingido: %s/%s (100%%)', quota_record.current_connections, quota_record.max_connections);
    INSERT INTO public.quota_alerts (tenant_id, alert_type, resource_type, current_usage, max_limit, percentage, message)
    VALUES (tenant_uuid, '100_percent', 'connections', quota_record.current_connections, quota_record.max_connections, percentage, alert_message);
  ELSIF percentage >= 85 AND public.should_send_quota_alert(tenant_uuid, 'connections', '85_percent') THEN
    alert_message := format('Limite de conexões próximo: %s/%s (%.1f%%)', quota_record.current_connections, quota_record.max_connections, percentage);
    INSERT INTO public.quota_alerts (tenant_id, alert_type, resource_type, current_usage, max_limit, percentage, message)
    VALUES (tenant_uuid, '85_percent', 'connections', quota_record.current_connections, quota_record.max_connections, percentage, alert_message);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar contadores automaticamente
CREATE OR REPLACE FUNCTION public.trigger_update_quota_counters()
RETURNS TRIGGER AS $$
BEGIN
  -- Determinar tenant_id baseado na tabela
  IF TG_TABLE_NAME = 'user_tenants' THEN
    PERFORM public.update_tenant_quota_counters(COALESCE(NEW.tenant_id, OLD.tenant_id));
  ELSIF TG_TABLE_NAME = 'contacts' THEN
    PERFORM public.update_tenant_quota_counters(COALESCE(NEW.tenant_id, OLD.tenant_id));
  ELSIF TG_TABLE_NAME = 'campaigns' THEN
    PERFORM public.update_tenant_quota_counters(COALESCE(NEW.tenant_id, OLD.tenant_id));
  ELSIF TG_TABLE_NAME = 'whatsapp_instances' THEN
    PERFORM public.update_tenant_quota_counters(COALESCE(NEW.tenant_id, OLD.tenant_id));
  END IF;
  
  -- Verificar alertas após atualizar contadores
  PERFORM public.check_and_create_quota_alerts(COALESCE(NEW.tenant_id, OLD.tenant_id));
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Criar triggers para atualização automática de quotas
DROP TRIGGER IF EXISTS trigger_quota_user_tenants ON public.user_tenants;
CREATE TRIGGER trigger_quota_user_tenants
  AFTER INSERT OR UPDATE OR DELETE ON public.user_tenants
  FOR EACH ROW EXECUTE FUNCTION public.trigger_update_quota_counters();

DROP TRIGGER IF EXISTS trigger_quota_contacts ON public.contacts;
CREATE TRIGGER trigger_quota_contacts
  AFTER INSERT OR UPDATE OR DELETE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.trigger_update_quota_counters();

DROP TRIGGER IF EXISTS trigger_quota_campaigns ON public.campaigns;
CREATE TRIGGER trigger_quota_campaigns
  AFTER INSERT OR UPDATE OR DELETE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.trigger_update_quota_counters();

DROP TRIGGER IF EXISTS trigger_quota_whatsapp_instances ON public.whatsapp_instances;
CREATE TRIGGER trigger_quota_whatsapp_instances
  AFTER INSERT OR UPDATE OR DELETE ON public.whatsapp_instances
  FOR EACH ROW EXECUTE FUNCTION public.trigger_update_quota_counters();

-- RLS para quota_alerts
ALTER TABLE public.quota_alerts ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para quota_alerts
DROP POLICY IF EXISTS "Read quota alerts (member)" ON public.quota_alerts;
CREATE POLICY "Read quota alerts (member)" ON public.quota_alerts FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Manage quota alerts (ADMIN)" ON public.quota_alerts;
CREATE POLICY "Manage quota alerts (ADMIN)" ON public.quota_alerts FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT ut.tenant_id 
      FROM public.user_tenants ut 
      WHERE ut.user_id = auth.uid() 
      AND ut.role IN ('ADMIN', 'SUPERADMIN')
    )
  );

-- Inicializar quotas para tenants existentes
DO $$
DECLARE
  tenant_record RECORD;
BEGIN
  FOR tenant_record IN SELECT id FROM public.tenants LOOP
    PERFORM public.update_tenant_quota_counters(tenant_record.id);
  END LOOP;
END $$;

-- Comentários para documentação
COMMENT ON TABLE public.quota_alerts IS 'Histórico de alertas de quota por tenant';
COMMENT ON FUNCTION public.calculate_quota_percentage IS 'Calcula percentual de uso de quota';
COMMENT ON FUNCTION public.update_tenant_quota_counters IS 'Atualiza contadores de uso de quota automaticamente';
COMMENT ON FUNCTION public.check_and_create_quota_alerts IS 'Verifica limites e cria alertas quando necessário';
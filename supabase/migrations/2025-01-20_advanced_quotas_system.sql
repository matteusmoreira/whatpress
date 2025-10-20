-- Sistema de Quotas Avançado - Baseado no Astra Campaign
-- Adiciona controle detalhado de quotas, alertas automáticos e limites por tenant

-- Aprimorar tabela de quotas com mais campos detalhados
ALTER TABLE public.tenant_quotas 
ADD COLUMN IF NOT EXISTS max_contacts INT DEFAULT 1000,
ADD COLUMN IF NOT EXISTS used_contacts INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_whatsapp_connections INT DEFAULT 2,
ADD COLUMN IF NOT EXISTS used_whatsapp_connections INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_message_templates INT DEFAULT 50,
ADD COLUMN IF NOT EXISTS used_message_templates INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_automations INT DEFAULT 10,
ADD COLUMN IF NOT EXISTS used_automations INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS quota_alerts_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS alert_threshold_85 BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS alert_threshold_100 BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS last_alert_sent TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS blocked_reason TEXT,
ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ;

-- Tabela de alertas de quota
CREATE TABLE IF NOT EXISTS public.quota_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  quota_type TEXT NOT NULL CHECK (quota_type IN ('users','contacts','campaigns','messages','connections','templates','automations')),
  threshold_percentage INT NOT NULL CHECK (threshold_percentage IN (85, 100)),
  current_usage INT NOT NULL,
  max_limit INT NOT NULL,
  alert_message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days')
);

-- Tabela de histórico de quotas
CREATE TABLE IF NOT EXISTS public.quota_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  quota_type TEXT NOT NULL,
  old_value INT,
  new_value INT,
  max_limit INT,
  action TEXT NOT NULL CHECK (action IN ('increase','decrease','reset','limit_reached','limit_exceeded')),
  triggered_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Função para calcular percentual de uso
CREATE OR REPLACE FUNCTION public.calculate_quota_percentage(used_value INT, max_value INT)
RETURNS INT AS $$
BEGIN
  IF max_value = 0 OR max_value IS NULL THEN
    RETURN 0;
  END IF;
  RETURN ROUND((used_value::DECIMAL / max_value::DECIMAL) * 100);
END;
$$ LANGUAGE plpgsql;

-- Função para verificar se quota foi excedida
CREATE OR REPLACE FUNCTION public.is_quota_exceeded(used_value INT, max_value INT)
RETURNS BOOLEAN AS $$
BEGIN
  IF max_value IS NULL OR max_value = 0 THEN
    RETURN false;
  END IF;
  RETURN used_value >= max_value;
END;
$$ LANGUAGE plpgsql;

-- Função para criar alerta de quota
CREATE OR REPLACE FUNCTION public.create_quota_alert(
  p_tenant_id UUID,
  p_quota_type TEXT,
  p_threshold INT,
  p_current_usage INT,
  p_max_limit INT
)
RETURNS UUID AS $$
DECLARE
  alert_id UUID;
  alert_msg TEXT;
BEGIN
  -- Criar mensagem do alerta
  IF p_threshold = 85 THEN
    alert_msg := format('Atenção: Você está usando %s%% da sua quota de %s (%s de %s). Considere fazer upgrade do seu plano.', 
                       p_threshold, p_quota_type, p_current_usage, p_max_limit);
  ELSE
    alert_msg := format('LIMITE ATINGIDO: Você atingiu 100%% da sua quota de %s (%s de %s). Funcionalidades podem ser bloqueadas até o upgrade.', 
                       p_quota_type, p_current_usage, p_max_limit);
  END IF;

  -- Inserir alerta
  INSERT INTO public.quota_alerts (tenant_id, quota_type, threshold_percentage, current_usage, max_limit, alert_message)
  VALUES (p_tenant_id, p_quota_type, p_threshold, p_current_usage, p_max_limit, alert_msg)
  RETURNING id INTO alert_id;

  RETURN alert_id;
END;
$$ LANGUAGE plpgsql;

-- Função para verificar e criar alertas automáticos
CREATE OR REPLACE FUNCTION public.check_and_create_quota_alerts()
RETURNS TRIGGER AS $$
DECLARE
  quota_record RECORD;
  percentage INT;
  alert_exists BOOLEAN;
BEGIN
  -- Verificar cada tipo de quota
  FOR quota_record IN 
    SELECT 
      NEW.tenant_id,
      'users' as quota_type, NEW.max_users as max_val, 
      (SELECT COUNT(*) FROM public.user_tenants WHERE tenant_id = NEW.tenant_id AND status = 'active') as used_val
    UNION ALL
    SELECT 
      NEW.tenant_id,
      'contacts' as quota_type, NEW.max_contacts as max_val, NEW.used_contacts as used_val
    UNION ALL
    SELECT 
      NEW.tenant_id,
      'campaigns' as quota_type, NEW.max_campaigns as max_val, 
      (SELECT COUNT(*) FROM public.campaigns WHERE tenant_id = NEW.tenant_id) as used_val
    UNION ALL
    SELECT 
      NEW.tenant_id,
      'connections' as quota_type, NEW.max_whatsapp_connections as max_val, NEW.used_whatsapp_connections as used_val
    UNION ALL
    SELECT 
      NEW.tenant_id,
      'templates' as quota_type, NEW.max_message_templates as max_val, NEW.used_message_templates as used_val
    UNION ALL
    SELECT 
      NEW.tenant_id,
      'automations' as quota_type, NEW.max_automations as max_val, NEW.used_automations as used_val
  LOOP
    IF quota_record.max_val > 0 THEN
      percentage := public.calculate_quota_percentage(quota_record.used_val, quota_record.max_val);
      
      -- Verificar alerta de 85%
      IF percentage >= 85 AND NEW.alert_threshold_85 THEN
        SELECT EXISTS(
          SELECT 1 FROM public.quota_alerts 
          WHERE tenant_id = quota_record.tenant_id 
            AND quota_type = quota_record.quota_type 
            AND threshold_percentage = 85
            AND created_at > (now() - INTERVAL '24 hours')
        ) INTO alert_exists;
        
        IF NOT alert_exists THEN
          PERFORM public.create_quota_alert(quota_record.tenant_id, quota_record.quota_type, 85, quota_record.used_val, quota_record.max_val);
        END IF;
      END IF;
      
      -- Verificar alerta de 100%
      IF percentage >= 100 AND NEW.alert_threshold_100 THEN
        SELECT EXISTS(
          SELECT 1 FROM public.quota_alerts 
          WHERE tenant_id = quota_record.tenant_id 
            AND quota_type = quota_record.quota_type 
            AND threshold_percentage = 100
            AND created_at > (now() - INTERVAL '24 hours')
        ) INTO alert_exists;
        
        IF NOT alert_exists THEN
          PERFORM public.create_quota_alert(quota_record.tenant_id, quota_record.quota_type, 100, quota_record.used_val, quota_record.max_val);
          
          -- Bloquear tenant se necessário
          UPDATE public.tenant_quotas 
          SET is_blocked = true, 
              blocked_reason = format('Quota de %s excedida', quota_record.quota_type),
              blocked_at = now()
          WHERE tenant_id = quota_record.tenant_id;
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para verificar quotas automaticamente
DROP TRIGGER IF EXISTS check_quota_alerts_trigger ON public.tenant_quotas;
CREATE TRIGGER check_quota_alerts_trigger
  AFTER INSERT OR UPDATE ON public.tenant_quotas
  FOR EACH ROW
  EXECUTE FUNCTION public.check_and_create_quota_alerts();

-- Função para atualizar contadores de uso
CREATE OR REPLACE FUNCTION public.update_quota_usage(
  p_tenant_id UUID,
  p_quota_type TEXT,
  p_increment INT DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
  current_used INT;
  max_allowed INT;
BEGIN
  -- Atualizar contador baseado no tipo
  CASE p_quota_type
    WHEN 'contacts' THEN
      UPDATE public.tenant_quotas 
      SET used_contacts = used_contacts + p_increment
      WHERE tenant_id = p_tenant_id
      RETURNING used_contacts, max_contacts INTO current_used, max_allowed;
      
    WHEN 'connections' THEN
      UPDATE public.tenant_quotas 
      SET used_whatsapp_connections = used_whatsapp_connections + p_increment
      WHERE tenant_id = p_tenant_id
      RETURNING used_whatsapp_connections, max_whatsapp_connections INTO current_used, max_allowed;
      
    WHEN 'templates' THEN
      UPDATE public.tenant_quotas 
      SET used_message_templates = used_message_templates + p_increment
      WHERE tenant_id = p_tenant_id
      RETURNING used_message_templates, max_message_templates INTO current_used, max_allowed;
      
    WHEN 'automations' THEN
      UPDATE public.tenant_quotas 
      SET used_automations = used_automations + p_increment
      WHERE tenant_id = p_tenant_id
      RETURNING used_automations, max_automations INTO current_used, max_allowed;
      
    WHEN 'messages' THEN
      UPDATE public.tenant_quotas 
      SET used_messages_current_month = used_messages_current_month + p_increment
      WHERE tenant_id = p_tenant_id
      RETURNING used_messages_current_month, max_messages_per_month INTO current_used, max_allowed;
  END CASE;

  -- Registrar no histórico
  INSERT INTO public.quota_history (tenant_id, quota_type, new_value, max_limit, action)
  VALUES (p_tenant_id, p_quota_type, current_used, max_allowed, 
          CASE WHEN p_increment > 0 THEN 'increase' ELSE 'decrease' END);

  -- Verificar se excedeu o limite
  RETURN NOT public.is_quota_exceeded(current_used, max_allowed);
END;
$$ LANGUAGE plpgsql;

-- RLS para novas tabelas
ALTER TABLE public.quota_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quota_history ENABLE ROW LEVEL SECURITY;

-- Políticas para quota_alerts
CREATE POLICY "Read own quota alerts" ON public.quota_alerts FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "Manage quota alerts (admin)" ON public.quota_alerts FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_tenants ut 
    WHERE ut.user_id = auth.uid() AND ut.tenant_id = tenant_id AND ut.role IN ('SUPERADMIN','ADMIN')
  ));

-- Políticas para quota_history
CREATE POLICY "Read own quota history" ON public.quota_history FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "Manage quota history (admin)" ON public.quota_history FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_tenants ut 
    WHERE ut.user_id = auth.uid() AND ut.tenant_id = tenant_id AND ut.role IN ('SUPERADMIN','ADMIN')
  ));

-- Inserir quotas padrão para tenants existentes
INSERT INTO public.tenant_quotas (tenant_id, max_users, max_instances, max_campaigns, max_messages_per_month, max_contacts, max_whatsapp_connections, max_message_templates, max_automations)
SELECT 
  t.id,
  CASE t.plan 
    WHEN 'starter' THEN 3
    WHEN 'pro' THEN 10
    WHEN 'enterprise' THEN 50
    ELSE 5
  END as max_users,
  CASE t.plan 
    WHEN 'starter' THEN 1
    WHEN 'pro' THEN 3
    WHEN 'enterprise' THEN 10
    ELSE 2
  END as max_instances,
  CASE t.plan 
    WHEN 'starter' THEN 10
    WHEN 'pro' THEN 100
    WHEN 'enterprise' THEN 1000
    ELSE 50
  END as max_campaigns,
  CASE t.plan 
    WHEN 'starter' THEN 1000
    WHEN 'pro' THEN 10000
    WHEN 'enterprise' THEN 100000
    ELSE 5000
  END as max_messages_per_month,
  CASE t.plan 
    WHEN 'starter' THEN 500
    WHEN 'pro' THEN 5000
    WHEN 'enterprise' THEN 50000
    ELSE 1000
  END as max_contacts,
  CASE t.plan 
    WHEN 'starter' THEN 1
    WHEN 'pro' THEN 3
    WHEN 'enterprise' THEN 10
    ELSE 2
  END as max_whatsapp_connections,
  CASE t.plan 
    WHEN 'starter' THEN 10
    WHEN 'pro' THEN 50
    WHEN 'enterprise' THEN 200
    ELSE 25
  END as max_message_templates,
  CASE t.plan 
    WHEN 'starter' THEN 5
    WHEN 'pro' THEN 20
    WHEN 'enterprise' THEN 100
    ELSE 10
  END as max_automations
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.tenant_quotas tq WHERE tq.tenant_id = t.id
);

-- Função para resetar quotas mensais (para ser executada via cron)
CREATE OR REPLACE FUNCTION public.reset_monthly_quotas()
RETURNS INT AS $$
DECLARE
  reset_count INT := 0;
BEGIN
  UPDATE public.tenant_quotas 
  SET 
    used_messages_current_month = 0,
    reset_at = now(),
    is_blocked = false,
    blocked_reason = NULL,
    blocked_at = NULL
  WHERE reset_at IS NULL OR reset_at < date_trunc('month', now());
  
  GET DIAGNOSTICS reset_count = ROW_COUNT;
  
  -- Limpar alertas antigos
  DELETE FROM public.quota_alerts WHERE expires_at < now();
  
  RETURN reset_count;
END;
$$ LANGUAGE plpgsql;
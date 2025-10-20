-- Advanced Campaigns System - Phase 2 Astra Campaign Integration
-- Multi-session, intelligent campaigns, randomization, and rate limiting

-- =====================================================
-- CAMPANHAS INTELIGENTES
-- =====================================================

-- Atualizar tabela de campanhas com funcionalidades avançadas
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS campaign_type VARCHAR(50) DEFAULT 'simple';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS multi_session_enabled BOOLEAN DEFAULT false;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS randomization_enabled BOOLEAN DEFAULT false;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS rate_limit_per_minute INTEGER DEFAULT 10;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS retry_attempts INTEGER DEFAULT 3;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS retry_delay_minutes INTEGER DEFAULT 5;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS failover_enabled BOOLEAN DEFAULT true;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS priority_level INTEGER DEFAULT 1;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS execution_strategy JSONB DEFAULT '{}';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS randomization_config JSONB DEFAULT '{}';

-- =====================================================
-- SISTEMA DE FILAS DE MENSAGENS
-- =====================================================

CREATE TABLE IF NOT EXISTS message_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    whatsapp_instance_id UUID REFERENCES whatsapp_instances(id) ON DELETE SET NULL,
    
    -- Dados da mensagem
    message_content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text',
    media_url TEXT,
    template_variables JSONB DEFAULT '{}',
    
    -- Status e controle
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, sent, failed, retrying
    priority INTEGER DEFAULT 1,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    
    -- Randomização
    random_delay_seconds INTEGER DEFAULT 0,
    actual_send_time TIMESTAMP WITH TIME ZONE,
    
    -- Metadados
    error_message TEXT,
    response_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE
);

-- Criar índices para performance da message_queue
CREATE INDEX IF NOT EXISTS idx_message_queue_status ON message_queue(status);
CREATE INDEX IF NOT EXISTS idx_message_queue_tenant ON message_queue(tenant_id);
CREATE INDEX IF NOT EXISTS idx_message_queue_campaign ON message_queue(campaign_id);
CREATE INDEX IF NOT EXISTS idx_message_queue_instance ON message_queue(whatsapp_instance_id);
CREATE INDEX IF NOT EXISTS idx_message_queue_scheduled ON message_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_message_queue_priority ON message_queue(priority DESC);

-- =====================================================
-- GERENCIAMENTO MULTI-SESSÃO
-- =====================================================

-- Atualizar tabela de instâncias WhatsApp
ALTER TABLE whatsapp_instances ADD COLUMN IF NOT EXISTS health_status VARCHAR(20) DEFAULT 'unknown';
ALTER TABLE whatsapp_instances ADD COLUMN IF NOT EXISTS last_health_check TIMESTAMP WITH TIME ZONE;
ALTER TABLE whatsapp_instances ADD COLUMN IF NOT EXISTS health_check_failures INTEGER DEFAULT 0;
ALTER TABLE whatsapp_instances ADD COLUMN IF NOT EXISTS rate_limit_per_minute INTEGER DEFAULT 10;
ALTER TABLE whatsapp_instances ADD COLUMN IF NOT EXISTS current_load INTEGER DEFAULT 0;
ALTER TABLE whatsapp_instances ADD COLUMN IF NOT EXISTS max_concurrent_messages INTEGER DEFAULT 5;
ALTER TABLE whatsapp_instances ADD COLUMN IF NOT EXISTS priority_weight INTEGER DEFAULT 1;
ALTER TABLE whatsapp_instances ADD COLUMN IF NOT EXISTS failover_group VARCHAR(50);

-- Tabela de health checks
CREATE TABLE IF NOT EXISTS instance_health_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    instance_id UUID NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
    
    check_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) NOT NULL, -- healthy, unhealthy, timeout, error
    response_time_ms INTEGER,
    error_details TEXT,
    metadata JSONB DEFAULT '{}'
);

-- Criar índices para performance da instance_health_logs
CREATE INDEX IF NOT EXISTS idx_health_logs_instance ON instance_health_logs(instance_id);
CREATE INDEX IF NOT EXISTS idx_health_logs_time ON instance_health_logs(check_time DESC);

-- =====================================================
-- SISTEMA DE RANDOMIZAÇÃO
-- =====================================================

CREATE TABLE IF NOT EXISTS randomization_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Configurações de delay
    min_delay_seconds INTEGER DEFAULT 30,
    max_delay_seconds INTEGER DEFAULT 300,
    delay_distribution VARCHAR(20) DEFAULT 'uniform', -- uniform, normal, exponential
    
    -- Configurações de templates
    template_rotation_enabled BOOLEAN DEFAULT true,
    template_selection_strategy VARCHAR(20) DEFAULT 'random', -- random, sequential, weighted
    
    -- Configurações de contatos
    contact_shuffle_enabled BOOLEAN DEFAULT true,
    batch_randomization BOOLEAN DEFAULT true,
    
    -- Simulação humana
    typing_simulation BOOLEAN DEFAULT true,
    read_receipt_delay BOOLEAN DEFAULT true,
    online_status_variation BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(tenant_id, name)
);

-- =====================================================
-- RATE LIMITING AVANÇADO
-- =====================================================

CREATE TABLE IF NOT EXISTS rate_limit_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    instance_id UUID REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
    
    -- Configurações globais ou por instância
    scope VARCHAR(20) DEFAULT 'instance', -- global, instance, campaign
    reference_id UUID, -- campaign_id se scope = campaign
    
    -- Limites
    messages_per_minute INTEGER DEFAULT 10,
    messages_per_hour INTEGER DEFAULT 300,
    messages_per_day INTEGER DEFAULT 1000,
    
    -- Configurações avançadas
    burst_limit INTEGER DEFAULT 5,
    cooldown_period_minutes INTEGER DEFAULT 60,
    adaptive_limiting BOOLEAN DEFAULT true,
    
    -- Horários permitidos
    allowed_hours_start TIME DEFAULT '08:00:00',
    allowed_hours_end TIME DEFAULT '22:00:00',
    allowed_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5,6,7], -- 1=Monday, 7=Sunday
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- LOGS E MÉTRICAS
-- =====================================================

CREATE TABLE IF NOT EXISTS campaign_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    instance_id UUID REFERENCES whatsapp_instances(id) ON DELETE SET NULL,
    
    event_type VARCHAR(50) NOT NULL, -- started, paused, resumed, completed, failed, message_sent, message_failed
    event_data JSONB DEFAULT '{}',
    message_queue_id UUID REFERENCES message_queue(id) ON DELETE SET NULL,
    
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para performance da campaign_execution_logs
CREATE INDEX IF NOT EXISTS idx_execution_logs_campaign ON campaign_execution_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_type ON campaign_execution_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_execution_logs_time ON campaign_execution_logs(timestamp DESC);

-- Tabela de métricas em tempo real
CREATE TABLE IF NOT EXISTS campaign_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    
    -- Contadores
    total_messages INTEGER DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    messages_failed INTEGER DEFAULT 0,
    messages_pending INTEGER DEFAULT 0,
    
    -- Taxas
    success_rate DECIMAL(5,2) DEFAULT 0,
    average_response_time_ms INTEGER DEFAULT 0,
    
    -- Timing
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    estimated_completion TIMESTAMP WITH TIME ZONE,
    
    -- Instâncias utilizadas
    active_instances INTEGER DEFAULT 0,
    failed_instances INTEGER DEFAULT 0,
    
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(campaign_id)
);

-- =====================================================
-- TRIGGERS E FUNÇÕES
-- =====================================================

-- Função para atualizar métricas automaticamente
CREATE OR REPLACE FUNCTION update_campaign_metrics()
RETURNS TRIGGER AS $$
BEGIN
    -- Atualizar métricas quando status da fila muda
    INSERT INTO campaign_metrics (tenant_id, campaign_id, total_messages, messages_sent, messages_failed, messages_pending)
    SELECT 
        NEW.tenant_id,
        NEW.campaign_id,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'sent') as sent,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status IN ('pending', 'processing', 'retrying')) as pending
    FROM message_queue 
    WHERE campaign_id = NEW.campaign_id
    GROUP BY tenant_id, campaign_id
    ON CONFLICT (campaign_id) 
    DO UPDATE SET
        total_messages = EXCLUDED.total_messages,
        messages_sent = EXCLUDED.messages_sent,
        messages_failed = EXCLUDED.messages_failed,
        messages_pending = EXCLUDED.messages_pending,
        success_rate = CASE 
            WHEN EXCLUDED.total_messages > 0 
            THEN (EXCLUDED.messages_sent::DECIMAL / EXCLUDED.total_messages * 100)
            ELSE 0 
        END,
        last_updated = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar métricas
DROP TRIGGER IF EXISTS trigger_update_campaign_metrics ON message_queue;
CREATE TRIGGER trigger_update_campaign_metrics
    AFTER INSERT OR UPDATE OF status ON message_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_campaign_metrics();

-- Função para health check automático
CREATE OR REPLACE FUNCTION update_instance_health()
RETURNS TRIGGER AS $$
BEGIN
    -- Atualizar status da instância baseado nos health checks
    UPDATE whatsapp_instances 
    SET 
        health_status = CASE 
            WHEN NEW.status = 'healthy' THEN 'online'
            WHEN NEW.status IN ('unhealthy', 'timeout', 'error') THEN 'offline'
            ELSE health_status
        END,
        last_health_check = NEW.check_time,
        health_check_failures = CASE 
            WHEN NEW.status = 'healthy' THEN 0
            ELSE health_check_failures + 1
        END
    WHERE id = NEW.instance_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para health check
DROP TRIGGER IF EXISTS trigger_update_instance_health ON instance_health_logs;
CREATE TRIGGER trigger_update_instance_health
    AFTER INSERT ON instance_health_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_instance_health();

-- =====================================================
-- FUNÇÕES AUXILIARES
-- =====================================================

-- Função para obter tenant atual do usuário (baseada no padrão existente)
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS UUID AS $$
DECLARE
  tenant_uuid UUID;
BEGIN
  -- Buscar o primeiro tenant do usuário autenticado
  SELECT tenant_id INTO tenant_uuid
  FROM public.user_tenants 
  WHERE user_id = auth.uid() 
    AND status = 'active'
  LIMIT 1;
  
  RETURN tenant_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Message Queue Policies
ALTER TABLE message_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "message_queue_tenant_isolation" ON message_queue;
CREATE POLICY "message_queue_tenant_isolation" ON message_queue
    FOR ALL USING (
        tenant_id = get_current_tenant_id() OR 
        is_superadmin()
    );

-- Health Logs Policies
ALTER TABLE instance_health_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "health_logs_tenant_isolation" ON instance_health_logs;
CREATE POLICY "health_logs_tenant_isolation" ON instance_health_logs
    FOR ALL USING (
        tenant_id = get_current_tenant_id() OR 
        is_superadmin()
    );

-- Randomization Profiles Policies
ALTER TABLE randomization_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "randomization_profiles_tenant_isolation" ON randomization_profiles;
CREATE POLICY "randomization_profiles_tenant_isolation" ON randomization_profiles
    FOR ALL USING (
        tenant_id = get_current_tenant_id() OR 
        is_superadmin()
    );

-- Rate Limit Configs Policies
ALTER TABLE rate_limit_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rate_limit_configs_tenant_isolation" ON rate_limit_configs;
CREATE POLICY "rate_limit_configs_tenant_isolation" ON rate_limit_configs
    FOR ALL USING (
        tenant_id = get_current_tenant_id() OR 
        is_superadmin()
    );

-- Execution Logs Policies
ALTER TABLE campaign_execution_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "execution_logs_tenant_isolation" ON campaign_execution_logs;
CREATE POLICY "execution_logs_tenant_isolation" ON campaign_execution_logs
    FOR ALL USING (
        tenant_id = get_current_tenant_id() OR 
        is_superadmin()
    );

-- Metrics Policies
ALTER TABLE campaign_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campaign_metrics_tenant_isolation" ON campaign_metrics;
CREATE POLICY "campaign_metrics_tenant_isolation" ON campaign_metrics
    FOR ALL USING (
        tenant_id = get_current_tenant_id() OR 
        is_superadmin()
    );

-- =====================================================
-- PERMISSÕES
-- =====================================================

-- Conceder permissões para roles
GRANT ALL PRIVILEGES ON message_queue TO authenticated;
GRANT ALL PRIVILEGES ON instance_health_logs TO authenticated;
GRANT ALL PRIVILEGES ON randomization_profiles TO authenticated;
GRANT ALL PRIVILEGES ON rate_limit_configs TO authenticated;
GRANT ALL PRIVILEGES ON campaign_execution_logs TO authenticated;
GRANT ALL PRIVILEGES ON campaign_metrics TO authenticated;

GRANT SELECT ON message_queue TO anon;
GRANT SELECT ON campaign_metrics TO anon;

-- =====================================================
-- DADOS INICIAIS
-- =====================================================

-- Perfil de randomização padrão
INSERT INTO randomization_profiles (tenant_id, name, description, min_delay_seconds, max_delay_seconds)
SELECT 
    id as tenant_id,
    'Padrão Seguro' as name,
    'Configuração padrão com delays seguros para evitar bloqueios' as description,
    60 as min_delay_seconds,
    180 as max_delay_seconds
FROM tenants
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Configuração de rate limit padrão
INSERT INTO rate_limit_configs (tenant_id, scope, messages_per_minute, messages_per_hour, messages_per_day)
SELECT 
    id as tenant_id,
    'global' as scope,
    10 as messages_per_minute,
    300 as messages_per_hour,
    1000 as messages_per_day
FROM tenants
ON CONFLICT DO NOTHING;

-- Comentários para documentação
COMMENT ON TABLE message_queue IS 'Fila de mensagens para campanhas inteligentes com multi-sessão';
COMMENT ON TABLE instance_health_logs IS 'Logs de health check das instâncias WhatsApp';
COMMENT ON TABLE randomization_profiles IS 'Perfis de configuração para randomização de campanhas';
COMMENT ON TABLE rate_limit_configs IS 'Configurações de rate limiting por tenant/instância';
COMMENT ON TABLE campaign_execution_logs IS 'Logs detalhados de execução de campanhas';
COMMENT ON TABLE campaign_metrics IS 'Métricas em tempo real das campanhas';
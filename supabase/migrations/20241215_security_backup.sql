-- Tabela de eventos de segurança
CREATE TABLE security_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL, -- 'authentication', 'data_access', 'encryption', 'backup', 'security_breach'
  event_subtype VARCHAR(100) NOT NULL, -- 'login', 'logout', 'login_failed', 'password_reset', etc.
  user_id UUID REFERENCES auth.users(id),
  tenant_id VARCHAR(100),
  success BOOLEAN NOT NULL DEFAULT true,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_security_events_user_id ON security_events(user_id);
CREATE INDEX idx_security_events_tenant_id ON security_events(tenant_id);
CREATE INDEX idx_security_events_event_type ON security_events(event_type);
CREATE INDEX idx_security_events_created_at ON security_events(created_at DESC);
CREATE INDEX idx_security_events_success ON security_events(success);

-- Tabela de configurações de backup
CREATE TABLE backup_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  tables TEXT[] NOT NULL DEFAULT '{}',
  schedule VARCHAR(20) CHECK (schedule IN ('daily', 'weekly', 'monthly')),
  retention_days INTEGER NOT NULL DEFAULT 30,
  is_encrypted BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  tenant_id VARCHAR(100) NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  last_backup TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para backup configs
CREATE INDEX idx_backup_configs_tenant_id ON backup_configs(tenant_id);
CREATE INDEX idx_backup_configs_user_id ON backup_configs(user_id);
CREATE INDEX idx_backup_configs_is_active ON backup_configs(is_active);

-- Tabela de backups executados
CREATE TABLE backups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id UUID REFERENCES backup_configs(id) ON DELETE CASCADE,
  backup_type VARCHAR(20) NOT NULL CHECK (backup_type IN ('manual', 'scheduled')),
  filename VARCHAR(500) NOT NULL,
  file_size BIGINT NOT NULL,
  tables TEXT[] NOT NULL DEFAULT '{}',
  row_count INTEGER NOT NULL DEFAULT 0,
  is_encrypted BOOLEAN NOT NULL DEFAULT true,
  checksum VARCHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  error_message TEXT,
  tenant_id VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE
);

-- Índices para backups
CREATE INDEX idx_backups_config_id ON backups(config_id);
CREATE INDEX idx_backups_tenant_id ON backups(tenant_id);
CREATE INDEX idx_backups_status ON backups(status);
CREATE INDEX idx_backups_created_at ON backups(created_at DESC);
CREATE INDEX idx_backups_backup_type ON backups(backup_type);

-- Tabela de limites de taxa (rate limiting)
CREATE TABLE rate_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key VARCHAR(500) NOT NULL UNIQUE,
  limit_type VARCHAR(100) NOT NULL, -- 'api_general', 'message_send', 'bulk_message', 'authentication', etc.
  max_requests INTEGER NOT NULL,
  window_seconds INTEGER NOT NULL,
  current_count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  window_end TIMESTAMP WITH TIME ZONE,
  tenant_id VARCHAR(100),
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para rate limits
CREATE INDEX idx_rate_limits_key ON rate_limits(key);
CREATE INDEX idx_rate_limits_limit_type ON rate_limits(limit_type);
CREATE INDEX idx_rate_limits_tenant_id ON rate_limits(tenant_id);
CREATE INDEX idx_rate_limits_user_id ON rate_limits(user_id);
CREATE INDEX idx_rate_limits_window_end ON rate_limits(window_end);

-- Função para limpar rate limits antigos
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits() RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM rate_limits 
  WHERE window_end < NOW() - INTERVAL '1 hour';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Função para atualizar timestamp de modificação
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at em backup_configs
CREATE TRIGGER update_backup_configs_updated_at
    BEFORE UPDATE ON backup_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para atualizar updated_at em rate_limits
CREATE TRIGGER update_rate_limits_updated_at
    BEFORE UPDATE ON rate_limits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Permissões para tabelas de segurança
GRANT SELECT, INSERT ON security_events TO anon;
GRANT SELECT, INSERT ON security_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON backup_configs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON backups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON rate_limits TO authenticated;

-- Permissões para leitura de eventos de segurança do próprio usuário
CREATE POLICY "Users can view their own security events" ON security_events
  FOR SELECT USING (auth.uid() = user_id);

-- Permissões para configurações de backup do tenant
CREATE POLICY "Users can manage their tenant backup configs" ON backup_configs
  FOR ALL USING (auth.uid() = user_id OR tenant_id = auth.jwt() ->> 'tenant_id');

-- Permissões para backups do tenant
CREATE POLICY "Users can manage their tenant backups" ON backups
  FOR ALL USING (tenant_id = auth.jwt() ->> 'tenant_id');

-- Permissões para rate limits do próprio usuário
CREATE POLICY "Users can manage their own rate limits" ON rate_limits
  FOR ALL USING (auth.uid() = user_id OR tenant_id = auth.jwt() ->> 'tenant_id');

-- Habilitar RLS (Row Level Security) nas tabelas
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Criar bucket para backups no Supabase Storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('backups', 'backups', false, 52428800, ARRAY['application/json'])
ON CONFLICT (id) DO NOTHING;

-- Permissões para o bucket de backups
CREATE POLICY "Users can manage their tenant backups" ON storage.objects
  FOR ALL USING (
    bucket_id = 'backups' AND 
    (storage.foldername(name))[1] = auth.jwt() ->> 'tenant_id'
  );
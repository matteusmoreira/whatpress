-- Criar tabelas de segurança e auditoria

-- Tabela de logs de auditoria de segurança
CREATE TABLE IF NOT EXISTS security_audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL,
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(100),
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_security_audit_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_security_audit_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Índices para performance
CREATE INDEX idx_security_audit_tenant_id ON security_audit_log(tenant_id);
CREATE INDEX idx_security_audit_user_id ON security_audit_log(user_id);
CREATE INDEX idx_security_audit_action ON security_audit_log(action);
CREATE INDEX idx_security_audit_created_at ON security_audit_log(created_at);

-- Tabela de preferências de consentimento LGPD
CREATE TABLE IF NOT EXISTS consent_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL,
    user_id UUID,
    contact_phone VARCHAR(20),
    consent_type VARCHAR(50) NOT NULL,
    consent_given BOOLEAN DEFAULT false,
    consent_method VARCHAR(50),
    consent_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    consent_expires_at TIMESTAMP WITH TIME ZONE,
    consent_version INTEGER DEFAULT 1,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_consent_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_consent_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL,
    CONSTRAINT unique_contact_consent UNIQUE (tenant_id, contact_phone, consent_type)
);

-- Índices para consentimentos
CREATE INDEX idx_consent_tenant_id ON consent_preferences(tenant_id);
CREATE INDEX idx_consent_user_id ON consent_preferences(user_id);
CREATE INDEX idx_consent_phone ON consent_preferences(contact_phone);
CREATE INDEX idx_consent_type ON consent_preferences(consent_type);
CREATE INDEX idx_consent_expires ON consent_preferences(consent_expires_at);

-- Tabela de configurações de segurança
CREATE TABLE IF NOT EXISTS security_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL UNIQUE,
    encryption_enabled BOOLEAN DEFAULT false,
    encryption_key_id VARCHAR(100),
    rate_limit_enabled BOOLEAN DEFAULT true,
    rate_limit_requests_per_minute INTEGER DEFAULT 100,
    rate_limit_requests_per_hour INTEGER DEFAULT 1000,
    security_audit_enabled BOOLEAN DEFAULT true,
    lgpd_compliance_enabled BOOLEAN DEFAULT true,
    consent_banner_enabled BOOLEAN DEFAULT true,
    session_timeout_minutes INTEGER DEFAULT 60,
    password_min_length INTEGER DEFAULT 8,
    password_require_uppercase BOOLEAN DEFAULT true,
    password_require_lowercase BOOLEAN DEFAULT true,
    password_require_numbers BOOLEAN DEFAULT true,
    password_require_special BOOLEAN DEFAULT true,
    backup_enabled BOOLEAN DEFAULT true,
    backup_frequency_hours INTEGER DEFAULT 24,
    backup_retention_days INTEGER DEFAULT 30,
    log_retention_days INTEGER DEFAULT 90,
    alert_email_enabled BOOLEAN DEFAULT true,
    alert_sms_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_security_config_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Índices para configurações
CREATE INDEX idx_security_config_tenant_id ON security_config(tenant_id);

-- Tabela de chaves de criptografia
CREATE TABLE IF NOT EXISTS encryption_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL,
    key_name VARCHAR(100) NOT NULL,
    key_type VARCHAR(50) NOT NULL,
    key_data TEXT NOT NULL,
    key_fingerprint VARCHAR(64) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_encryption_keys_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_encryption_keys_user FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
    CONSTRAINT unique_key_name_per_tenant UNIQUE (tenant_id, key_name)
);

-- Índices para chaves
CREATE INDEX idx_encryption_keys_tenant_id ON encryption_keys(tenant_id);
CREATE INDEX idx_encryption_keys_active ON encryption_keys(is_active);

-- Tabela de alertas de segurança
CREATE TABLE IF NOT EXISTS security_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL,
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    details JSONB,
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_security_alerts_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_security_alerts_user FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Índices para alertas
CREATE INDEX idx_security_alerts_tenant_id ON security_alerts(tenant_id);
CREATE INDEX idx_security_alerts_type ON security_alerts(alert_type);
CREATE INDEX idx_security_alerts_severity ON security_alerts(severity);
CREATE INDEX idx_security_alerts_resolved ON security_alerts(is_resolved);
CREATE INDEX idx_security_alerts_created_at ON security_alerts(created_at);

-- Tabela de logs de backup
CREATE TABLE IF NOT EXISTS backup_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL,
    backup_type VARCHAR(50) NOT NULL,
    backup_size_bytes BIGINT,
    backup_location VARCHAR(500),
    backup_checksum VARCHAR(64),
    backup_status VARCHAR(20) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_backup_logs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_backup_logs_user FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Índices para backups
CREATE INDEX idx_backup_logs_tenant_id ON backup_logs(tenant_id);
CREATE INDEX idx_backup_logs_status ON backup_logs(backup_status);
CREATE INDEX idx_backup_logs_created_at ON backup_logs(created_at);

-- Tabela de rate limiting
CREATE TABLE IF NOT EXISTS rate_limiting (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL,
    identifier VARCHAR(100) NOT NULL,
    identifier_type VARCHAR(50) NOT NULL,
    request_count INTEGER DEFAULT 0,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    window_duration_minutes INTEGER DEFAULT 60,
    blocked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_rate_limiting_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT unique_rate_limit UNIQUE (tenant_id, identifier, identifier_type, window_start)
);

-- Índices para rate limiting
CREATE INDEX idx_rate_limiting_tenant_id ON rate_limiting(tenant_id);
CREATE INDEX idx_rate_limiting_identifier ON rate_limiting(identifier);
CREATE INDEX idx_rate_limiting_window ON rate_limiting(window_start);
CREATE INDEX idx_rate_limiting_blocked ON rate_limiting(blocked_until);

-- Adicionar permissões
GRANT SELECT ON security_audit_log TO anon;
GRANT SELECT ON security_audit_log TO authenticated;
GRANT INSERT ON security_audit_log TO authenticated;

GRANT SELECT ON consent_preferences TO anon;
GRANT SELECT ON consent_preferences TO authenticated;
GRANT INSERT ON consent_preferences TO authenticated;
GRANT UPDATE ON consent_preferences TO authenticated;

GRANT SELECT ON security_config TO anon;
GRANT SELECT ON security_config TO authenticated;

GRANT SELECT ON encryption_keys TO authenticated;

GRANT SELECT ON security_alerts TO authenticated;
GRANT INSERT ON security_alerts TO authenticated;
GRANT UPDATE ON security_alerts TO authenticated;

GRANT SELECT ON backup_logs TO authenticated;
GRANT INSERT ON backup_logs TO authenticated;

GRANT SELECT ON rate_limiting TO anon;
GRANT SELECT ON rate_limiting TO authenticated;
GRANT INSERT ON rate_limiting TO authenticated;
GRANT UPDATE ON rate_limiting TO authenticated;
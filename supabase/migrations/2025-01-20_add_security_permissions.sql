-- Adicionar permissões para tabelas de segurança

-- Permissões para security_audit_log
GRANT SELECT ON security_audit_log TO anon;
GRANT SELECT ON security_audit_log TO authenticated;
GRANT INSERT ON security_audit_log TO authenticated;

-- Permissões para consent_preferences
GRANT SELECT ON consent_preferences TO anon;
GRANT SELECT ON consent_preferences TO authenticated;
GRANT INSERT ON consent_preferences TO authenticated;
GRANT UPDATE ON consent_preferences TO authenticated;

-- Permissões para security_config
GRANT SELECT ON security_config TO anon;
GRANT SELECT ON security_config TO authenticated;

-- Permissões para encryption_keys
GRANT SELECT ON encryption_keys TO authenticated;

-- Permissões para security_alerts
GRANT SELECT ON security_alerts TO authenticated;
GRANT INSERT ON security_alerts TO authenticated;
GRANT UPDATE ON security_alerts TO authenticated;

-- Permissões para backup_logs
GRANT SELECT ON backup_logs TO authenticated;
GRANT INSERT ON backup_logs TO authenticated;

-- Permissões para rate_limiting
GRANT SELECT ON rate_limiting TO anon;
GRANT SELECT ON rate_limiting TO authenticated;
GRANT INSERT ON rate_limiting TO authenticated;
GRANT UPDATE ON rate_limiting TO authenticated;
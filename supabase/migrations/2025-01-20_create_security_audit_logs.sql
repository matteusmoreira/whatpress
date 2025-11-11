-- Criar tabela de logs de auditoria de segurança
CREATE TABLE IF NOT EXISTS security_audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(100),
  ip_address INET,
  user_agent TEXT,
  status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failure')),
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_user_id ON security_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_tenant_id ON security_audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_action ON security_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_resource_type ON security_audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_created_at ON security_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_status ON security_audit_logs(status);

-- Índice composto para queries comuns
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_composite 
ON security_audit_logs(user_id, tenant_id, action, created_at DESC);

-- Adicionar comentários para documentação
COMMENT ON TABLE security_audit_logs IS 'Tabela de logs de auditoria de segurança do sistema';
COMMENT ON COLUMN security_audit_logs.user_id IS 'ID do usuário que realizou a ação';
COMMENT ON COLUMN security_audit_logs.tenant_id IS 'ID do tenant (para multi-tenancy)';
COMMENT ON COLUMN security_audit_logs.action IS 'Ação realizada (ex: login, data_access, etc)';
COMMENT ON COLUMN security_audit_logs.resource_type IS 'Tipo de recurso afetado (ex: contact, message, etc)';
COMMENT ON COLUMN security_audit_logs.resource_id IS 'ID do recurso específico afetado';
COMMENT ON COLUMN security_audit_logs.ip_address IS 'Endereço IP do cliente';
COMMENT ON COLUMN security_audit_logs.user_agent IS 'User agent do cliente';
COMMENT ON COLUMN security_audit_logs.status IS 'Status da ação (success/failure)';
COMMENT ON COLUMN security_audit_logs.error_message IS 'Mensagem de erro se houver';
COMMENT ON COLUMN security_audit_logs.metadata IS 'Metadados adicionais da ação';
COMMENT ON COLUMN security_audit_logs.created_at IS 'Timestamp da criação do log';

-- Criar função para limpeza automática de logs antigos
CREATE OR REPLACE FUNCTION cleanup_old_security_logs() 
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM security_audit_logs 
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Criar função para agregar estatísticas de segurança
CREATE OR REPLACE FUNCTION get_security_stats(
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days',
  end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
  action VARCHAR(100),
  resource_type VARCHAR(50),
  status VARCHAR(20),
  count BIGINT,
  first_occurrence TIMESTAMP WITH TIME ZONE,
  last_occurrence TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sal.action,
    sal.resource_type,
    sal.status,
    COUNT(*)::BIGINT as count,
    MIN(sal.created_at) as first_occurrence,
    MAX(sal.created_at) as last_occurrence
  FROM security_audit_logs sal
  WHERE sal.created_at BETWEEN start_date AND end_date
  GROUP BY sal.action, sal.resource_type, sal.status
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql;

-- Configurar RLS (Row Level Security)
ALTER TABLE security_audit_logs ENABLE ROW LEVEL SECURITY;

-- Política para permitir leitura apenas de logs do próprio tenant/usuário
CREATE POLICY "Users can read own tenant logs" ON security_audit_logs
  FOR SELECT
  USING (
    auth.uid() = user_id OR 
    tenant_id = (SELECT current_tenant_id()) OR
    EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = security_audit_logs.tenant_id
      AND t.owner_id = auth.uid()
    )
  );

-- Política para permitir inserção de logs (sistema pode inserir)
CREATE POLICY "System can insert audit logs" ON security_audit_logs
  FOR INSERT
  WITH CHECK (true);

-- Política para permitir exclusão apenas por superadmin
CREATE POLICY "Superadmin can delete audit logs" ON security_audit_logs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      JOIN user_roles ur ON u.id = ur.user_id
      JOIN roles r ON ur.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.name = 'SUPERADMIN'
    )
  );

-- Função auxiliar para obter tenant_id atual (precisa ser criada se não existir)
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID AS $$
BEGIN
  -- Esta função deve ser implementada baseada em como o tenant é gerenciado
  -- Por enquanto, retorna NULL
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
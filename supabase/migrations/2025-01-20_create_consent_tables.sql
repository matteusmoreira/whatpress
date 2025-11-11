-- Tabela de configurações de consentimento por tenant
CREATE TABLE consent_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    require_consent_for_messages BOOLEAN DEFAULT true NOT NULL,
    require_consent_for_marketing BOOLEAN DEFAULT true NOT NULL,
    consent_expiration_days INTEGER DEFAULT 365 NOT NULL,
    allow_import_without_consent BOOLEAN DEFAULT false NOT NULL,
    show_consent_banner BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    UNIQUE(tenant_id)
);

-- Comentários para documentação
COMMENT ON TABLE consent_settings IS 'Configurações de consentimento LGPD/GDPR por tenant';
COMMENT ON COLUMN consent_settings.require_consent_for_messages IS 'Exige consentimento para envio de mensagens WhatsApp';
COMMENT ON COLUMN consent_settings.require_consent_for_marketing IS 'Exige consentimento para envio de mensagens de marketing';
COMMENT ON COLUMN consent_settings.consent_expiration_days IS 'Número de dias para expiração do consentimento';
COMMENT ON COLUMN consent_settings.allow_import_without_consent IS 'Permite importação de contatos sem consentimento';
COMMENT ON COLUMN consent_settings.show_consent_banner IS 'Mostra banner de consentimento na interface';

-- Índices para performance
CREATE INDEX idx_consent_settings_tenant_id ON consent_settings(tenant_id);
CREATE INDEX idx_consent_settings_updated_at ON consent_settings(updated_at);

-- Tabela de registros de consentimento de contatos
CREATE TABLE contact_consents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    consent_type VARCHAR(50) NOT NULL CHECK (consent_type IN ('whatsapp_messages', 'marketing', 'data_processing', 'third_party_sharing')),
    consent_given BOOLEAN NOT NULL,
    consent_method VARCHAR(50) NOT NULL CHECK (consent_method IN ('website_form', 'whatsapp_opt_in', 'manual_entry', 'import')),
    consent_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    ip_address INET,
    user_agent TEXT,
    withdrawal_timestamp TIMESTAMP WITH TIME ZONE,
    withdrawal_method VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Comentários para documentação
COMMENT ON TABLE contact_consents IS 'Registros de consentimento LGPD/GDPR de contatos';
COMMENT ON COLUMN contact_consents.contact_id IS 'ID do contato';
COMMENT ON COLUMN contact_consents.consent_type IS 'Tipo de consentimento';
COMMENT ON COLUMN contact_consents.consent_given IS 'Se o consentimento foi dado (true) ou negado (false)';
COMMENT ON COLUMN contact_consents.consent_method IS 'Método de coleta do consentimento';
COMMENT ON COLUMN contact_consents.consent_timestamp IS 'Data/hora do consentimento';
COMMENT ON COLUMN contact_consents.ip_address IS 'Endereço IP do usuário no momento do consentimento';
COMMENT ON COLUMN contact_consents.user_agent IS 'User agent do navegador/dispositivo';
COMMENT ON COLUMN contact_consents.withdrawal_timestamp IS 'Data/hora da revogação do consentimento';
COMMENT ON COLUMN contact_consents.withdrawal_method IS 'Método de revogação do consentimento';

-- Índices para performance
CREATE INDEX idx_contact_consents_contact_id ON contact_consents(contact_id);
CREATE INDEX idx_contact_consents_tenant_id ON contact_consents(tenant_id);
CREATE INDEX idx_contact_consents_consent_type ON contact_consents(consent_type);
CREATE INDEX idx_contact_consents_consent_timestamp ON contact_consents(consent_timestamp);
CREATE INDEX idx_contact_consents_consent_given ON contact_consents(consent_given);

-- Índice composto para buscas eficientes
CREATE INDEX idx_contact_consents_composite ON contact_consents(contact_id, consent_type, consent_timestamp DESC);

-- Function para limpeza automática de logs antigos
CREATE OR REPLACE FUNCTION cleanup_old_consent_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Deletar registros de consentimento com mais de 5 anos
    DELETE FROM contact_consents
    WHERE consent_timestamp < NOW() - INTERVAL '5 years'
    AND consent_given = false; -- Apenas consentimentos negados
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function para agregar estatísticas de consentimento
CREATE OR REPLACE FUNCTION get_consent_statistics(
    p_tenant_id UUID,
    p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    result JSON;
    filter_start_date TIMESTAMP WITH TIME ZONE;
    filter_end_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Definir período padrão se não fornecido
    filter_start_date := COALESCE(p_start_date, NOW() - INTERVAL '30 days');
    filter_end_date := COALESCE(p_end_date, NOW());

    SELECT json_build_object(
        'total_contacts', (
            SELECT COUNT(DISTINCT c.id)
            FROM contacts c
            WHERE c.tenant_id = p_tenant_id
            AND c.created_at BETWEEN filter_start_date AND filter_end_date
        ),
        'with_consent', (
            SELECT COUNT(DISTINCT cc.contact_id)
            FROM contact_consents cc
            WHERE cc.tenant_id = p_tenant_id
            AND cc.consent_given = true
            AND cc.withdrawal_timestamp IS NULL
            AND cc.consent_type = 'whatsapp_messages'
            AND cc.consent_timestamp BETWEEN filter_start_date AND filter_end_date
        ),
        'without_consent', (
            SELECT COUNT(DISTINCT c.id) - COUNT(DISTINCT cc.contact_id)
            FROM contacts c
            LEFT JOIN contact_consents cc ON c.id = cc.contact_id 
                AND cc.consent_given = true 
                AND cc.withdrawal_timestamp IS NULL
                AND cc.consent_type = 'whatsapp_messages'
            WHERE c.tenant_id = p_tenant_id
            AND c.created_at BETWEEN filter_start_date AND filter_end_date
        ),
        'expired_consent', (
            SELECT COUNT(DISTINCT cc.contact_id)
            FROM contact_consents cc
            JOIN consent_settings cs ON cs.tenant_id = cc.tenant_id
            WHERE cc.tenant_id = p_tenant_id
            AND cc.consent_given = true
            AND cc.withdrawal_timestamp IS NULL
            AND cc.consent_type = 'whatsapp_messages'
            AND cc.consent_timestamp < NOW() - (cs.consent_expiration_days || ' days')::INTERVAL
        ),
        'consent_by_type', (
            SELECT json_object_agg(consent_type, count)
            FROM (
                SELECT consent_type, COUNT(*) as count
                FROM contact_consents
                WHERE tenant_id = p_tenant_id
                AND consent_given = true
                AND withdrawal_timestamp IS NULL
                AND consent_timestamp BETWEEN filter_start_date AND filter_end_date
                GROUP BY consent_type
            ) t
        )
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies para consent_settings
ALTER TABLE consent_settings ENABLE ROW LEVEL SECURITY;

-- Permitir leitura para usuários autenticados do mesmo tenant
CREATE POLICY "Users can view consent settings from their tenant" ON consent_settings
    FOR SELECT
    USING (
        tenant_id = (
            SELECT tenant_id FROM users WHERE id = auth.uid()
        )
    );

-- Permitir atualização apenas para administradores do tenant
CREATE POLICY "Admins can update consent settings" ON consent_settings
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND tenant_id = consent_settings.tenant_id 
            AND role = 'admin'
        )
    );

-- RLS Policies para contact_consents
ALTER TABLE contact_consents ENABLE ROW LEVEL SECURITY;

-- Permitir leitura para usuários autenticados do mesmo tenant
CREATE POLICY "Users can view consents from their tenant" ON contact_consents
    FOR SELECT
    USING (
        tenant_id = (
            SELECT tenant_id FROM users WHERE id = auth.uid()
        )
    );

-- Permitir criação de registros de consentimento
CREATE POLICY "Users can create consent records" ON contact_consents
    FOR INSERT
    WITH CHECK (
        tenant_id = (
            SELECT tenant_id FROM users WHERE id = auth.uid()
        )
    );

-- Permitir atualização apenas para administradores
CREATE POLICY "Admins can update consent records" ON contact_consents
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND tenant_id = contact_consents.tenant_id 
            AND role = 'admin'
        )
    );

-- Grant permissions
GRANT SELECT ON consent_settings TO authenticated;
GRANT UPDATE ON consent_settings TO authenticated;
GRANT SELECT ON contact_consents TO authenticated;
GRANT INSERT ON contact_consents TO authenticated;
GRANT UPDATE ON contact_consents TO authenticated;
GRANT SELECT ON consent_settings TO anon;
GRANT SELECT ON contact_consents TO anon;
-- Função para verificar e criar alertas automáticos de quota
CREATE OR REPLACE FUNCTION check_and_create_quota_alerts()
RETURNS TRIGGER AS $$
DECLARE
    quota_record RECORD;
    usage_percentage NUMERIC;
    alert_message TEXT;
    alert_exists BOOLEAN;
BEGIN
    -- Buscar informações da quota do tenant
    SELECT * INTO quota_record
    FROM tenant_quotas 
    WHERE tenant_id = NEW.tenant_id;
    
    IF NOT FOUND THEN
        RETURN NEW;
    END IF;
    
    -- Verificar cada tipo de quota e criar alertas se necessário
    
    -- Verificar usuários
    IF quota_record.max_users > 0 THEN
        usage_percentage := (COALESCE(quota_record.current_users, 0)::NUMERIC / quota_record.max_users::NUMERIC) * 100;
        
        -- Alerta de 85%
        IF usage_percentage >= 85 AND usage_percentage < 100 THEN
            SELECT EXISTS(
                SELECT 1 FROM quota_alerts 
                WHERE tenant_id = NEW.tenant_id 
                AND quota_type = 'users' 
                AND threshold_percentage = 85
                AND expires_at > NOW()
                AND is_read = false
            ) INTO alert_exists;
            
            IF NOT alert_exists THEN
                alert_message := format('Você está usando %s%% da sua quota de usuários (%s/%s). Considere fazer upgrade do seu plano.',
                    ROUND(usage_percentage, 1), 
                    COALESCE(quota_record.current_users, 0), 
                    quota_record.max_users);
                
                INSERT INTO quota_alerts (
                    tenant_id, quota_type, threshold_percentage, 
                    current_usage, max_limit, alert_message, expires_at
                ) VALUES (
                    NEW.tenant_id, 'users', 85,
                    COALESCE(quota_record.current_users, 0), quota_record.max_users,
                    alert_message, NOW() + INTERVAL '7 days'
                );
            END IF;
        END IF;
        
        -- Alerta de 100% e bloqueio
        IF usage_percentage >= 100 THEN
            SELECT EXISTS(
                SELECT 1 FROM quota_alerts 
                WHERE tenant_id = NEW.tenant_id 
                AND quota_type = 'users' 
                AND threshold_percentage = 100
                AND expires_at > NOW()
                AND is_read = false
            ) INTO alert_exists;
            
            IF NOT alert_exists THEN
                alert_message := format('LIMITE ATINGIDO: Você atingiu 100%% da sua quota de usuários (%s/%s). Faça upgrade imediatamente para continuar adicionando usuários.',
                    COALESCE(quota_record.current_users, 0), 
                    quota_record.max_users);
                
                INSERT INTO quota_alerts (
                    tenant_id, quota_type, threshold_percentage, 
                    current_usage, max_limit, alert_message, expires_at
                ) VALUES (
                    NEW.tenant_id, 'users', 100,
                    COALESCE(quota_record.current_users, 0), quota_record.max_users,
                    alert_message, NOW() + INTERVAL '30 days'
                );
                
                -- Bloquear tenant se necessário
                UPDATE tenant_quotas 
                SET is_blocked = true,
                    blocked_reason = 'Limite de usuários atingido',
                    blocked_at = NOW()
                WHERE tenant_id = NEW.tenant_id;
            END IF;
        END IF;
    END IF;
    
    -- Verificar contatos
    IF quota_record.max_contacts > 0 THEN
        usage_percentage := (COALESCE(quota_record.current_contacts, 0)::NUMERIC / quota_record.max_contacts::NUMERIC) * 100;
        
        -- Alerta de 85%
        IF usage_percentage >= 85 AND usage_percentage < 100 THEN
            SELECT EXISTS(
                SELECT 1 FROM quota_alerts 
                WHERE tenant_id = NEW.tenant_id 
                AND quota_type = 'contacts' 
                AND threshold_percentage = 85
                AND expires_at > NOW()
                AND is_read = false
            ) INTO alert_exists;
            
            IF NOT alert_exists THEN
                alert_message := format('Você está usando %s%% da sua quota de contatos (%s/%s). Considere fazer upgrade do seu plano.',
                    ROUND(usage_percentage, 1), 
                    COALESCE(quota_record.current_contacts, 0), 
                    quota_record.max_contacts);
                
                INSERT INTO quota_alerts (
                    tenant_id, quota_type, threshold_percentage, 
                    current_usage, max_limit, alert_message, expires_at
                ) VALUES (
                    NEW.tenant_id, 'contacts', 85,
                    COALESCE(quota_record.current_contacts, 0), quota_record.max_contacts,
                    alert_message, NOW() + INTERVAL '7 days'
                );
            END IF;
        END IF;
        
        -- Alerta de 100%
        IF usage_percentage >= 100 THEN
            SELECT EXISTS(
                SELECT 1 FROM quota_alerts 
                WHERE tenant_id = NEW.tenant_id 
                AND quota_type = 'contacts' 
                AND threshold_percentage = 100
                AND expires_at > NOW()
                AND is_read = false
            ) INTO alert_exists;
            
            IF NOT alert_exists THEN
                alert_message := format('LIMITE ATINGIDO: Você atingiu 100%% da sua quota de contatos (%s/%s). Faça upgrade imediatamente para continuar adicionando contatos.',
                    COALESCE(quota_record.current_contacts, 0), 
                    quota_record.max_contacts);
                
                INSERT INTO quota_alerts (
                    tenant_id, quota_type, threshold_percentage, 
                    current_usage, max_limit, alert_message, expires_at
                ) VALUES (
                    NEW.tenant_id, 'contacts', 100,
                    COALESCE(quota_record.current_contacts, 0), quota_record.max_contacts,
                    alert_message, NOW() + INTERVAL '30 days'
                );
            END IF;
        END IF;
    END IF;
    
    -- Verificar conexões WhatsApp
    IF quota_record.max_whatsapp_connections > 0 THEN
        usage_percentage := (COALESCE(quota_record.current_whatsapp_connections, 0)::NUMERIC / quota_record.max_whatsapp_connections::NUMERIC) * 100;
        
        -- Alerta de 85%
        IF usage_percentage >= 85 AND usage_percentage < 100 THEN
            SELECT EXISTS(
                SELECT 1 FROM quota_alerts 
                WHERE tenant_id = NEW.tenant_id 
                AND quota_type = 'whatsapp_connections' 
                AND threshold_percentage = 85
                AND expires_at > NOW()
                AND is_read = false
            ) INTO alert_exists;
            
            IF NOT alert_exists THEN
                alert_message := format('Você está usando %s%% da sua quota de conexões WhatsApp (%s/%s). Considere fazer upgrade do seu plano.',
                    ROUND(usage_percentage, 1), 
                    COALESCE(quota_record.current_whatsapp_connections, 0), 
                    quota_record.max_whatsapp_connections);
                
                INSERT INTO quota_alerts (
                    tenant_id, quota_type, threshold_percentage, 
                    current_usage, max_limit, alert_message, expires_at
                ) VALUES (
                    NEW.tenant_id, 'whatsapp_connections', 85,
                    COALESCE(quota_record.current_whatsapp_connections, 0), quota_record.max_whatsapp_connections,
                    alert_message, NOW() + INTERVAL '7 days'
                );
            END IF;
        END IF;
        
        -- Alerta de 100%
        IF usage_percentage >= 100 THEN
            SELECT EXISTS(
                SELECT 1 FROM quota_alerts 
                WHERE tenant_id = NEW.tenant_id 
                AND quota_type = 'whatsapp_connections' 
                AND threshold_percentage = 100
                AND expires_at > NOW()
                AND is_read = false
            ) INTO alert_exists;
            
            IF NOT alert_exists THEN
                alert_message := format('LIMITE ATINGIDO: Você atingiu 100%% da sua quota de conexões WhatsApp (%s/%s). Faça upgrade imediatamente para continuar conectando instâncias.',
                    COALESCE(quota_record.current_whatsapp_connections, 0), 
                    quota_record.max_whatsapp_connections);
                
                INSERT INTO quota_alerts (
                    tenant_id, quota_type, threshold_percentage, 
                    current_usage, max_limit, alert_message, expires_at
                ) VALUES (
                    NEW.tenant_id, 'whatsapp_connections', 100,
                    COALESCE(quota_record.current_whatsapp_connections, 0), quota_record.max_whatsapp_connections,
                    alert_message, NOW() + INTERVAL '30 days'
                );
            END IF;
        END IF;
    END IF;
    
    -- Verificar mensagens mensais
    IF quota_record.max_monthly_messages > 0 THEN
        usage_percentage := (COALESCE(quota_record.current_monthly_messages, 0)::NUMERIC / quota_record.max_monthly_messages::NUMERIC) * 100;
        
        -- Alerta de 85%
        IF usage_percentage >= 85 AND usage_percentage < 100 THEN
            SELECT EXISTS(
                SELECT 1 FROM quota_alerts 
                WHERE tenant_id = NEW.tenant_id 
                AND quota_type = 'monthly_messages' 
                AND threshold_percentage = 85
                AND expires_at > NOW()
                AND is_read = false
            ) INTO alert_exists;
            
            IF NOT alert_exists THEN
                alert_message := format('Você está usando %s%% da sua quota mensal de mensagens (%s/%s). Considere fazer upgrade do seu plano.',
                    ROUND(usage_percentage, 1), 
                    COALESCE(quota_record.current_monthly_messages, 0), 
                    quota_record.max_monthly_messages);
                
                INSERT INTO quota_alerts (
                    tenant_id, quota_type, threshold_percentage, 
                    current_usage, max_limit, alert_message, expires_at
                ) VALUES (
                    NEW.tenant_id, 'monthly_messages', 85,
                    COALESCE(quota_record.current_monthly_messages, 0), quota_record.max_monthly_messages,
                    alert_message, NOW() + INTERVAL '7 days'
                );
            END IF;
        END IF;
        
        -- Alerta de 100% e bloqueio
        IF usage_percentage >= 100 THEN
            SELECT EXISTS(
                SELECT 1 FROM quota_alerts 
                WHERE tenant_id = NEW.tenant_id 
                AND quota_type = 'monthly_messages' 
                AND threshold_percentage = 100
                AND expires_at > NOW()
                AND is_read = false
            ) INTO alert_exists;
            
            IF NOT alert_exists THEN
                alert_message := format('LIMITE ATINGIDO: Você atingiu 100%% da sua quota mensal de mensagens (%s/%s). Faça upgrade imediatamente ou aguarde o próximo ciclo.',
                    COALESCE(quota_record.current_monthly_messages, 0), 
                    quota_record.max_monthly_messages);
                
                INSERT INTO quota_alerts (
                    tenant_id, quota_type, threshold_percentage, 
                    current_usage, max_limit, alert_message, expires_at
                ) VALUES (
                    NEW.tenant_id, 'monthly_messages', 100,
                    COALESCE(quota_record.current_monthly_messages, 0), quota_record.max_monthly_messages,
                    alert_message, NOW() + INTERVAL '30 days'
                );
                
                -- Bloquear envio de mensagens
                UPDATE tenant_quotas 
                SET is_blocked = true,
                    blocked_reason = 'Limite mensal de mensagens atingido',
                    blocked_at = NOW()
                WHERE tenant_id = NEW.tenant_id;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para verificar quotas automaticamente
DROP TRIGGER IF EXISTS quota_alerts_trigger ON tenant_quotas;
CREATE TRIGGER quota_alerts_trigger
    AFTER UPDATE ON tenant_quotas
    FOR EACH ROW
    WHEN (
        OLD.current_users IS DISTINCT FROM NEW.current_users OR
        OLD.current_contacts IS DISTINCT FROM NEW.current_contacts OR
        OLD.current_whatsapp_connections IS DISTINCT FROM NEW.current_whatsapp_connections OR
        OLD.current_monthly_messages IS DISTINCT FROM NEW.current_monthly_messages OR
        OLD.current_message_templates IS DISTINCT FROM NEW.current_message_templates OR
        OLD.current_automations IS DISTINCT FROM NEW.current_automations
    )
    EXECUTE FUNCTION check_and_create_quota_alerts();

-- Função para desbloquear tenant (para uso administrativo)
CREATE OR REPLACE FUNCTION unblock_tenant(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE tenant_quotas 
    SET is_blocked = false,
        blocked_reason = NULL,
        blocked_at = NULL
    WHERE tenant_id = p_tenant_id;
    
    -- Marcar alertas críticos como lidos
    UPDATE quota_alerts 
    SET is_read = true
    WHERE tenant_id = p_tenant_id 
    AND threshold_percentage = 100;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Função para verificar se uma ação pode ser executada
CREATE OR REPLACE FUNCTION can_perform_action(
    p_tenant_id UUID,
    p_action_type TEXT -- 'add_user', 'add_contact', 'send_message', 'add_connection', etc.
)
RETURNS BOOLEAN AS $$
DECLARE
    quota_record RECORD;
    current_usage INTEGER;
    max_limit INTEGER;
BEGIN
    -- Buscar quotas do tenant
    SELECT * INTO quota_record
    FROM tenant_quotas 
    WHERE tenant_id = p_tenant_id;
    
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    -- Se tenant está bloqueado, não pode executar ações críticas
    IF quota_record.is_blocked THEN
        RETURN false;
    END IF;
    
    -- Verificar limites específicos por tipo de ação
    CASE p_action_type
        WHEN 'add_user' THEN
            current_usage := COALESCE(quota_record.current_users, 0);
            max_limit := quota_record.max_users;
        WHEN 'add_contact' THEN
            current_usage := COALESCE(quota_record.current_contacts, 0);
            max_limit := quota_record.max_contacts;
        WHEN 'send_message' THEN
            current_usage := COALESCE(quota_record.current_monthly_messages, 0);
            max_limit := quota_record.max_monthly_messages;
        WHEN 'add_connection' THEN
            current_usage := COALESCE(quota_record.current_whatsapp_connections, 0);
            max_limit := quota_record.max_whatsapp_connections;
        WHEN 'add_template' THEN
            current_usage := COALESCE(quota_record.current_message_templates, 0);
            max_limit := quota_record.max_message_templates;
        WHEN 'add_automation' THEN
            current_usage := COALESCE(quota_record.current_automations, 0);
            max_limit := quota_record.max_automations;
        ELSE
            RETURN true; -- Ação não limitada por quota
    END CASE;
    
    -- Se limite é -1 (ilimitado), sempre permitir
    IF max_limit = -1 THEN
        RETURN true;
    END IF;
    
    -- Verificar se ainda há espaço na quota
    RETURN current_usage < max_limit;
END;
$$ LANGUAGE plpgsql;

-- Função para resetar quotas mensais (para ser executada mensalmente)
CREATE OR REPLACE FUNCTION reset_monthly_quotas()
RETURNS INTEGER AS $$
DECLARE
    reset_count INTEGER := 0;
BEGIN
    -- Resetar contadores mensais
    UPDATE tenant_quotas 
    SET current_monthly_messages = 0,
        is_blocked = CASE 
            WHEN blocked_reason = 'Limite mensal de mensagens atingido' THEN false
            ELSE is_blocked
        END,
        blocked_reason = CASE 
            WHEN blocked_reason = 'Limite mensal de mensagens atingido' THEN NULL
            ELSE blocked_reason
        END,
        blocked_at = CASE 
            WHEN blocked_reason = 'Limite mensal de mensagens atingido' THEN NULL
            ELSE blocked_at
        END;
    
    GET DIAGNOSTICS reset_count = ROW_COUNT;
    
    -- Marcar alertas de mensagens mensais como lidos
    UPDATE quota_alerts 
    SET is_read = true
    WHERE quota_type = 'monthly_messages'
    AND threshold_percentage IN (85, 100);
    
    RETURN reset_count;
END;
$$ LANGUAGE plpgsql;

-- Criar job para resetar quotas mensais (se suportado pelo Supabase)
-- Nota: Isso pode precisar ser configurado externamente via cron job
SELECT cron.schedule(
    'reset-monthly-quotas',
    '0 0 1 * *', -- Todo dia 1 do mês às 00:00
    'SELECT reset_monthly_quotas();'
);
-- Update check_and_create_quota_alerts(UUID) to insert into legacy quota_alerts columns as well, ensuring compatibility

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
  
  -- USUÁRIOS
  percentage := public.calculate_quota_percentage(quota_record.current_users, quota_record.max_users);
  IF percentage >= 100 AND public.should_send_quota_alert(tenant_uuid, 'users', '100_percent') THEN
    alert_message := format('Limite de usuários atingido: %s/%s (100%%)', quota_record.current_users, quota_record.max_users);
    INSERT INTO public.quota_alerts (
      tenant_id, alert_type, resource_type, quota_type, threshold_percentage,
      current_usage, max_limit, percentage, message, alert_message
    ) VALUES (
      tenant_uuid, '100_percent', 'users', 'users', 100,
      quota_record.current_users, quota_record.max_users, percentage, alert_message, alert_message
    );
  ELSIF percentage >= 85 AND public.should_send_quota_alert(tenant_uuid, 'users', '85_percent') THEN
    alert_message := format('Limite de usuários próximo: %s/%s (%.1f%%)', quota_record.current_users, quota_record.max_users, percentage);
    INSERT INTO public.quota_alerts (
      tenant_id, alert_type, resource_type, quota_type, threshold_percentage,
      current_usage, max_limit, percentage, message, alert_message
    ) VALUES (
      tenant_uuid, '85_percent', 'users', 'users', 85,
      quota_record.current_users, quota_record.max_users, percentage, alert_message, alert_message
    );
  END IF;
  
  -- CONTATOS
  percentage := public.calculate_quota_percentage(quota_record.current_contacts, quota_record.max_contacts);
  IF percentage >= 100 AND public.should_send_quota_alert(tenant_uuid, 'contacts', '100_percent') THEN
    alert_message := format('Limite de contatos atingido: %s/%s (100%%)', quota_record.current_contacts, quota_record.max_contacts);
    INSERT INTO public.quota_alerts (
      tenant_id, alert_type, resource_type, quota_type, threshold_percentage,
      current_usage, max_limit, percentage, message, alert_message
    ) VALUES (
      tenant_uuid, '100_percent', 'contacts', 'contacts', 100,
      quota_record.current_contacts, quota_record.max_contacts, percentage, alert_message, alert_message
    );
  ELSIF percentage >= 85 AND public.should_send_quota_alert(tenant_uuid, 'contacts', '85_percent') THEN
    alert_message := format('Limite de contatos próximo: %s/%s (%.1f%%)', quota_record.current_contacts, quota_record.max_contacts, percentage);
    INSERT INTO public.quota_alerts (
      tenant_id, alert_type, resource_type, quota_type, threshold_percentage,
      current_usage, max_limit, percentage, message, alert_message
    ) VALUES (
      tenant_uuid, '85_percent', 'contacts', 'contacts', 85,
      quota_record.current_contacts, quota_record.max_contacts, percentage, alert_message, alert_message
    );
  END IF;
  
  -- CAMPANHAS
  percentage := public.calculate_quota_percentage(quota_record.current_campaigns, quota_record.max_campaigns);
  IF percentage >= 100 AND public.should_send_quota_alert(tenant_uuid, 'campaigns', '100_percent') THEN
    alert_message := format('Limite de campanhas atingido: %s/%s (100%%)', quota_record.current_campaigns, quota_record.max_campaigns);
    INSERT INTO public.quota_alerts (
      tenant_id, alert_type, resource_type, quota_type, threshold_percentage,
      current_usage, max_limit, percentage, message, alert_message
    ) VALUES (
      tenant_uuid, '100_percent', 'campaigns', 'campaigns', 100,
      quota_record.current_campaigns, quota_record.max_campaigns, percentage, alert_message, alert_message
    );
  ELSIF percentage >= 85 AND public.should_send_quota_alert(tenant_uuid, 'campaigns', '85_percent') THEN
    alert_message := format('Limite de campanhas próximo: %s/%s (%.1f%%)', quota_record.current_campaigns, quota_record.max_campaigns, percentage);
    INSERT INTO public.quota_alerts (
      tenant_id, alert_type, resource_type, quota_type, threshold_percentage,
      current_usage, max_limit, percentage, message, alert_message
    ) VALUES (
      tenant_uuid, '85_percent', 'campaigns', 'campaigns', 85,
      quota_record.current_campaigns, quota_record.max_campaigns, percentage, alert_message, alert_message
    );
  END IF;
  
  -- CONEXÕES
  percentage := public.calculate_quota_percentage(quota_record.current_connections, quota_record.max_connections);
  IF percentage >= 100 AND public.should_send_quota_alert(tenant_uuid, 'connections', '100_percent') THEN
    alert_message := format('Limite de conexões atingido: %s/%s (100%%)', quota_record.current_connections, quota_record.max_connections);
    INSERT INTO public.quota_alerts (
      tenant_id, alert_type, resource_type, quota_type, threshold_percentage,
      current_usage, max_limit, percentage, message, alert_message
    ) VALUES (
      tenant_uuid, '100_percent', 'connections', 'connections', 100,
      quota_record.current_connections, quota_record.max_connections, percentage, alert_message, alert_message
    );
  ELSIF percentage >= 85 AND public.should_send_quota_alert(tenant_uuid, 'connections', '85_percent') THEN
    alert_message := format('Limite de conexões próximo: %s/%s (%.1f%%)', quota_record.current_connections, quota_record.max_connections, percentage);
    INSERT INTO public.quota_alerts (
      tenant_id, alert_type, resource_type, quota_type, threshold_percentage,
      current_usage, max_limit, percentage, message, alert_message
    ) VALUES (
      tenant_uuid, '85_percent', 'connections', 'connections', 85,
      quota_record.current_connections, quota_record.max_connections, percentage, alert_message, alert_message
    );
  END IF;
END;
$$ LANGUAGE plpgsql;
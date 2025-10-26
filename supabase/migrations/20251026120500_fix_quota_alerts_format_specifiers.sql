-- Fix format() usage in check_and_create_quota_alerts to avoid invalid C-style specifiers

CREATE OR REPLACE FUNCTION public.check_and_create_quota_alerts(tenant_uuid UUID)
RETURNS VOID AS $$
DECLARE
  quota_record RECORD;
  alert_message TEXT;
  percentage DECIMAL(5,2);
  percentage_rounded TEXT;
BEGIN
  -- Fetch tenant quota record
  SELECT * INTO quota_record
  FROM public.tenant_quotas
  WHERE tenant_id = tenant_uuid;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- USERS
  percentage := public.calculate_quota_percentage(quota_record.current_users, quota_record.max_users);
  percentage_rounded := to_char(round(percentage::numeric, 1), 'FM999D9');
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
    alert_message := format('Limite de usuários próximo: %s/%s (%s%%)', quota_record.current_users, quota_record.max_users, percentage_rounded);
    INSERT INTO public.quota_alerts (
      tenant_id, alert_type, resource_type, quota_type, threshold_percentage,
      current_usage, max_limit, percentage, message, alert_message
    ) VALUES (
      tenant_uuid, '85_percent', 'users', 'users', 85,
      quota_record.current_users, quota_record.max_users, percentage, alert_message, alert_message
    );
  END IF;
  
  -- CONTACTS
  percentage := public.calculate_quota_percentage(quota_record.current_contacts, quota_record.max_contacts);
  percentage_rounded := to_char(round(percentage::numeric, 1), 'FM999D9');
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
    alert_message := format('Limite de contatos próximo: %s/%s (%s%%)', quota_record.current_contacts, quota_record.max_contacts, percentage_rounded);
    INSERT INTO public.quota_alerts (
      tenant_id, alert_type, resource_type, quota_type, threshold_percentage,
      current_usage, max_limit, percentage, message, alert_message
    ) VALUES (
      tenant_uuid, '85_percent', 'contacts', 'contacts', 85,
      quota_record.current_contacts, quota_record.max_contacts, percentage, alert_message, alert_message
    );
  END IF;
  
  -- CAMPAIGNS
  percentage := public.calculate_quota_percentage(quota_record.current_campaigns, quota_record.max_campaigns);
  percentage_rounded := to_char(round(percentage::numeric, 1), 'FM999D9');
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
    alert_message := format('Limite de campanhas próximo: %s/%s (%s%%)', quota_record.current_campaigns, quota_record.max_campaigns, percentage_rounded);
    INSERT INTO public.quota_alerts (
      tenant_id, alert_type, resource_type, quota_type, threshold_percentage,
      current_usage, max_limit, percentage, message, alert_message
    ) VALUES (
      tenant_uuid, '85_percent', 'campaigns', 'campaigns', 85,
      quota_record.current_campaigns, quota_record.max_campaigns, percentage, alert_message, alert_message
    );
  END IF;
  
  -- CONNECTIONS
  percentage := public.calculate_quota_percentage(quota_record.current_connections, quota_record.max_connections);
  percentage_rounded := to_char(round(percentage::numeric, 1), 'FM999D9');
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
    alert_message := format('Limite de conexões próximo: %s/%s (%s%%)', quota_record.current_connections, quota_record.max_connections, percentage_rounded);
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
-- Fix ambiguous column/variable references in should_send_quota_alert without changing parameter names

CREATE OR REPLACE FUNCTION public.should_send_quota_alert(
  tenant_uuid UUID,
  resource_type TEXT,
  alert_type TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  -- Copy parameters into local variables to avoid ambiguity with table columns
  v_resource_type TEXT := resource_type;
  v_alert_type TEXT := alert_type;
  last_alert TIMESTAMPTZ;
  alert_cooldown INTERVAL := '1 hour'; -- Cooldown de 1 hora entre alertas
BEGIN
  -- Buscar último alerta do mesmo tipo
  SELECT qa.created_at INTO last_alert
  FROM public.quota_alerts AS qa
  WHERE qa.tenant_id = tenant_uuid
    AND qa.resource_type = v_resource_type
    AND qa.alert_type = v_alert_type
  ORDER BY qa.created_at DESC
  LIMIT 1;
  
  -- Se nunca enviou alerta ou passou do cooldown
  RETURN (last_alert IS NULL OR (now() - last_alert) > alert_cooldown);
END;
$$ LANGUAGE plpgsql;
-- RLS Validation Script
-- Modo A: testar via SQL Editor simulando usuário com request.jwt.claims
-- Observação: políticas com "TO authenticated" podem exigir SET ROLE authenticated.
-- Caso SET ROLE não seja permitido no seu SQL Editor, valide via REST (Modo B) com tokens de usuários.

-- 0) Preparação: criar dois tenants e dois usuários fictícios (apenas IDs de teste)
DO $$
DECLARE
  t1 uuid := '00000000-0000-0000-0000-000000000001';
  t2 uuid := '00000000-0000-0000-0000-000000000002';
  u1 uuid := '00000000-0000-0000-0000-0000000000A1';
  u2 uuid := '00000000-0000-0000-0000-0000000000A2';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = t1) THEN
    INSERT INTO public.tenants (id, name, created_at)
    VALUES (t1, 'Tenant Teste A', now());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = t2) THEN
    INSERT INTO public.tenants (id, name, created_at)
    VALUES (t2, 'Tenant Teste B', now());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_tenants WHERE user_id = u1 AND tenant_id = t1) THEN
    INSERT INTO public.user_tenants (user_id, tenant_id, role, created_at)
    VALUES (u1, t1, 'tenant_admin', now());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_tenants WHERE user_id = u2 AND tenant_id = t2) THEN
    INSERT INTO public.user_tenants (user_id, tenant_id, role, created_at)
    VALUES (u2, t2, 'tenant_admin', now());
  END IF;
END $$;

-- 1) Criar dados de teste em cada tenant
DO $$
DECLARE
  t1 uuid := '00000000-0000-0000-0000-000000000001';
  t2 uuid := '00000000-0000-0000-0000-000000000002';
BEGIN
  -- campaigns
  INSERT INTO public.campaigns (id, tenant_id, name, status, campaign_type, multi_session_enabled, rate_limit_per_minute, retry_attempts, retry_delay_minutes, priority_level, execution_strategy, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-00000000CAMP1', t1, 'Campanha T1', 'draft', 'broadcast', false, 60, 3, 5, 1, 'sequential', now(), now())
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.campaigns (id, tenant_id, name, status, campaign_type, multi_session_enabled, rate_limit_per_minute, retry_attempts, retry_delay_minutes, priority_level, execution_strategy, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-00000000CAMP2', t2, 'Campanha T2', 'draft', 'broadcast', false, 60, 3, 5, 1, 'sequential', now(), now())
  ON CONFLICT (id) DO NOTHING;

  -- contacts
  INSERT INTO public.contacts (id, tenant_id, name, phone_number, created_at)
  VALUES ('00000000-0000-0000-0000-00000000CONT1', t1, 'Contato T1', '+5511999990001', now())
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.contacts (id, tenant_id, name, phone_number, created_at)
  VALUES ('00000000-0000-0000-0000-00000000CONT2', t2, 'Contato T2', '+5511999990002', now())
  ON CONFLICT (id) DO NOTHING;

  -- campaign_metrics
  INSERT INTO public.campaign_metrics (id, tenant_id, campaign_id, total_messages, messages_sent, messages_failed, messages_pending, success_rate, active_instances, avg_response_time, updated_at)
  VALUES ('00000000-0000-0000-0000-00000000METR1', t1, '00000000-0000-0000-0000-00000000CAMP1', 10, 0, 0, 10, 0, 0, 0, now())
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.campaign_metrics (id, tenant_id, campaign_id, total_messages, messages_sent, messages_failed, messages_pending, success_rate, active_instances, avg_response_time, updated_at)
  VALUES ('00000000-0000-0000-0000-00000000METR2', t2, '00000000-0000-0000-0000-00000000CAMP2', 20, 0, 0, 20, 0, 0, 0, now())
  ON CONFLICT (id) DO NOTHING;

  -- message_queue
  INSERT INTO public.message_queue (id, tenant_id, campaign_id, whatsapp_instance_id, contact_id, message_content, status, priority, scheduled_at, retry_count)
  VALUES ('00000000-0000-0000-0000-00000000QUEU1', t1, '00000000-0000-0000-0000-00000000CAMP1', NULL, '00000000-0000-0000-0000-00000000CONT1', '{"text":"Olá T1"}', 'pending', 1, now(), 0)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.message_queue (id, tenant_id, campaign_id, whatsapp_instance_id, contact_id, message_content, status, priority, scheduled_at, retry_count)
  VALUES ('00000000-0000-0000-0000-00000000QUEU2', t2, '00000000-0000-0000-0000-00000000CAMP2', NULL, '00000000-0000-0000-0000-00000000CONT2', '{"text":"Olá T2"}', 'pending', 1, now(), 0)
  ON CONFLICT (id) DO NOTHING;

  -- campaign_execution_logs
  INSERT INTO public.campaign_execution_logs (id, tenant_id, campaign_id, event_type, details, created_at)
  VALUES ('00000000-0000-0000-0000-00000000LOG01', t1, '00000000-0000-0000-0000-00000000CAMP1', 'created', '{"by":"test"}', now())
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.campaign_execution_logs (id, tenant_id, campaign_id, event_type, details, created_at)
  VALUES ('00000000-0000-0000-0000-00000000LOG02', t2, '00000000-0000-0000-0000-00000000CAMP2', 'created', '{"by":"test"}', now())
  ON CONFLICT (id) DO NOTHING;
END $$;

-- 2) Testar como U1 (tenant T1)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-0000000000A1"}';

-- Deve ver apenas tenant T1
SELECT 'U1 tenants', id, name FROM public.tenants;
SELECT 'U1 campaigns', id, tenant_id FROM public.campaigns;
SELECT 'U1 contacts', id, tenant_id, phone_number FROM public.contacts;
SELECT 'U1 queue', id, tenant_id, status FROM public.message_queue;
SELECT 'U1 metrics', id, tenant_id, campaign_id FROM public.campaign_metrics;
SELECT 'U1 logs', id, tenant_id, campaign_id FROM public.campaign_execution_logs;

-- Teste de INSERT: U1 só pode inserir com tenant_id = T1
INSERT INTO public.campaigns (id, tenant_id, name, status, campaign_type, multi_session_enabled, rate_limit_per_minute, retry_attempts, retry_delay_minutes, priority_level, execution_strategy, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-00000000CAMP3', '00000000-0000-0000-0000-000000000001', 'Campanha U1 Permitida', 'draft', 'broadcast', false, 60, 3, 5, 1, 'sequential', now(), now());

-- Este deve FALHAR (tenant T2):
-- INSERT INTO public.campaigns (...)
-- VALUES ('00000000-0000-0000-0000-00000000CAMPX', '00000000-0000-0000-0000-000000000002', 'Campanha U1 Negada', 'draft', 'broadcast', false, 60, 3, 5, 1, 'sequential', now(), now());

-- 3) Testar como U2 (tenant T2)
RESET ALL;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-0000000000A2"}';

-- Deve ver apenas tenant T2
SELECT 'U2 tenants', id, name FROM public.tenants;
SELECT 'U2 campaigns', id, tenant_id FROM public.campaigns;
SELECT 'U2 contacts', id, tenant_id, phone_number FROM public.contacts;
SELECT 'U2 queue', id, tenant_id, status FROM public.message_queue;
SELECT 'U2 metrics', id, tenant_id, campaign_id FROM public.campaign_metrics;
SELECT 'U2 logs', id, tenant_id, campaign_id FROM public.campaign_execution_logs;

-- Teste de INSERT: U2 só pode inserir com tenant_id = T2
INSERT INTO public.campaigns (id, tenant_id, name, status, campaign_type, multi_session_enabled, rate_limit_per_minute, retry_attempts, retry_delay_minutes, priority_level, execution_strategy, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-00000000CAMP4', '00000000-0000-0000-0000-000000000002', 'Campanha U2 Permitida', 'draft', 'broadcast', false, 60, 3, 5, 1, 'sequential', now(), now());

-- Este deve FALHAR (tenant T1):
-- INSERT INTO public.campaigns (...)
-- VALUES ('00000000-0000-0000-0000-00000000CAMPY', '00000000-0000-0000-0000-000000000001', 'Campanha U2 Negada', 'draft', 'broadcast', false, 60, 3, 5, 1, 'sequential', now(), now());

-- 4) Verificar se RLS está habilitado nas tabelas
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('campaigns','campaign_metrics','message_templates','contacts','message_queue','campaign_execution_logs','whatsapp_instances','tenants','user_tenants')
ORDER BY c.relname;
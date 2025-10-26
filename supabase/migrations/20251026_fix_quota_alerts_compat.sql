-- Fix quota_alerts schema to be compatible with enhanced_quota_system_v2 functions
-- This migration adds missing columns used by functions should_send_quota_alert() and check_and_create_quota_alerts(UUID)

DO $$
BEGIN
  -- Add alert_type column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='quota_alerts' AND column_name='alert_type'
  ) THEN
    ALTER TABLE public.quota_alerts ADD COLUMN alert_type TEXT;
  END IF;

  -- Add resource_type column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='quota_alerts' AND column_name='resource_type'
  ) THEN
    ALTER TABLE public.quota_alerts ADD COLUMN resource_type TEXT;
  END IF;

  -- Add percentage column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='quota_alerts' AND column_name='percentage'
  ) THEN
    ALTER TABLE public.quota_alerts ADD COLUMN percentage DECIMAL(5,2);
  END IF;

  -- Add message column if missing (v2 uses "message" instead of "alert_message")
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='quota_alerts' AND column_name='message'
  ) THEN
    ALTER TABLE public.quota_alerts ADD COLUMN message TEXT;
  END IF;
END $$;

-- Optional helpful index to speed up alert lookups by type
CREATE INDEX IF NOT EXISTS idx_quota_alerts_tenant_type ON public.quota_alerts (tenant_id, resource_type, alert_type, created_at);
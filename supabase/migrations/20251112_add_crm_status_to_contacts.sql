BEGIN;

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS crm_status TEXT NOT NULL DEFAULT 'novo' CHECK (crm_status IN ('novo','qualificado','em_negociacao','ganho','perdido'));

CREATE INDEX IF NOT EXISTS idx_contacts_crm_status ON public.contacts (crm_status);

COMMIT;

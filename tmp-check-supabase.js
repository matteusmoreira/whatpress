const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const lines = fs.readFileSync('env-setup.txt', 'utf8').trim().split(/\r?\n/);
const SUPABASE_URL = lines[4] || lines[0];
const SUPABASE_SERVICE_ROLE = lines[5];
const s = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });
(async () => {
  const out = {};
  try {
    const c = await s.from('contacts').select('id,tenant_id,instance_id,phone_number,name,created_at').order('created_at', { ascending: false }).limit(5);
    out.contacts = c.error ? { error: c.error.message } : c.data;
  } catch (e) {
    out.contacts = { error: e.message };
  }
  try {
    const tenantId = 'ee698847-afbe-42e8-a838-742063c3e128';
    const q = await s.from('tenant_quotas').select('tenant_id,current_contacts,used_contacts,updated_at').eq('tenant_id', tenantId).limit(1);
    out.tenant_quotas = q.error ? { error: q.error.message } : q.data;
  } catch (e) {
    out.tenant_quotas = { error: e.message };
  }
  try {
    const w = await s.from('webhook_events').select('id,event,instance,created_at').order('created_at', { ascending: false }).limit(5);
    out.webhook_events = w.error ? { error: w.error.message } : w.data;
  } catch (e) {
    out.webhook_events = { error: e.message };
  }
  fs.writeFileSync('tmp-supabase-output.json', JSON.stringify(out, null, 2));
  console.log('WROTE tmp-supabase-output.json');
})();
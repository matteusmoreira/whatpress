import 'dotenv/config'
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || 'https://qafghfpmjvrfltpprssb.supabase.co';
const serviceRole = process.env.SUPABASE_SERVICE_ROLE || process.env.VITE_SUPABASE_SERVICE_ROLE || '';

if (!serviceRole) {
  console.error('Missing SUPABASE_SERVICE_ROLE');
  process.exit(1);
}

const supabase = createClient(url, serviceRole);

async function run() {
  console.log('Checking table public.webhook_events...');
  const testPayload = { event: 'test', instance: 'cli-check', data: { ping: true }, created_at: new Date().toISOString() };
  const insert = await supabase.from('webhook_events').insert([testPayload]).select('*');
  console.log('Insert result:', insert.error ? insert.error : insert.data);
  const { data, error } = await supabase.from('webhook_events').select('*').order('created_at', { ascending: false }).limit(3);
  if (error) {
    console.error('Select error:', error);
  } else {
    console.log('Recent events:', data);
  }
}

run().catch(err => { console.error(err); process.exit(1); });
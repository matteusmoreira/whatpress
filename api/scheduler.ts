import type { VercelRequest, VercelResponse } from '@vercel/node';

// Simple scheduled worker to auto-start campaigns and process message_queue
// Requires environment variables:
// - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (service role to bypass RLS for server tasks)
// - EVOLUTION_API_URL, EVOLUTION_API_KEY

const SUPABASE_URL = process.env.SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL as string;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY as string;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('scheduler: SUPABASE envs missing');
}
if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
  console.warn('scheduler: EVOLUTION_API envs missing');
}

// Minimal Supabase client using fetch
async function sb(path: string, init: RequestInit & { method: string }) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Prefer': 'return=representation',
  };
  const res = await fetch(url, { ...init, headers: { ...headers, ...(init.headers || {}) } });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Supabase error ${res.status}: ${txt}`);
  }
  try { return await res.json(); } catch { return null; }
}

function nowISO() { return new Date().toISOString(); }

async function pickInstance(tenant_id: string) {
  const data = await sb(
    `whatsapp_instances?tenant_id=eq.${encodeURIComponent(tenant_id)}&status=eq.connected&health_status=eq.healthy&order=priority_weight.desc&limit=1`,
    { method: 'GET' } as any
  );
  return (Array.isArray(data) && data.length > 0) ? data[0] : null;
}

async function getContactPhone(contact_id: string, tenant_id: string): Promise<string> {
  // contact_id may already be the phone number; try lookup by UUID first
  try {
    const data = await sb(
      `contacts?id=eq.${encodeURIComponent(contact_id)}&tenant_id=eq.${encodeURIComponent(tenant_id)}&select=phone_number&limit=1`,
      { method: 'GET' } as any
    );
    if (Array.isArray(data) && data[0]?.phone_number) {
      return data[0].phone_number as string;
    }
  } catch (err) {
    console.warn('Falha ao buscar telefone do contato', err)
  }
  return contact_id; // fallback
}

async function sendText(instanceName: string, number: string, text: string) {
  const url = `${EVOLUTION_API_URL.replace(/\/$/, '')}/message/sendText/${encodeURIComponent(instanceName)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': EVOLUTION_API_KEY,
    },
    body: JSON.stringify({ number, text }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Evolution send error ${res.status}: ${txt}`);
  }
  return await res.json().catch(() => ({}));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const now = nowISO();

    // 1) Auto-start scheduled campaigns
    const scheduled = await sb(
      `campaigns?status=eq.scheduled&scheduled_at=lte.${encodeURIComponent(now)}&select=id,tenant_id`,
      { method: 'GET' } as any
    );

    if (Array.isArray(scheduled)) {
      for (const c of scheduled) {
        try {
          // optimistic update: only if still scheduled
          await sb(
            `campaigns?id=eq.${encodeURIComponent(c.id)}&status=eq.scheduled`,
            { method: 'PATCH', body: JSON.stringify({ status: 'running', started_at: now }) } as any
          );
          // optional: log
          await sb(
            `campaign_execution_logs`,
            { method: 'POST', body: JSON.stringify({ campaign_id: c.id, tenant_id: c.tenant_id, event_type: 'auto_start', details: { reason: 'scheduler' }, created_at: now }) } as any
          );
        } catch (err) {
          console.warn('scheduler: fail auto-start', c.id, err);
        }
      }
    }

    // 2) Process pending message_queue across tenants
    const pending = await sb(
      `message_queue?status=eq.pending&scheduled_at=lte.${encodeURIComponent(now)}&select=id,campaign_id,tenant_id,whatsapp_instance_id,contact_id,message_content,retry_count,scheduled_at&order=priority.desc&order=scheduled_at.asc&limit=50`,
      { method: 'GET' } as any
    );

    let processed = 0;
    if (Array.isArray(pending)) {
      for (const item of pending) {
        try {
          // mark processing
          await sb(
            `message_queue?id=eq.${encodeURIComponent(item.id)}`,
            { method: 'PATCH', body: JSON.stringify({ status: 'processing' }) } as any
          );

          const instance = await pickInstance(item.tenant_id);
          if (!instance) {
            await sb(
              `message_queue?id=eq.${encodeURIComponent(item.id)}`,
              { method: 'PATCH', body: JSON.stringify({ status: 'failed', error_message: 'Nenhuma instância disponível', retry_count: (item.retry_count ?? 0) + 1 }) } as any
            );
            continue;
          }

          const text = typeof item.message_content === 'string'
            ? item.message_content
            : (item.message_content?.text ?? JSON.stringify(item.message_content));
          const number = await getContactPhone(item.contact_id, item.tenant_id);

          await sendText(instance.name, number, text);

          await sb(
            `message_queue?id=eq.${encodeURIComponent(item.id)}`,
            { method: 'PATCH', body: JSON.stringify({ status: 'sent', sent_at: now }) } as any
          );

          // metrics
          const metrics = await sb(
            `campaign_metrics?campaign_id=eq.${encodeURIComponent(item.campaign_id)}&select=id,messages_sent&limit=1`,
            { method: 'GET' } as any
          );
          if (Array.isArray(metrics) && metrics[0]?.id) {
            await sb(
              `campaign_metrics?id=eq.${encodeURIComponent(metrics[0].id)}`,
              { method: 'PATCH', body: JSON.stringify({ messages_sent: (metrics[0].messages_sent ?? 0) + 1, last_message_at: now, updated_at: now }) } as any
            );
          }

          processed++;
        } catch (err: any) {
          const retryCount = (item.retry_count ?? 0) + 1;
          await sb(
            `message_queue?id=eq.${encodeURIComponent(item.id)}`,
            { method: 'PATCH', body: JSON.stringify({ status: 'failed', retry_count: retryCount, error_message: err?.message || 'Falha ao enviar' }) } as any
          );

          // metrics failed
          const metrics = await sb(
            `campaign_metrics?campaign_id=eq.${encodeURIComponent(item.campaign_id)}&select=id,messages_failed&limit=1`,
            { method: 'GET' } as any
          );
          if (Array.isArray(metrics) && metrics[0]?.id) {
            await sb(
              `campaign_metrics?id=eq.${encodeURIComponent(metrics[0].id)}`,
              { method: 'PATCH', body: JSON.stringify({ messages_failed: (metrics[0].messages_failed ?? 0) + 1, last_message_at: now, updated_at: now }) } as any
            );
          }
        }
      }
    }

    return res.status(200).json({ status: 'ok', processed, at: now });
  } catch (err: any) {
    console.error('scheduler error:', err);
    return res.status(500).json({ error: err?.message || 'scheduler failed' });
  }
}

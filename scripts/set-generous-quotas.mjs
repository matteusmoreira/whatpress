import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import dotenv from 'dotenv';
import fs from 'fs';

// Carregar variáveis de ambiente (.env.local para chaves do frontend)
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(chalk.red('Erro: VITE_SUPABASE_URL/SUPABASE_URL e VITE_SUPABASE_ANON_KEY/SUPABASE_ANON_KEY precisam estar definidos em .env.local ou .env'));
  process.exit(1);
}

// Carregar token do SuperAdmin a partir de arquivo
function loadTokenInfo(path) {
  if (!fs.existsSync(path)) return null;
  const raw = fs.readFileSync(path, 'utf8');
  try {
    const json = JSON.parse(raw);
    return { token: json.access_token, userId: json.user?.id };
  } catch (e) {
    return null;
  }
}

const superTokenInfo = loadTokenInfo('./token-superadmin.json');

if (!superTokenInfo?.token) {
  console.error(chalk.red('Erro: token-superadmin.json não encontrado ou inválido. Execute scripts/get-superadmin-token.mjs primeiro.'));
  process.exit(1);
}

// Cliente Supabase autenticado com token do usuário SuperAdmin
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { headers: { Authorization: `Bearer ${superTokenInfo.token}` } },
});

const SUPER_TENANT_NAME = 'SuperAdmin Tenant';

async function getTenantId(name) {
  const { data, error } = await supabase.from('tenants').select('id').eq('name', name).maybeSingle();
  if (error) throw error;
  return data?.id || null;
}

async function ensureTenantQuotas(tenantId) {
  // Garantir que existe uma linha de quotas para este tenant
  const { data, error } = await supabase
    .from('tenant_quotas')
    .select('tenant_id')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) throw error;

  if (!data?.tenant_id) {
    const { error: insertErr } = await supabase
      .from('tenant_quotas')
      .insert({ tenant_id: tenantId })
      .select('tenant_id')
      .single();
    if (insertErr) throw insertErr;
    console.log(chalk.green('Criada linha inicial em tenant_quotas para o tenant.'));
  }
}

async function setGenerousQuotas() {
  try {
    console.log(chalk.blue('Aplicando quotas generosas para demonstração (SuperAdmin Tenant)...'));
    const tenantId = await getTenantId(SUPER_TENANT_NAME);
    if (!tenantId) {
      console.error(chalk.red(`Tenant não encontrado: ${SUPER_TENANT_NAME}. Crie-o com scripts/seed-test-data.mjs ou via UI.`));
      process.exit(1);
    }

    await ensureTenantQuotas(tenantId);

    const generous = {
      max_users: 100,
      max_contacts: 100000,
      max_campaigns: 1000,
      max_connections: 20,
      max_message_templates: 1000,
      max_automations: 100,
      max_messages_per_month: 1000000,
      alert_85_enabled: false,
      alert_100_enabled: true,
      updated_at: new Date().toISOString(),
    };

    const { error: updateErr } = await supabase
      .from('tenant_quotas')
      .update(generous)
      .eq('tenant_id', tenantId);
    if (updateErr) throw updateErr;

    console.log(chalk.green('✅ Quotas generosas aplicadas com sucesso ao SuperAdmin Tenant.'));
  } catch (err) {
    console.error(chalk.red('Falha ao aplicar quotas generosas:'), err.message || err);
    process.exit(1);
  }
}

setGenerousQuotas();
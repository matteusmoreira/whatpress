const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error('❌ SUPABASE_URL/VITE_SUPABASE_URL não configurada.');
  process.exit(1);
}

const supabaseService = supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;
const supabaseAnon = supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

async function checkTable(client, table) {
  try {
    const { count, error } = await client
      .from(table)
      .select('*', { count: 'exact', head: true });
    if (error && error.code !== 'PGRST116') {
      return { table, exists: false, error: error.message };
    }
    // If no error, PostgREST accepted the table name; consider exists=true
    return { table, exists: true, rowCount: typeof count === 'number' ? count : undefined };
  } catch (e) {
    return { table, exists: false, error: e.message };
  }
}

async function main() {
  console.log('🔍 Checando schema do Supabase...');
  console.log(`URL: ${supabaseUrl}`);
  console.log(`Anon Key: ${supabaseAnonKey ? '✅' : '❌'} | Service Role: ${supabaseServiceKey ? '✅' : '❌'}`);
  console.log('');

  const targets = [
    'users',
    'tenants',
    'user_tenants',
    'tenant_quotas',
    'role_permissions',
    'user_actions_log',
    'webhook_events',
    'profiles', // tabela opcional (alguns trechos do frontend esperam)
  ];

  const client = supabaseService || supabaseAnon;
  if (!client) {
    console.error('❌ Nenhum cliente Supabase disponível (Service Role ou Anon Key).');
    process.exit(1);
  }

  const results = [];
  for (const t of targets) {
    // Try service first if available
    const res = await checkTable(client, t);
    results.push(res);
  }

  const exists = Object.fromEntries(results.map(r => [r.table, r.exists]));
  console.table(results.map(r => ({
    tabela: r.table,
    existe: r.exists ? '✅' : '❌',
    linhas: typeof r.rowCount === 'number' ? r.rowCount : '-',
    erro: r.error || '-',
  })));

  // Quick guidance
  const missing = results.filter(r => !r.exists).map(r => r.table);
  console.log('');
  if (missing.length) {
    console.log('⚠️ Tabelas ausentes:', missing.join(', '));
    console.log('➡️ Aplique as migrações em supabase/migrations/*.sql e o arquivo supabase/database-schema.sql');
  } else {
    console.log('✅ Todas as tabelas principais foram encontradas.');
  }

  // Validate role_permissions has data
  if (exists['role_permissions']) {
    const { data, count, error } = await client
      .from('role_permissions')
      .select('*', { count: 'exact' })
      .limit(3);
    if (error) {
      console.log('⚠️ Erro ao ler role_permissions:', error.message);
    } else {
      console.log(`🔐 role_permissions: ${typeof count === 'number' ? count : data?.length || 0} registros`);
      console.log('Exemplos:', data);
    }
  }

  console.log('\n✅ Checagem concluída.');
}

main().catch(err => {
  console.error('❌ Falha na checagem:', err.message);
  process.exit(1);
});
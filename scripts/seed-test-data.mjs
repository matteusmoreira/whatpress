import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import dotenv from 'dotenv';
import fs from 'fs';

// Load env (.env.local for Vite frontend keys)
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(chalk.red('Error: VITE_SUPABASE_URL/SUPABASE_URL and VITE_SUPABASE_ANON_KEY/SUPABASE_ANON_KEY must be set in .env.local or .env'));
  process.exit(1);
}

// Load tokens from files
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

const adminTokenInfo = loadTokenInfo('./token-admin.json');
const superTokenInfo = loadTokenInfo('./token-superadmin.json');

if (!adminTokenInfo?.token) {
  console.error(chalk.red('Error: token-admin.json not found or invalid. Please run scripts/get-admin-token.mjs first.'));
  process.exit(1);
}
if (!superTokenInfo?.token) {
  console.error(chalk.yellow('Warning: token-superadmin.json not found. SuperAdmin seeding will be skipped.'));
}

// Create clients that use bearer tokens in header
const adminClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { headers: { Authorization: `Bearer ${adminTokenInfo.token}` } },
});
const superClient = superTokenInfo?.token ? createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { headers: { Authorization: `Bearer ${superTokenInfo.token}` } },
}) : null;

const TENANTS = {
  ADMIN: 'Tenant Admin Test',
  SUPERADMIN: 'SuperAdmin Tenant',
};

async function getTenantId(client, name) {
  const { data, error } = await client.from('tenants').select('id').eq('name', name).maybeSingle();
  if (error) throw error;
  return data?.id || null;
}

async function ensureSuperTenantAndMembership() {
  if (!superClient) return null;
  let tenantId = await getTenantId(superClient, TENANTS.SUPERADMIN);
  if (!tenantId) {
    const { data, error } = await superClient.from('tenants').insert({ name: TENANTS.SUPERADMIN }).select('id').single();
    if (error) throw error;
    tenantId = data.id;
    console.log(chalk.green(`Tenant created (SuperAdmin): ${TENANTS.SUPERADMIN} (${tenantId})`));
  }
  const { data: membershipExists, error: membershipCheckError } = await superClient
    .from('user_tenants')
    .select('id')
    .eq('user_id', superTokenInfo.userId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (membershipCheckError) throw membershipCheckError;
  if (!membershipExists?.id) {
    const { error: insertMembershipError } = await superClient.from('user_tenants').insert({
      user_id: superTokenInfo.userId,
      tenant_id: tenantId,
      role: 'SUPERADMIN',
    });
    if (insertMembershipError) throw insertMembershipError;
    console.log(chalk.green(`Added SUPERADMIN membership for user ${superTokenInfo.userId} to tenant ${tenantId}`));
  }
  return tenantId;
}

async function ensureSuperTenant() {
  if (!superClient) return null;
  const existing = await getTenantId(superClient, TENANTS.SUPERADMIN);
  if (existing) return existing;
  const { data, error } = await superClient.from('tenants').insert({ name: TENANTS.SUPERADMIN }).select('id').single();
  if (error) throw error;
  console.log(chalk.green(`Tenant created (SuperAdmin): ${TENANTS.SUPERADMIN} (${data.id})`));
  return data.id;
}

async function seed() {
  try {
    console.log(chalk.blue('Starting seed process (using user tokens via Authorization header)...'));

    // Resolve tenants
    const adminTenantId = await getTenantId(adminClient, TENANTS.ADMIN);
    if (!adminTenantId) {
      console.error(chalk.red(`Admin tenant not found: ${TENANTS.ADMIN}. Please ensure it exists (scripts/create-tenant-user.js).`));
      process.exit(1);
    }
    const superAdminTenantId = await ensureSuperTenantAndMembership();

    // Admin tenant seeding
    console.log(chalk.cyan('Seeding whatsapp_instances (Admin)...'));
    const { data: adminInstance, error: adminInstanceError } = await adminClient
      .from('whatsapp_instances')
      .insert({
        name: 'Admin Instance 1',
        phone_number: '11999999991',
        status: 'connected',
        tenant_id: adminTenantId,
      })
      .select('*')
      .single();
    if (adminInstanceError) throw adminInstanceError;

    console.log(chalk.cyan('Seeding contacts (Admin)...'));
    const { error: contactsError } = await adminClient.from('contacts').insert([
      { name: 'Admin Contact 1', phone_number: '5511988888881', tenant_id: adminTenantId, instance_id: adminInstance.id },
      { name: 'Admin Contact 2', phone_number: '5511988888882', tenant_id: adminTenantId, instance_id: adminInstance.id },
    ]);
    if (contactsError) throw contactsError;

    console.log(chalk.cyan('Seeding message_templates (Admin)...'));
    const { data: adminTemplate, error: adminTemplateError } = await adminClient
      .from('message_templates')
      .insert({
        name: 'Admin Template 1',
        content: 'Hello {{name}}, this is a test message from the Admin Tenant.',
        variables: ['name'],
        tenant_id: adminTenantId,
      })
      .select('*')
      .single();
    if (adminTemplateError) throw adminTemplateError;

    console.log(chalk.cyan('Seeding campaigns (Admin)...'));
    const { data: adminCampaign, error: adminCampaignError } = await adminClient
      .from('campaigns')
      .insert({
        name: 'Admin Campaign 1',
        description: 'Test campaign for Admin Tenant',
        status: 'draft',
        tenant_id: adminTenantId,
        template_id: adminTemplate.id,
        instance_id: adminInstance.id,
      })
      .select('*')
      .single();
    if (adminCampaignError) throw adminCampaignError;

    const { data: adminContacts, error: adminContactsError } = await adminClient
      .from('contacts')
      .select('id')
      .eq('tenant_id', adminTenantId)
      .limit(2);
    if (adminContactsError) throw adminContactsError;

    console.log(chalk.cyan('Seeding message_queue (Admin)...'));
    const { error: mqAdminError } = await adminClient.from('message_queue').insert([
      {
        tenant_id: adminTenantId,
        campaign_id: adminCampaign.id,
        contact_id: adminContacts?.[0]?.id,
        whatsapp_instance_id: adminInstance.id,
        message_content: 'Message for Admin Contact 1',
        status: 'pending',
      },
      {
        tenant_id: adminTenantId,
        campaign_id: adminCampaign.id,
        contact_id: adminContacts?.[1]?.id,
        whatsapp_instance_id: adminInstance.id,
        message_content: 'Message for Admin Contact 2',
        status: 'pending',
      },
    ]);
    if (mqAdminError) throw mqAdminError;

    // SuperAdmin tenant seeding (optional)
    if (superClient && superAdminTenantId) {
      console.log(chalk.cyan('Seeding whatsapp_instances (SuperAdmin)...'));
      const { data: superAdminInstance, error: superAdminInstanceError } = await superClient
        .from('whatsapp_instances')
        .insert({
          name: 'SuperAdmin Instance 1',
          phone_number: '11999999992',
          status: 'connected',
          tenant_id: superAdminTenantId,
        })
        .select('*')
        .single();
      if (superAdminInstanceError) throw superAdminInstanceError;

      console.log(chalk.cyan('Seeding contacts (SuperAdmin)...'));
      const { data: superAdminContactRows, error: contactsSuperError } = await superClient.from('contacts').insert([
        { name: 'SuperAdmin Contact 1', phone_number: '5511977777771', tenant_id: superAdminTenantId, instance_id: superAdminInstance.id },
      ]).select('*');
      if (contactsSuperError) throw contactsSuperError;

      console.log(chalk.cyan('Seeding message_templates (SuperAdmin)...'));
      const { data: superAdminTemplate, error: superAdminTemplateError } = await superClient
        .from('message_templates')
        .insert({
          name: 'SuperAdmin Template 1',
          content: 'Hello {{name}}, this is a test message from the SuperAdmin Tenant.',
          variables: ['name'],
          tenant_id: superAdminTenantId,
        })
        .select('*')
        .single();
      if (superAdminTemplateError) throw superAdminTemplateError;

      console.log(chalk.cyan('Seeding campaigns (SuperAdmin)...'));
      const { data: superAdminCampaign, error: superAdminCampaignError } = await superClient
        .from('campaigns')
        .insert({
          name: 'SuperAdmin Campaign 1',
          description: 'Test campaign for SuperAdmin Tenant',
          status: 'draft',
          tenant_id: superAdminTenantId,
          template_id: superAdminTemplate.id,
          instance_id: superAdminInstance.id,
        })
        .select('*')
        .single();
      if (superAdminCampaignError) throw superAdminCampaignError;

      const superContactId = superAdminContactRows?.[0]?.id;
      console.log(chalk.cyan('Seeding message_queue (SuperAdmin)...'));
      const { error: mqSuperError } = await superClient.from('message_queue').insert([
        {
          tenant_id: superAdminTenantId,
          campaign_id: superAdminCampaign.id,
          contact_id: superContactId,
          whatsapp_instance_id: superAdminInstance.id,
          message_content: 'Message for SuperAdmin Contact 1',
          status: 'pending',
        },
      ]);
      if (mqSuperError) throw mqSuperError;
    }

    console.log(chalk.green('Seed process completed successfully!'));
  } catch (err) {
    console.error(chalk.red('Error during seed process:'), err);
    process.exit(1);
  }
}

seed();
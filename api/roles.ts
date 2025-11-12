import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.warn('Supabase environment variables are missing. API routes will fail.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false }
});

function getBearerToken(req: VercelRequest): string | null {
  const authHeader = req.headers['authorization'];
  const header = Array.isArray(authHeader) ? authHeader[0] : authHeader || '';
  const token = header.startsWith('Bearer ') ? header.substring(7) : '';
  return token || null;
}

async function getActorUserId(token: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error) return null;
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

async function checkAdminScope(actorUserId: string, tenantId?: string) {
  const { data: isSuper } = await supabase.rpc('is_superadmin', { user_id: actorUserId });
  let isTenantAdmin = false;
  if (tenantId) {
    const { data: isAdmin } = await supabase.rpc('is_tenant_admin', { tenant_id: tenantId, user_id: actorUserId });
    isTenantAdmin = !!isAdmin;
  }
  return { isSuperAdmin: !!isSuper, isTenantAdmin };
}

// Helper para registrar ações no backend (best-effort)
async function logAction(actorUserId: string, tenantId: string | null, action: string, resource: string, resourceId?: string | null, details?: any) {
  try {
    await supabase.rpc('log_user_action', {
      p_user_id: actorUserId,
      p_tenant_id: tenantId,
      p_action: action,
      p_resource: resource,
      p_resource_id: resourceId ?? null,
      p_details: details ?? null,
    });
  } catch (e) {
    console.warn('Failed to log action', e);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization Bearer token' });
  }

  const actorUserId = await getActorUserId(token);
  if (!actorUserId) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const { action } = req.body || {};
  if (!action) {
    return res.status(400).json({ error: 'Missing action' });
  }

  try {
    switch (action) {
      case 'list_users': {
        const { tenantId } = req.body || {};
        if (!tenantId) {
          return res.status(400).json({ error: 'Missing tenantId' });
        }
        const scope = await checkAdminScope(actorUserId, tenantId);
        if (!scope.isSuperAdmin && !scope.isTenantAdmin) {
          return res.status(403).json({ error: 'Forbidden: requires SUPERADMIN or tenant ADMIN' });
        }

        const { data: assoc, error: assocError } = await supabase
          .from('user_tenants')
          .select('user_id, role, created_at')
          .eq('tenant_id', tenantId);
        if (assocError) {
          return res.status(500).json({ error: assocError.message });
        }

        const userIds = (assoc || []).map((r: any) => r.user_id);
        const profilesById: Record<string, any> = {};
        if (userIds.length > 0) {
          const { data: profiles, error: profilesError } = await supabase
            .from('users')
            .select('id, email, name')
            .in('id', userIds);
          if (profilesError) {
            return res.status(500).json({ error: profilesError.message });
          }
          for (const p of profiles || []) {
            profilesById[p.id] = p;
          }
        }

        const users = (assoc || []).map((r: any) => {
          const p = profilesById[r.user_id] || {};
          return {
            user_id: r.user_id,
            email: p.email || '',
            full_name: p.name || null,
            role: r.role,
            created_at: r.created_at,
            last_sign_in_at: null,
          };
        });

        return res.status(200).json({ ok: true, users });
      }

      case 'update_role': {
        const { tenantId, userId, newRole } = req.body || {};
        if (!tenantId || !userId || !newRole) {
          return res.status(400).json({ error: 'Missing tenantId, userId or newRole' });
        }
        if (!['ADMIN', 'USER'].includes(newRole)) {
          return res.status(400).json({ error: 'Invalid newRole' });
        }

        const scope = await checkAdminScope(actorUserId, tenantId);
        if (!scope.isSuperAdmin && !scope.isTenantAdmin) {
          return res.status(403).json({ error: 'Forbidden: requires SUPERADMIN or tenant ADMIN' });
        }

        const { error } = await supabase
          .from('user_tenants')
          .update({ role: newRole })
          .eq('tenant_id', tenantId)
          .eq('user_id', userId);

        if (error) {
          return res.status(500).json({ error: error.message });
        }

        await logAction(actorUserId, tenantId, 'update_user_role', 'users', userId, { new_role: newRole });
        return res.status(200).json({ ok: true });
      }

      case 'remove': {
        const { tenantId, userId } = req.body || {};
        if (!tenantId || !userId) {
          return res.status(400).json({ error: 'Missing tenantId or userId' });
        }
        const scope = await checkAdminScope(actorUserId, tenantId);
        if (!scope.isSuperAdmin && !scope.isTenantAdmin) {
          return res.status(403).json({ error: 'Forbidden: requires SUPERADMIN or tenant ADMIN' });
        }

        const { error } = await supabase
          .from('user_tenants')
          .delete()
          .eq('tenant_id', tenantId)
          .eq('user_id', userId);
        if (error) {
          return res.status(500).json({ error: error.message });
        }

        await logAction(actorUserId, tenantId, 'remove_user', 'users', userId, {});
        return res.status(200).json({ ok: true });
      }

      case 'invite': {
        const { tenantId, email, role } = req.body || {};
        if (!tenantId || !email || !role) {
          return res.status(400).json({ error: 'Missing tenantId, email or role' });
        }
        if (!['ADMIN', 'USER'].includes(role)) {
          return res.status(400).json({ error: 'Invalid role' });
        }

        const scope = await checkAdminScope(actorUserId, tenantId);
        if (!scope.isSuperAdmin && !scope.isTenantAdmin) {
          return res.status(403).json({ error: 'Forbidden: requires SUPERADMIN or tenant ADMIN' });
        }

        let userId: string | null = null;
        const { data: usersFound, error: findError } = await supabase
          .from('users')
          .select('id')
          .eq('email', email)
          .limit(1);
        if (findError) {
          return res.status(500).json({ error: findError.message });
        }
        if (usersFound && usersFound.length > 0) {
          userId = usersFound[0].id;
        } else {
          const { data: created, error: createError } = await (supabase as any).auth.admin.createUser({
            email,
            password: Math.random().toString(36).slice(2, 18) + 'Aa1!',
            email_confirm: true,
          });
          if (createError || !created?.user?.id) {
            return res.status(500).json({ error: createError?.message || 'Failed to create user for invitation' });
          }
          userId = created.user.id;
        }

        const { error } = await supabase
          .from('user_tenants')
          .insert({ tenant_id: tenantId, user_id: userId, role });
        if (error) {
          return res.status(500).json({ error: error.message });
        }

        await logAction(actorUserId, tenantId, 'invite_user', 'users', userId, { email, role });
        return res.status(200).json({ ok: true, userId });
      }

      case 'update_permission': {
        const { permissionId, allowed } = req.body || {};
        if (!permissionId || typeof allowed !== 'boolean') {
          return res.status(400).json({ error: 'Missing permissionId or allowed' });
        }
        const scope = await checkAdminScope(actorUserId);
        if (!scope.isSuperAdmin) {
          return res.status(403).json({ error: 'Only SUPERADMIN can update global role permissions' });
        }

        const { error } = await supabase
          .from('role_permissions')
          .update({ allowed })
          .eq('id', permissionId);
        if (error) {
          return res.status(500).json({ error: error.message });
        }

        await logAction(actorUserId, null, 'update_permission', 'permissions', permissionId, { allowed });
        return res.status(200).json({ ok: true });
      }

      case 'list_permissions': {
        // Lista todas as permissões globais por role/resource/action
        const { data, error } = await supabase
          .from('role_permissions')
          .select('*')
          .order('role', { ascending: true })
          .order('resource', { ascending: true })
          .order('action', { ascending: true });
        if (error) {
          return res.status(500).json({ error: error.message });
        }
        return res.status(200).json({ ok: true, permissions: data || [] });
      }

      case 'list_user_actions': {
        const { tenantId, limit, userId, action: actionFilter, resource, since } = req.body || {};
        if (!tenantId) {
          return res.status(400).json({ error: 'Missing tenantId' });
        }
        const scope = await checkAdminScope(actorUserId, tenantId);
        if (!scope.isSuperAdmin && !scope.isTenantAdmin) {
          return res.status(403).json({ error: 'Forbidden: requires SUPERADMIN or tenant ADMIN' });
        }

        const lim = Number.isFinite(Number(limit)) ? Math.max(1, Math.min(200, Number(limit))) : 50;

        let query: any = supabase
          .from('user_actions_log')
          .select('*')
          .eq('tenant_id', tenantId);

        if (userId) query = query.eq('user_id', userId);
        if (actionFilter) query = query.eq('action', actionFilter);
        if (resource) query = query.eq('resource', resource);
        if (since) query = query.gte('created_at', since);

        const { data, error } = await query
          .order('created_at', { ascending: false })
          .limit(lim);
        if (error) {
          return res.status(500).json({ error: error.message });
        }

        const userIds = Array.from(new Set((data ?? []).map((a: any) => a.user_id).filter(Boolean)));
        let emailById: Record<string, string> = {};
        if (userIds.length > 0) {
          const { data: profiles, error: profilesError } = await supabase
            .from('users')
            .select('id, email')
            .in('id', userIds);
          if (profilesError) {
            return res.status(500).json({ error: profilesError.message });
          }
          emailById = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.email]));
        }

        const actions = (data ?? []).map((item: any) => ({
          id: item.id,
          user_id: item.user_id,
          user_email: emailById[item.user_id] ?? '',
          action: item.action,
          resource: item.resource,
          resource_id: item.resource_id,
          details: item.details,
          created_at: item.created_at,
        }));

        return res.status(200).json({ ok: true, actions });
      }

      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  } catch (err: any) {
    console.error('roles API error', err);
    return res.status(500).json({ error: err?.message || 'Unexpected error' });
  }
}

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export interface UserRole {
  tenantId: string;
  tenantName: string;
  tenantPlan: string;
  tenantStatus: string;
  userRole: 'SUPERADMIN' | 'ADMIN' | 'USER';
  userStatus: string;
  joinedAt: string;
}

export interface Permission {
  resource: string;
  action: string;
  allowed: boolean;
}

export interface UseRolesReturn {
  userRoles: UserRole[];
  currentRole: string | null;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isUser: boolean;
  loading: boolean;
  error: string | null;
  checkPermission: (resource: string, action: string, tenantId?: string) => Promise<boolean>;
  getUserTenants: () => Promise<UserRole[]>;
  refreshRoles: () => Promise<void>;
  logAction: (action: string, resource: string, resourceId?: string, details?: any) => Promise<void>;
}

export const useRoles = (tenantId?: string): UseRolesReturn => {
  const { user } = useAuth();
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Verificar se é SuperAdmin
  const isSuperAdmin = userRoles.some(role => role.userRole === 'SUPERADMIN');
  
  // Verificar se é Admin (em qualquer tenant ou no tenant específico)
  const isAdmin = tenantId 
    ? userRoles.some(role => role.tenantId === tenantId && ['SUPERADMIN', 'ADMIN'].includes(role.userRole))
    : userRoles.some(role => ['SUPERADMIN', 'ADMIN'].includes(role.userRole));
  
  // Verificar se é User
  const isUser = userRoles.some(role => role.userRole === 'USER');

  // Buscar roles do usuário
  const getUserTenants = async (): Promise<UserRole[]> => {
    if (!user?.id) return [];

    try {
      const { data, error } = await supabase.rpc('get_user_tenants', {
        user_id: user.id
      });

      if (!error && data) {
        const roles: UserRole[] = data?.map((item: any) => ({
          tenantId: item.tenant_id,
          tenantName: item.tenant_name,
          tenantPlan: item.tenant_plan,
          tenantStatus: item.tenant_status,
          userRole: item.user_role,
          userStatus: item.user_status,
          joinedAt: item.joined_at
        })) || [];

        return roles;
      }
    } catch (err) {
      console.warn('RPC get_user_tenants falhou, tentando fallback via join user_tenants:', err);
    }

    // Fallback via join direto
    try {
      const { data: utData, error: utError } = await supabase
        .from('user_tenants')
        .select(`
          role, status, created_at,
          tenants (
            id, name, plan, status
          )
        `)
        .eq('user_id', user.id);

      if (utError) {
        console.error('Fallback user_tenants join falhou:', utError);
        return [];
      }

      const roles: UserRole[] = (utData || []).map((item: any) => ({
        tenantId: item.tenants?.id,
        tenantName: item.tenants?.name,
        tenantPlan: item.tenants?.plan,
        tenantStatus: item.tenants?.status,
        userRole: item.role,
        userStatus: item.status,
        joinedAt: item.created_at
      })).filter((r: UserRole) => !!r.tenantId) || [];

      return roles;
    } catch (err) {
      console.error('Erro ao buscar roles no fallback:', err);
      return [];
    }
  };

  // Verificar permissão específica
  const checkPermission = async (
    resource: string, 
    action: string, 
    targetTenantId?: string
  ): Promise<boolean> => {
    if (!user?.id) return false;

    const checkTenantId = targetTenantId || tenantId;
    if (!checkTenantId) return false;

    try {
      const { data, error } = await supabase.rpc('has_permission', {
        user_id: user.id,
        tenant_id: checkTenantId,
        resource,
        action
      });

      if (error) throw error;
      return data || false;
    } catch (err) {
      console.error('Erro ao verificar permissão:', err);
      return false;
    }
  };

  // Registrar ação do usuário
  const logAction = async (
    action: string,
    resource: string,
    resourceId?: string,
    details?: any
  ): Promise<void> => {
    if (!user?.id || !tenantId) return;

    try {
      await supabase.rpc('log_user_action', {
        p_user_id: user.id,
        p_tenant_id: tenantId,
        p_action: action,
        p_resource: resource,
        p_resource_id: resourceId || null,
        p_details: details || {}
      });
    } catch (err) {
      console.error('Erro ao registrar ação:', err);
    }
  };

  // Atualizar roles
  const refreshRoles = async (): Promise<void> => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const roles = await getUserTenants();
      setUserRoles(roles);

      // Definir role atual baseado no tenant
      if (tenantId) {
        const currentTenantRole = roles.find(role => role.tenantId === tenantId);
        setCurrentRole(currentTenantRole?.userRole || 'USER');
       } else {
         // Se não há tenant específico, usar a role mais alta
         const highestRole = roles.find(role => role.userRole === 'SUPERADMIN') ||
                            roles.find(role => role.userRole === 'ADMIN') ||
                            roles.find(role => role.userRole === 'USER');
-        setCurrentRole(highestRole?.userRole || null);
+        setCurrentRole(highestRole?.userRole || 'USER');
       }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar roles');
    } finally {
      setLoading(false);
    }
  };

  // Carregar roles quando o usuário ou tenant mudar
  useEffect(() => {
    if (user?.id) {
      refreshRoles();
    } else {
      setUserRoles([]);
      setCurrentRole(null);
      setLoading(false);
    }
  }, [user?.id, tenantId]);

  return {
    userRoles,
    currentRole,
    isSuperAdmin,
    isAdmin,
    isUser,
    loading,
    error,
    checkPermission,
    getUserTenants,
    refreshRoles,
    logAction
  };
};
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';

export type UserRoleType = 'SUPERADMIN' | 'ADMIN' | 'USER' | 'NONE';

export interface UserTenantRole {
  tenantId: string;
  tenantName: string;
  tenantPlan: string;
  tenantStatus: string;
  userRole: UserRoleType;
  userStatus: string;
  joinedAt: string;
}

export interface Permission {
  resource: string;
  action: string;
  allowed: boolean;
}

export interface UseRolesReturn {
  // Estado
  userTenants: UserTenantRole[];
  currentRole: UserRoleType;
  permissions: Permission[];
  loading: boolean;
  error: string | null;
  
  // Verificações de role
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isUser: boolean;
  
  // Verificações de permissão
  hasPermission: (resource: string, action: string) => boolean;
  canAccess: (resource: string, action?: string) => boolean;
  checkPermission: (resource: string, action: string, tenantId?: string) => Promise<boolean>;
  
  // Ações
  getUserTenants: () => Promise<UserTenantRole[]>;
  refreshRoles: () => Promise<void>;
  switchTenant: (tenantId: string) => Promise<void>;
  logAction: (action: string, resource: string, resourceId?: string, details?: any) => Promise<void>;
}

export const useRoles = (): UseRolesReturn => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  
  const [userTenants, setUserTenants] = useState<UserTenantRole[]>([]);
  const [currentRole, setCurrentRole] = useState<UserRoleType>('NONE');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Verificações de role
  const isSuperAdmin = currentRole === 'SUPERADMIN';
  const isAdmin = currentRole === 'ADMIN' || isSuperAdmin;
  const isUser = currentRole === 'USER' || isAdmin;

  // Buscar roles do usuário
  const getUserTenants = async (): Promise<UserTenantRole[]> => {
    if (!user?.id) return [];

    try {
      const { data, error } = await supabase.rpc('get_user_tenants', {
        p_user_id: user.id
      });

      if (!error && data) {
        const roles: UserTenantRole[] = data?.map((item: any) => ({
          tenantId: item.tenant_id,
          tenantName: item.tenant_name,
          tenantPlan: item.tenant_plan,
          tenantStatus: item.tenant_status,
          userRole: item.user_role as UserRoleType,
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
          tenants!inner (
            id, name, plan, status
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .eq('tenants.status', 'active');

      if (utError) {
        console.error('Fallback user_tenants join falhou:', utError);
        return [];
      }

      const roles: UserTenantRole[] = (utData || []).map((item: any) => ({
        tenantId: item.tenants?.id,
        tenantName: item.tenants?.name,
        tenantPlan: item.tenants?.plan,
        tenantStatus: item.tenants?.status,
        userRole: item.role as UserRoleType,
        userStatus: item.status,
        joinedAt: item.created_at
      })).filter((r: UserTenantRole) => !!r.tenantId) || [];

      return roles;
    } catch (err) {
      console.error('Erro ao buscar roles no fallback:', err);
      return [];
    }
  };

  // Verificar se tem permissão específica (local)
  const hasPermission = (resource: string, action: string): boolean => {
    if (currentRole === 'SUPERADMIN') return true;
    
    const permission = permissions.find(
      p => p.resource === resource && p.action === action
    );
    
    return permission?.allowed || false;
  };

  // Verificar se pode acessar um recurso (qualquer ação)
  const canAccess = (resource: string, action?: string): boolean => {
    if (currentRole === 'SUPERADMIN') return true;
    
    if (action) {
      return hasPermission(resource, action);
    }
    
    // Se não especificou ação, verifica se tem qualquer permissão no recurso
    return permissions.some(
      p => p.resource === resource && p.allowed
    );
  };

  // Verificar permissão específica (via RPC)
  const checkPermission = async (
    resource: string, 
    action: string, 
    targetTenantId?: string
  ): Promise<boolean> => {
    if (!user?.id) return false;

    const checkTenantId = targetTenantId || currentTenant?.id;
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

  // Trocar de tenant
  const switchTenant = async (tenantId: string) => {
    if (!user?.id) return;

    try {
      const { data: userRole, error } = await supabase
        .rpc('get_user_role', { 
          tenant_id: tenantId, 
          p_user_id: user.id 
        });

      if (!error && userRole) {
        setCurrentRole(userRole as UserRoleType);
        
        // Recarregar permissões
        const { data: rolePermissions } = await supabase
          .from('role_permissions')
          .select('resource, action, allowed')
          .eq('role', userRole);

        if (rolePermissions) {
          setPermissions(rolePermissions);
        }
      }
    } catch (error) {
      console.error('Erro ao trocar tenant:', error);
    }
  };

  // Registrar ação do usuário
  const logAction = async (
    action: string,
    resource?: string,
    details?: any
  ): Promise<void> => {
    if (!user?.id) return;

    const tenantId = currentTenant?.id ?? null;
    try {
      await supabase.rpc('log_user_action', {
        p_user_id: user.id,
        p_tenant_id: tenantId,
        p_action: action,
        p_resource: resource ?? null,
        p_details: details ?? {}
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
      const tenants = await getUserTenants();
      setUserTenants(tenants);

      // Determinar role atual baseado no tenant ativo
      let role: UserRoleType = 'NONE';
      
      if (currentTenant?.id) {
        const { data: userRole, error: roleError } = await supabase
          .rpc('get_user_role', { 
            tenant_id: currentTenant.id, 
            p_user_id: user.id 
          });

        if (!roleError && userRole) {
          role = userRole as UserRoleType;
        }
      } else if (tenants && tenants.length > 0) {
        // Se não há tenant ativo, usar o primeiro tenant
        role = tenants[0].userRole;
      }

      setCurrentRole(role);

      // Carregar permissões para a role atual
      if (role !== 'NONE') {
        const { data: rolePermissions, error: permError } = await supabase
          .from('role_permissions')
          .select('resource, action, allowed')
          .eq('role', role);

        if (!permError && rolePermissions) {
          setPermissions(rolePermissions);
        }
      } else {
        setPermissions([]);
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
      setUserTenants([]);
      setCurrentRole('NONE');
      setPermissions([]);
      setLoading(false);
    }
  }, [user?.id, currentTenant?.id]);

  return {
    // Estados
    userTenants,
    currentRole,
    permissions,
    loading,
    error,
    
    // Verificações de role
    isSuperAdmin,
    isAdmin,
    isUser,
    
    // Verificações de permissão
    hasPermission,
    canAccess,
    checkPermission,
    
    // Ações
    getUserTenants,
    refreshRoles,
    switchTenant,
    logAction
  };
};
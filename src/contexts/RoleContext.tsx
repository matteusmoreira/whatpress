import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/lib/supabase';

// Tipos para o sistema de roles
export type UserRole = 'SUPERADMIN' | 'ADMIN' | 'USER' | 'NONE';

export interface Permission {
  resource: string;
  action: string;
  allowed: boolean;
}

export interface UserTenant {
  tenant_id: string;
  tenant_name: string;
  tenant_plan: string;
  tenant_status: string;
  user_role: UserRole;
  user_status: string;
  joined_at: string;
}

export interface RoleContextType {
  // Estado atual
  currentRole: UserRole;
  permissions: Permission[];
  userTenants: UserTenant[];
  isLoading: boolean;
  
  // Verificações de role
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isUser: boolean;
  
  // Verificações de permissão
  hasPermission: (resource: string, action: string) => boolean;
  canAccess: (resource: string, action?: string) => boolean;
  
  // Ações
  refreshRoles: () => Promise<void>;
  switchTenant: (tenantId: string) => Promise<void>;
  
  // Log de ações
  logAction: (action: string, resource: string, resourceId?: string, details?: any) => Promise<void>;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

interface RoleProviderProps {
  children: ReactNode;
}

export function RoleProvider({ children }: RoleProviderProps) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  
  const [currentRole, setCurrentRole] = useState<UserRole>('NONE');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [userTenants, setUserTenants] = useState<UserTenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Verificações de role
  const isSuperAdmin = currentRole === 'SUPERADMIN';
  const isAdmin = currentRole === 'ADMIN' || isSuperAdmin;
  const isUser = currentRole === 'USER' || isAdmin;

  // Carregar dados do usuário
  const loadUserRoles = async () => {
    if (!user?.id) {
      setCurrentRole('NONE');
      setPermissions([]);
      setUserTenants([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // Carregar todos os tenants do usuário (com fallback robusto)
      let tenantsList: UserTenant[] = [];
      try {
        const { data: tenants, error: tenantsError } = await supabase
          .rpc('get_user_tenants', { p_user_id: user.id });

        if (!tenantsError && tenants) {
          tenantsList = (tenants || []).map((t: any) => ({
            tenant_id: t.tenant_id,
            tenant_name: t.tenant_name,
            tenant_plan: t.tenant_plan,
            tenant_status: t.tenant_status,
            user_role: (t.user_role as UserRole) || 'NONE',
            user_status: t.user_status,
            joined_at: t.joined_at,
          }));
        } else if (tenantsError) {
          console.warn('RPC get_user_tenants falhou, aplicando fallback:', tenantsError);
        }
      } catch (rpcErr) {
        console.warn('Falha na chamada RPC get_user_tenants, aplicando fallback:', rpcErr);
      }

      // Fallback: join direto via PostgREST (user_tenants -> tenants)
      if (tenantsList.length === 0) {
        try {
          const { data: utData, error: utError } = await supabase
            .from('user_tenants')
            .select(`
              role, status, created_at,
              tenants (
                id, name, plan, status
              )
            `)
            .eq('user_id', user.id)
            .eq('status', 'active');

          if (!utError && utData) {
            tenantsList = (utData || [])
              .map((item: any) => ({
                tenant_id: item.tenants?.id,
                tenant_name: item.tenants?.name,
                tenant_plan: item.tenants?.plan,
                tenant_status: item.tenants?.status,
                user_role: (item.role as UserRole) || 'NONE',
                user_status: item.status,
                joined_at: item.created_at,
              }))
              .filter((t: UserTenant) => !!t.tenant_id);
          } else if (utError) {
            console.warn('Fallback join user_tenants -> tenants falhou:', utError);
          }
        } catch (joinErr) {
          console.error('Erro no fallback join tenants:', joinErr);
        }
      }

      // Fallback final: duas etapas (buscar IDs e depois tenants)
      if (tenantsList.length === 0) {
        try {
          const { data: utIds, error: utIdsError } = await supabase
            .from('user_tenants')
            .select('tenant_id, role, status, created_at')
            .eq('user_id', user.id)
            .eq('status', 'active');

          if (!utIdsError && utIds && utIds.length > 0) {
            const tenantIds = utIds.map((r: any) => r.tenant_id).filter(Boolean);
            const { data: tenantsRows, error: tenantsError } = await supabase
              .from('tenants')
              .select('id, name, plan, status')
              .in('id', tenantIds);

            if (!tenantsError && tenantsRows) {
              const tMap = new Map((tenantsRows || []).map((t: any) => [t.id, t]));
              tenantsList = (utIds || []).map((ut: any) => ({
                tenant_id: ut.tenant_id,
                tenant_name: tMap.get(ut.tenant_id)?.name,
                tenant_plan: tMap.get(ut.tenant_id)?.plan,
                tenant_status: tMap.get(ut.tenant_id)?.status,
                user_role: (ut.role as UserRole) || 'NONE',
                user_status: ut.status,
                joined_at: ut.created_at,
              })).filter((t: UserTenant) => !!t.tenant_id && !!t.tenant_name);
            } else if (tenantsError) {
              console.warn('Fallback etapa 2 (fetch tenants) falhou:', tenantsError);
            }
          } else if (utIdsError) {
            console.warn('Fallback etapa 1 (IDs) falhou:', utIdsError);
          }
        } catch (twoStepErr) {
          console.error('Erro no fallback de duas etapas para tenants:', twoStepErr);
        }
      }

      setUserTenants(tenantsList || []);

      // Determinar role atual baseado no tenant ativo
      let role: UserRole = 'NONE';
      
      if (currentTenant?.id) {
        const { data: userRole, error: roleError } = await supabase
          .rpc('get_user_role', { 
            tenant_id: currentTenant.id, 
            p_user_id: user.id 
          });

        if (!roleError && userRole) {
          role = userRole as UserRole;
        }
      } else if (tenantsList && tenantsList.length > 0) {
        // Se não há tenant ativo, usar o primeiro tenant
        role = tenantsList[0].user_role as UserRole;
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

    } catch (error) {
      console.error('Erro ao carregar roles:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Verificar se tem permissão específica
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

  // Atualizar roles
  const refreshRoles = async () => {
    await loadUserRoles();
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
        setCurrentRole(userRole as UserRole);
        
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
    resource: string, 
    resourceId?: string, 
    details?: any
  ) => {
    if (!user?.id || !currentTenant?.id) return;

    try {
      await supabase.rpc('log_user_action', {
        p_user_id: user.id,
        p_tenant_id: currentTenant.id,
        p_action: action,
        p_resource: resource,
        p_resource_id: resourceId || null,
        p_details: details || {}
      });
    } catch (error) {
      console.error('Erro ao registrar ação:', error);
    }
  };

  // Carregar dados quando user ou tenant mudar
  useEffect(() => {
    loadUserRoles();
  }, [user?.id, currentTenant?.id]);

  const value: RoleContextType = {
    currentRole,
    permissions,
    userTenants,
    isLoading,
    isSuperAdmin,
    isAdmin,
    isUser,
    hasPermission,
    canAccess,
    refreshRoles,
    switchTenant,
    logAction
  };

  return (
    <RoleContext.Provider value={value}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRoleContext() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error('useRoleContext deve ser usado dentro de um RoleProvider');
  }
  return context;
}
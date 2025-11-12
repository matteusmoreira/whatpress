// Compatibility shim: useRoles now proxies to RoleContext. This preserves the old API while the app migrates to useRoleContext.
import { useRoleContext } from '@/contexts/useRoleContext'

export type UserRoleType = 'SUPERADMIN' | 'ADMIN' | 'USER' | 'NONE'

export interface UserTenantRole {
  tenantId: string
  tenantName: string
  tenantPlan: string
  tenantStatus: string
  userRole: UserRoleType
  userStatus: string
  joinedAt: string
}

export interface Permission {
  resource: string
  action: string
  allowed: boolean
}

export interface UseRolesReturn {
  // Estado
  userTenants: UserTenantRole[]
  currentRole: UserRoleType
  permissions: Permission[]
  loading: boolean
  error: string | null
  
  // Verificações de role
  isSuperAdmin: boolean
  isAdmin: boolean
  isUser: boolean
  
  // Verificações de permissão
  hasPermission: (resource: string, action: string) => boolean
  canAccess: (resource: string, action?: string) => boolean
  checkPermission: (resource: string, action: string, tenantId?: string) => Promise<boolean>
  
  // Ações
  getUserTenants: () => Promise<UserTenantRole[]>
  refreshRoles: () => Promise<void>
  switchTenant: (tenantId: string) => Promise<void>
  logAction: (action: string, resource?: string, resourceId?: string, details?: any) => Promise<void>
}

export const useRoles = (): UseRolesReturn => {
  const rc = useRoleContext()

  // Mapear tenants para o formato antigo
  const mappedTenants: UserTenantRole[] = (rc.userTenants || []).map((t: any) => ({
    tenantId: t.tenant_id,
    tenantName: t.tenant_name,
    tenantPlan: t.tenant_plan,
    tenantStatus: t.tenant_status,
    userRole: t.user_role,
    userStatus: t.user_status,
    joinedAt: t.joined_at,
  }))

  // Funções compatíveis
  const getUserTenants = async (): Promise<UserTenantRole[]> => {
    return mappedTenants
  }

  const logAction = async (
    action: string,
    resource?: string,
    resourceId?: string,
    details?: any
  ): Promise<void> => {
    // Encapsular resourceId dentro de details para compatibilidade
    const mergedDetails = { ...(details || {}), resource_id: resourceId }
    await rc.logAction(action, resource, mergedDetails)
  }

  return {
    // Estado
    userTenants: mappedTenants,
    currentRole: rc.currentRole,
    permissions: rc.permissions,
    loading: rc.isLoading,
    error: null,

    // Verificações de role
    isSuperAdmin: rc.isSuperAdmin,
    isAdmin: rc.isAdmin,
    isUser: rc.isUser,

    // Verificações de permissão
    hasPermission: rc.hasPermission,
    canAccess: rc.canAccess,
    checkPermission: rc.checkPermission,

    // Ações
    getUserTenants,
    refreshRoles: rc.refreshRoles,
    switchTenant: rc.switchTenant,
    logAction,
  }
}

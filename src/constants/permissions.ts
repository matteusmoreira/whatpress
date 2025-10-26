// Centralized permission resources/actions to avoid scattered string literals
export const Resources = {
  USERS: 'users',
  QUOTAS: 'quotas',
  ROLES: 'roles',
  TENANTS: 'tenants',
  CAMPAIGNS: 'campaigns',
  TEMPLATES: 'templates',
} as const

export type ResourceKey = keyof typeof Resources
export type Resource = typeof Resources[ResourceKey]

export const Actions = {
  INVITE: 'invite',
  UPDATE_ROLE: 'update_role',
  REMOVE: 'remove',
  // Quotas-related
  VIEW_QUOTAS: 'view_quotas',
  UPDATE_QUOTAS: 'update_quotas',
  RESET_QUOTAS: 'reset_quotas',
  OVERRIDE_QUOTAS: 'override_quotas',
  // Roles/Permissions
  MANAGE_ROLE_PERMISSIONS: 'manage_role_permissions',
} as const

export type ActionKey = keyof typeof Actions
export type Action = typeof Actions[ActionKey]

// Optional: basic matrix to validate known pairs (expand as needed)
export const PermissionMatrix: Record<Resource, Action[]> = {
  [Resources.USERS]: [Actions.INVITE, Actions.UPDATE_ROLE, Actions.REMOVE],
  [Resources.QUOTAS]: [Actions.VIEW_QUOTAS, Actions.UPDATE_QUOTAS, Actions.RESET_QUOTAS, Actions.OVERRIDE_QUOTAS],
  [Resources.ROLES]: [Actions.MANAGE_ROLE_PERMISSIONS, Actions.UPDATE_ROLE, Actions.REMOVE, Actions.INVITE],
  [Resources.TENANTS]: [],
  [Resources.CAMPAIGNS]: [],
  [Resources.TEMPLATES]: [],
}

export function isValidPermission(resource: Resource, action: Action): boolean {
  const actions = PermissionMatrix[resource] || []
  return actions.includes(action)
}
import React, { useEffect } from 'react'
import { useRoleContext } from '@/contexts/RoleContext'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ShieldX } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useToast } from '@/hooks/use-toast'
import { RoleGuard as UIRoleGuard } from '@/components/ui/role-guard'

interface RoleGuardProps {
  children: React.ReactNode
  
  // Controle por role
  allowedRoles?: ('SUPERADMIN' | 'ADMIN' | 'USER')[]
  
  // Controle por permissão específica
  resource?: string
  action?: string
  
  // Controle customizado
  condition?: boolean
  
  // Componente alternativo quando não tem acesso
  fallback?: React.ReactNode
  
  // Se deve mostrar mensagem de erro ou apenas ocultar
  showError?: boolean
  
  // Mensagem customizada de erro
  errorMessage?: string

  // Rota para redirecionar quando não autorizado
  redirectTo?: string
}

export const RoleGuardLegacy: React.FC<RoleGuardProps> = ({
  children,
  allowedRoles,
  resource,
  action,
  condition,
  fallback,
  showError = true,
  errorMessage = 'Você não tem permissão para acessar este recurso.',
  redirectTo
}) => {
  const { 
    currentRole, 
    hasPermission, 
    canAccess, 
    isLoading 
  } = useRoleContext()
  const navigate = useNavigate()
  const location = useLocation()

  // Se ainda está carregando, não mostrar nada
  if (isLoading) {
    return null
  }

  // Verificar acesso baseado nos critérios fornecidos
  const hasAccess = (): boolean => {
    // Se há condição customizada, usar ela
    if (condition !== undefined) {
      return condition
    }

    // Se especificou roles permitidas
    if (allowedRoles && allowedRoles.length > 0) {
      if (!currentRole || currentRole === 'NONE') return false
      return allowedRoles.includes(currentRole)
    }

    // Se especificou recurso e ação
    if (resource && action) {
      return hasPermission(resource, action)
    }

    // Se especificou apenas recurso
    if (resource) {
      return canAccess(resource)
    }

    // Se não especificou nenhum critério, permitir acesso
    return true
  }

  const allowed = hasAccess()

  const { toast } = useToast()

  useEffect(() => {
    if (!isLoading && !allowed && redirectTo && location.pathname !== redirectTo) {
      toast({
        variant: 'destructive',
        title: 'Acesso negado',
        description: errorMessage
      })
      navigate(redirectTo, { 
        state: { 
          from: location.pathname,
          required: { allowedRoles, resource, action }
        } 
      })
    }
  }, [allowed, isLoading, redirectTo, navigate, location.pathname, toast, errorMessage, allowedRoles, resource, action])

  // Se tem acesso, renderizar o conteúdo
  if (!allowed) {
    if (fallback) {
      return <>{fallback}</>
    }

    if (showError && !redirectTo) {
      return (
        <Alert variant="destructive" className="m-4">
          <ShieldX className="h-4 w-4" />
          <AlertDescription>
            {errorMessage}
          </AlertDescription>
        </Alert>
      )
    }

    return null
  }

  return <>{children}</>
}

export const SuperAdminOnly: React.FC<{
  children: React.ReactNode
  fallback?: React.ReactNode
  showError?: boolean
  redirectTo?: string
}> = ({ children, fallback, showError = true, redirectTo }) => (
  <UIRoleGuard 
    requiredRole="SUPERADMIN" 
    fallback={fallback}
    showFallback={showError}
    redirectTo={redirectTo}
  >
    {children}
  </UIRoleGuard>
)

export const AdminOnly: React.FC<{
  children: React.ReactNode
  fallback?: React.ReactNode
  showError?: boolean
  redirectTo?: string
}> = ({ children, fallback, showError = true, redirectTo }) => (
  <UIRoleGuard 
    requiredRole="ADMIN" 
    fallback={fallback}
    showFallback={showError}
    redirectTo={redirectTo}
  >
    {children}
  </UIRoleGuard>
)

export const AuthenticatedOnly: React.FC<{
  children: React.ReactNode
  fallback?: React.ReactNode
  showError?: boolean
  redirectTo?: string
}> = ({ children, fallback, showError = true, redirectTo }) => (
  <UIRoleGuard 
    requiredRole="USER" 
    fallback={fallback}
    showFallback={showError}
    redirectTo={redirectTo}
  >
    {children}
  </UIRoleGuard>
)

// Re-exportar RoleGuard unificado para manter compatibilidade de import
export { UIRoleGuard as RoleGuard }
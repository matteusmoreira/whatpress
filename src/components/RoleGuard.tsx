import React from 'react';
import { useRoles } from '@/hooks/useRoles';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldX } from 'lucide-react';

interface RoleGuardProps {
  children: React.ReactNode;
  
  // Controle por role
  allowedRoles?: ('SUPERADMIN' | 'ADMIN' | 'USER')[];
  
  // Controle por permissão específica
  resource?: string;
  action?: string;
  
  // Controle customizado
  condition?: boolean;
  
  // Componente alternativo quando não tem acesso
  fallback?: React.ReactNode;
  
  // Se deve mostrar mensagem de erro ou apenas ocultar
  showError?: boolean;
  
  // Mensagem customizada de erro
  errorMessage?: string;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  children,
  allowedRoles,
  resource,
  action,
  condition,
  fallback,
  showError = true,
  errorMessage = 'Você não tem permissão para acessar este recurso.'
}) => {
  const { 
    currentRole, 
    hasPermission, 
    canAccess, 
    loading 
  } = useRoles();

  // Se ainda está carregando, não mostrar nada
  if (loading) {
    return null;
  }

  // Verificar acesso baseado nos critérios fornecidos
  const hasAccess = (): boolean => {
    // Se há condição customizada, usar ela
    if (condition !== undefined) {
      return condition;
    }

    // Se especificou roles permitidas
    if (allowedRoles && allowedRoles.length > 0) {
      if (!currentRole || currentRole === 'NONE') return false;
      return allowedRoles.includes(currentRole);
    }

    // Se especificou recurso e ação
    if (resource && action) {
      return hasPermission(resource, action);
    }

    // Se especificou apenas recurso
    if (resource) {
      return canAccess(resource);
    }

    // Se não especificou nenhum critério, permitir acesso
    return true;
  };

  // Verificar se tem acesso
  if (!hasAccess()) {
    // Se tem fallback customizado, usar ele
    if (fallback) {
      return <>{fallback}</>;
    }

    // Se deve mostrar erro
    if (showError) {
      return (
        <Alert variant="destructive" className="m-4">
          <ShieldX className="h-4 w-4" />
          <AlertDescription>
            {errorMessage}
          </AlertDescription>
        </Alert>
      );
    }

    // Caso contrário, não mostrar nada
    return null;
  }

  // Se tem acesso, renderizar o conteúdo
  return <>{children}</>;
};

// Componentes de conveniência para casos comuns
export const SuperAdminOnly: React.FC<{
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showError?: boolean;
}> = ({ children, fallback, showError = true }) => (
  <RoleGuard 
    allowedRoles={['SUPERADMIN']} 
    fallback={fallback}
    showError={showError}
    errorMessage="Apenas Super Administradores podem acessar este recurso."
  >
    {children}
  </RoleGuard>
);

export const AdminOnly: React.FC<{
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showError?: boolean;
}> = ({ children, fallback, showError = true }) => (
  <RoleGuard 
    allowedRoles={['SUPERADMIN', 'ADMIN']} 
    fallback={fallback}
    showError={showError}
    errorMessage="Apenas Administradores podem acessar este recurso."
  >
    {children}
  </RoleGuard>
);

export const AuthenticatedOnly: React.FC<{
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showError?: boolean;
}> = ({ children, fallback, showError = true }) => (
  <RoleGuard 
    allowedRoles={['SUPERADMIN', 'ADMIN', 'USER']} 
    fallback={fallback}
    showError={showError}
    errorMessage="Você precisa estar logado para acessar este recurso."
  >
    {children}
  </RoleGuard>
);

// Hook para usar dentro de componentes
export const useRoleGuard = () => {
  const { 
    currentRole, 
    hasPermission, 
    canAccess, 
    isSuperAdmin, 
    isAdmin, 
    isUser 
  } = useRoles();

  const checkAccess = (
    allowedRoles?: ('SUPERADMIN' | 'ADMIN' | 'USER')[],
    resource?: string,
    action?: string,
    condition?: boolean
  ): boolean => {
    // Se há condição customizada, usar ela
    if (condition !== undefined) {
      return condition;
    }

    // Se especificou roles permitidas
    if (allowedRoles && allowedRoles.length > 0) {
      if (!currentRole || currentRole === 'NONE') return false;
      return allowedRoles.includes(currentRole);
    }

    // Se especificou recurso e ação
    if (resource && action) {
      return hasPermission(resource, action);
    }

    // Se especificou apenas recurso
    if (resource) {
      return canAccess(resource);
    }

    // Se não especificou nenhum critério, permitir acesso
    return true;
  };

  return {
    checkAccess,
    isSuperAdmin,
    isAdmin,
    isUser,
    currentRole
  };
};
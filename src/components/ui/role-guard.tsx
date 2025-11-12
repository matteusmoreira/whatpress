import React, { ReactNode, useEffect, useState } from 'react';
import { useRoleContext } from '@/contexts/useRoleContext';
 import { Alert, AlertDescription } from '@/components/ui/alert';
 import { Button } from '@/components/ui/button';
 import { Shield, AlertTriangle, Lock } from 'lucide-react';
 import { useNavigate } from 'react-router-dom';

interface RoleGuardProps {
  children: ReactNode;
  requiredRole?: 'SUPERADMIN' | 'ADMIN' | 'USER';
  requiredPermission?: {
    resource: string;
    action: string;
  };
  tenantId?: string;
  fallback?: ReactNode;
  showFallback?: boolean;
  redirectTo?: string;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  children,
  requiredRole,
  requiredPermission,
  tenantId,
  fallback,
  showFallback = true,
  redirectTo
}) => {
  const { 
    currentRole, 
    isSuperAdmin, 
    isAdmin, 
    isLoading, 
    checkPermission 
  } = useRoleContext();
  const isUser = currentRole === 'USER';
   
   const [hasPermission, setHasPermission] = useState<boolean | null>(null);
   const [permissionLoading, setPermissionLoading] = useState(false);
   const navigate = useNavigate();

   // Verificar permissão específica se fornecida
   useEffect(() => {
     const verifyPermission = async () => {
       if (!requiredPermission) {
         setHasPermission(true);
         return;
       }

       setPermissionLoading(true);
       try {
         const result = await checkPermission(
           requiredPermission.resource,
           requiredPermission.action,
           tenantId
         );
         setHasPermission(result);
       } catch (error) {
         console.error('Erro ao verificar permissão:', error);
         setHasPermission(false);
       } finally {
         setPermissionLoading(false);
       }
     };

    if (!isLoading) {
       verifyPermission();
     }
  }, [requiredPermission, tenantId, isLoading, checkPermission]);

   // Verificar role se fornecida
   const hasRequiredRole = (): boolean => {
     if (!requiredRole) return true;

     switch (requiredRole) {
       case 'SUPERADMIN':
         return isSuperAdmin;
       case 'ADMIN':
         return isSuperAdmin || isAdmin;
       case 'USER':
         return isSuperAdmin || isAdmin || isUser;
       default:
         return false;
     }
   };

   // Loading state
  if (isLoading || permissionLoading) {
     return (
       <div className="flex items-center justify-center p-8">
         <div className="flex items-center space-x-2">
           <Shield className="h-5 w-5 animate-spin" />
           <span className="text-muted-foreground">Verificando permissões...</span>
         </div>
       </div>
     );
   }

   // Verificar se tem acesso
   const hasRoleAccess = hasRequiredRole();
   const hasPermissionAccess = hasPermission !== false;
   const hasAccess = hasRoleAccess && hasPermissionAccess;

   // Se tem acesso, renderizar children
   if (hasAccess) {
     return <>{children}</>; 
   }

  // Se tem fallback customizado, usar ele
  if (fallback) {
    return <>{fallback}</>;
  }

  // Se não deve mostrar fallback, não renderizar nada
  if (!showFallback) {
    return null;
  }

  // Renderizar mensagem de acesso negado
  const handleRedirect = () => {
    if (redirectTo) {
      navigate(redirectTo);
    } else {
      navigate('/dashboard');
    }
  };

  const getAccessDeniedMessage = () => {
    if (!hasRoleAccess) {
      return {
        title: 'Acesso Restrito',
        description: `Esta funcionalidade requer nível de acesso ${requiredRole}. Seu nível atual: ${currentRole || 'Nenhum'}`,
        icon: Lock
      };
    }

    if (!hasPermissionAccess) {
      return {
        title: 'Permissão Negada',
        description: `Você não tem permissão para ${requiredPermission?.action} em ${requiredPermission?.resource}`,
        icon: AlertTriangle
      };
    }

    return {
      title: 'Acesso Negado',
      description: 'Você não tem permissão para acessar esta funcionalidade',
      icon: Shield
    };
  };

  const { title, description, icon: Icon } = getAccessDeniedMessage();

  return (
    <div className="flex items-center justify-center min-h-[400px] p-8">
      <div className="max-w-md w-full">
        <Alert className="border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive">
          <Icon className="h-4 w-4" />
          <AlertDescription className="mt-2">
            <div className="space-y-3">
              <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {description}
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleRedirect}
                  className="flex-1"
                >
                  Voltar ao Dashboard
                </Button>
                
                {!isSuperAdmin && (
                  <Button 
                    variant="default" 
                    size="sm"
                    onClick={() => navigate('/settings')}
                    className="flex-1"
                  >
                    Solicitar Acesso
                  </Button>
                )}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
};

// Componente para proteger rotas específicas
interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'SUPERADMIN' | 'ADMIN' | 'USER';
  requiredPermissions?: Array<{
    resource: string;
    action: string;
  }>;
  tenantId?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  requiredPermissions,
  tenantId
}) => {
  const navigate = useNavigate();

  // Se tem múltiplas permissões, verificar todas
  if (requiredPermissions && requiredPermissions.length > 1) {
    return (
      <div>
        {requiredPermissions.reduce((acc, permission, index) => (
          <RoleGuard
            key={index}
            requiredRole={requiredRole}
            requiredPermission={permission}
            tenantId={tenantId}
            showFallback={index === requiredPermissions.length - 1}
            redirectTo="/dashboard"
          >
            {acc}
          </RoleGuard>
        ), children)}
      </div>
    );
  }

  // Verificação simples
  return (
    <RoleGuard
      requiredRole={requiredRole}
      requiredPermission={requiredPermissions?.[0]}
      tenantId={tenantId}
      redirectTo="/dashboard"
    >
      {children}
    </RoleGuard>
  );
};

// Hook para usar dentro de componentes
export const useRoleGuard = (
  requiredRole?: 'SUPERADMIN' | 'ADMIN' | 'USER',
  requiredPermission?: { resource: string; action: string },
  tenantId?: string
) => {
  const { 
    currentRole, 
    isSuperAdmin, 
    isAdmin, 
    isLoading, 
    checkPermission 
  } = useRoleContext();
  const isUser = currentRole === 'USER';
   
   const [hasPermission, setHasPermission] = useState<boolean | null>(null);

   useEffect(() => {
     const verifyAccess = async () => {
       // Verificar role
       let hasRoleAccess = true;
       if (requiredRole) {
         switch (requiredRole) {
           case 'SUPERADMIN':
             hasRoleAccess = isSuperAdmin;
             break;
           case 'ADMIN':
             hasRoleAccess = isSuperAdmin || isAdmin;
             break;
           case 'USER':
             hasRoleAccess = isSuperAdmin || isAdmin || isUser;
             break;
         }
       }

       // Verificar permissão
       let hasPermissionAccess = true;
       if (requiredPermission && hasRoleAccess) {
         try {
           hasPermissionAccess = await checkPermission(
             requiredPermission.resource,
             requiredPermission.action,
             tenantId
           );
         } catch (error) {
           hasPermissionAccess = false;
         }
       }

       setHasPermission(hasRoleAccess && hasPermissionAccess);
     };

    if (!isLoading) {
       verifyAccess();
     }
  }, [requiredRole, requiredPermission, tenantId, isLoading, isSuperAdmin, isAdmin, isUser, checkPermission]);

   return {
     hasAccess: hasPermission,
    loading: isLoading || hasPermission === null,
     currentRole,
     isSuperAdmin,
     isAdmin,
     isUser
   };
 };

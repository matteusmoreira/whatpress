import React, { useEffect, useMemo, useRef } from 'react';
import { useRoleContext } from '@/contexts/useRoleContext';
import { UserRole } from '@/contexts/RoleContext';
import { useToast } from '@/hooks/use-toast';
import { Resources, Actions, isValidPermission } from '@/constants/permissions';

export interface PermissionGuardProps {
  allowedRoles?: UserRole[];
  resource?: (typeof Resources)[keyof typeof Resources];
  action?: (typeof Actions)[keyof typeof Actions];
  requireAll?: boolean; // Se true, exige role E permissão. Se false (default), basta uma das condições
  mode?: 'hide' | 'disable'; // hide: não renderiza; disable: renderiza desabilitado
  fallback?: React.ReactNode; // render quando negado, se mode === 'hide'
  showToastOnDeny?: boolean;
  reasonMessage?: string; // mensagem opcional para o toast/tooltip
  className?: string;
  children: React.ReactNode;
}

// Componente para proteger elementos de UI com base em role e/ou permissões granulares
export function PermissionGuard({
  allowedRoles,
  resource,
  action,
  requireAll = false,
  mode = 'hide',
  fallback = null,
  showToastOnDeny = false,
  reasonMessage,
  className,
  children,
}: PermissionGuardProps) {
  const { currentRole, hasPermission, canAccess, logAction } = useRoleContext();
  const { toast } = useToast();
  const loggedRef = useRef(false);

  const allowedByRole = useMemo(() => {
    if (!allowedRoles || allowedRoles.length === 0) return undefined; // não avalia
    return allowedRoles.includes(currentRole);
  }, [allowedRoles, currentRole]);

  const allowedByPermission = useMemo(() => {
    if (!resource) return undefined; // não avalia
    // Se forneceu action, validar e checar permissão específica
    if (action) {
      if (!isValidPermission(resource, action)) {
        console.warn(`[PermissionGuard] Invalid permission combo: resource="${resource}" action="${action}"`);
        return false;
      }
      return hasPermission(resource, action);
    }
    // Sem action, checa acesso ao recurso
    return canAccess(resource);
  }, [resource, action, hasPermission, canAccess]);

  const authorized = useMemo(() => {
    // Se requireAll: ambas condições verdadeiras quando definidas
    if (requireAll) {
      const roleOk = allowedByRole === undefined ? true : allowedByRole;
      const permOk = allowedByPermission === undefined ? true : allowedByPermission;
      return roleOk && permOk;
    }
    // Caso contrário, qualquer condição que esteja definida e seja verdadeira
    const checks: (boolean | undefined)[] = [allowedByRole, allowedByPermission];
    const definedChecks = checks.filter((c) => c !== undefined) as boolean[];
    if (definedChecks.length === 0) return true; // Sem critérios => sempre permitido
    return definedChecks.some(Boolean);
  }, [allowedByRole, allowedByPermission, requireAll]);

  useEffect(() => {
    if (!authorized && !loggedRef.current) {
      loggedRef.current = true;
      const reason = reasonMessage || (resource ? `Sem permissão para ${resource}${action ? `/${action}` : ''}` : 'Acesso negado');
      if (showToastOnDeny) {
        toast({
          title: 'Acesso negado',
          description: reason,
          variant: 'destructive',
        });
      }
      // Registrar auditoria
      logAction('access_denied_component', resource || 'unknown', {
        action: action || null,
        currentRole,
        allowedRoles: allowedRoles || null,
        mode,
      }).catch(() => {});
    }
  }, [authorized, showToastOnDeny, reasonMessage, resource, action, currentRole, allowedRoles, mode, logAction, toast]);

  if (authorized) {
    return (
      <>{children}</>
    );
  }

  if (mode === 'disable') {
    // Renderiza com aparência desabilitada e sem interação
    return (
      <div
        className={`opacity-50 pointer-events-none ${className || ''}`}
        aria-disabled="true"
        title={reasonMessage || (resource ? `Sem permissão para ${resource}${action ? `/${action}` : ''}` : 'Sem permissão')}
      >
        {children}
      </div>
    );
  }

  // mode === 'hide'
  return (
    <>{fallback}</>
  );
}

export default PermissionGuard;

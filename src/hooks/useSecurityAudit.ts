import { useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useTenant } from '@/hooks/useTenant'
import { useEncryption } from '@/hooks/useEncryption'

export interface SecurityEvent {
  id?: string
  user_id: string
  tenant_id?: string
  event_type: string
  event_category: 'authentication' | 'authorization' | 'data_access' | 'data_modification' | 'system_config' | 'encryption' | 'backup'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  resource_type?: string
  resource_id?: string
  ip_address?: string
  user_agent?: string
  success: boolean
  error_message?: string
  metadata?: Record<string, any>
  created_at?: string
}

export function useSecurityAudit() {
  const { user } = useAuth()
  const { currentTenant } = useTenant()
  const { createAuditLog, isEncryptionAvailable } = useEncryption()

  const logSecurityEvent = useCallback(async (event: Omit<SecurityEvent, 'id' | 'user_id' | 'tenant_id' | 'created_at'>) => {
    if (!user) return

    try {
      const userAgent = navigator.userAgent
      const ipAddress = await getClientIPAddress()

      const securityEvent: Omit<SecurityEvent, 'id' | 'created_at'> = {
        ...event,
        user_id: user.id,
        ...(currentTenant?.id ? { tenant_id: currentTenant.id } : {}),
        user_agent: userAgent,
        ip_address: ipAddress
      }

      // Criptografa dados sensíveis se a criptografia estiver disponível
      if (isEncryptionAvailable) {
        try {
          // Cria log de auditoria criptografado usando o serviço de criptografia
          await createAuditLog({
            eventType: event.event_type,
            eventCategory: event.event_category,
            severity: event.severity,
            description: event.description,
            resourceType: event.resource_type,
            resourceId: event.resource_id,
            success: event.success,
            errorMessage: event.error_message,
            metadata: event.metadata
          });
        } catch (encryptionError) {
          console.error('Erro ao criptografar log de auditoria:', encryptionError);
          // Fallback: salva log não criptografado
          const { error } = await supabase
            .from('security_audit_log')
            .insert([securityEvent]);

          if (error) {
            console.error('Erro ao registrar evento de segurança:', error);
          }
        }
      } else {
        // Salva log não criptografado se criptografia não estiver disponível
        const { error } = await supabase
          .from('security_audit_log')
          .insert([securityEvent]);

        if (error) {
          console.error('Erro ao registrar evento de segurança:', error);
        }
      }
    } catch (error) {
      console.error('Erro ao registrar evento de segurança:', error)
    }
  }, [user, currentTenant?.id, isEncryptionAvailable, createAuditLog])

  const getSecurityEvents = useCallback(async (options?: {
    limit?: number
    offset?: number
    category?: string
    severity?: string
    startDate?: Date
    endDate?: Date
    userId?: string
  }) => {
    if (!user) return []

    try {
      let query = supabase
        .from('security_audit_log')
        .select('*')
        .order('created_at', { ascending: false })

      // Aplicar filtros
      if (options?.limit) {
        query = query.limit(options.limit)
      }

      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1)
      }

      if (options?.category) {
        query = query.eq('event_category', options.category)
      }

      if (options?.severity) {
        query = query.eq('severity', options.severity)
      }

      if (options?.userId) {
        query = query.eq('user_id', options.userId)
      }

      if (options?.startDate) {
        query = query.gte('created_at', options.startDate.toISOString())
      }

      if (options?.endDate) {
        query = query.lte('created_at', options.endDate.toISOString())
      }

      // Aplicar filtro de tenant/user
      if (currentTenant?.id) {
        query = query.eq('tenant_id', currentTenant.id)
      } else {
        query = query.eq('user_id', user.id)
      }

      const { data, error } = await query

      if (error) {
        if (currentTenant?.id) {
          // Fallback: tentar sem tenant_id
          const fallback = await supabase
            .from('security_audit_log')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(options?.limit || 50)

          if (fallback.error) throw fallback.error
          return fallback.data || []
        }
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Erro ao buscar eventos de segurança:', error)
      return []
    }
  }, [user, currentTenant?.id])

  const getSecurityStats = useCallback(async (days: number = 30) => {
    if (!user) return null

    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      let query = supabase
        .from('security_audit_log')
        .select('event_category, severity, success')
        .gte('created_at', startDate.toISOString())

      // Aplicar filtro de tenant/user
      if (currentTenant?.id) {
        query = query.eq('tenant_id', currentTenant.id)
      } else {
        query = query.eq('user_id', user.id)
      }

      const { data, error } = await query

      if (error) {
        if (currentTenant?.id) {
          // Fallback: tentar sem tenant_id
          const fallback = await supabase
            .from('security_audit_log')
            .select('event_category, severity, success')
            .eq('user_id', user.id)
            .gte('created_at', startDate.toISOString())

          if (fallback.error) throw fallback.error
          return processSecurityStats(fallback.data || [])
        }
        throw error
      }

      return processSecurityStats(data || [])
    } catch (error) {
      console.error('Erro ao buscar estatísticas de segurança:', error)
      return null
    }
  }, [user, currentTenant?.id])

  const logAuthenticationEvent = useCallback(async (
    action: 'login' | 'logout' | 'login_failed' | 'password_reset' | 'mfa_enabled' | 'mfa_disabled',
    success: boolean,
    metadata?: Record<string, any>
  ) => {
    const eventDescriptions = {
      login: 'Usuário realizou login',
      logout: 'Usuário realizou logout',
      login_failed: 'Tentativa de login falhou',
      password_reset: 'Redefinição de senha',
      mfa_enabled: 'Autenticação de dois fatores ativada',
      mfa_disabled: 'Autenticação de dois fatores desativada'
    }

    await logSecurityEvent({
      event_type: `auth_${action}`,
      event_category: 'authentication',
      severity: action === 'login_failed' ? 'medium' : 'low',
      description: eventDescriptions[action],
      success,
      metadata
    })
  }, [logSecurityEvent])

  const logDataAccessEvent = useCallback(async (
    resourceType: string,
    resourceId: string,
    action: 'read' | 'write' | 'delete' | 'export',
    success: boolean,
    metadata?: Record<string, any>
  ) => {
    const actionDescriptions = {
      read: 'Acesso aos dados',
      write: 'Modificação dos dados',
      delete: 'Exclusão dos dados',
      export: 'Exportação dos dados'
    }

    await logSecurityEvent({
      event_type: `data_${action}`,
      event_category: 'data_access',
      severity: 'low',
      description: `${actionDescriptions[action]} - ${resourceType}`,
      resource_type: resourceType,
      resource_id: resourceId,
      success,
      metadata
    })
  }, [logSecurityEvent])

  const logEncryptionEvent = useCallback(async (
    action: 'encrypt' | 'decrypt' | 'key_generated' | 'key_rotated',
    resourceType: string,
    success: boolean,
    metadata?: Record<string, any>
  ) => {
    const actionDescriptions = {
      encrypt: 'Criptografia de dados',
      decrypt: 'Descriptografia de dados',
      key_generated: 'Chave de criptografia gerada',
      key_rotated: 'Rotação de chave de criptografia'
    }

    await logSecurityEvent({
      event_type: `encryption_${action}`,
      event_category: 'encryption',
      severity: action.includes('key') ? 'high' : 'medium',
      description: `${actionDescriptions[action]} - ${resourceType}`,
      resource_type: resourceType,
      success,
      metadata
    })
  }, [logSecurityEvent])

  const logBackupEvent = useCallback(async (
    action: 'backup_started' | 'backup_completed' | 'backup_failed' | 'restore_started' | 'restore_completed' | 'restore_failed',
    backupType: string,
    success: boolean,
    metadata?: Record<string, any>
  ) => {
    const actionDescriptions = {
      backup_started: 'Backup iniciado',
      backup_completed: 'Backup concluído',
      backup_failed: 'Backup falhou',
      restore_started: 'Restauração iniciada',
      restore_completed: 'Restauração concluída',
      restore_failed: 'Restauração falhou'
    }

    const severity = action.includes('failed') ? 'high' : action.includes('started') ? 'medium' : 'low'

    await logSecurityEvent({
      event_type: `backup_${action}`,
      event_category: 'backup',
      severity: severity as 'low' | 'medium' | 'high' | 'critical',
      description: `${actionDescriptions[action]} - ${backupType}`,
      resource_type: 'backup',
      success,
      metadata: {
        backup_type: backupType,
        ...metadata
      }
    })
  }, [logSecurityEvent])

  return {
    logSecurityEvent,
    getSecurityEvents,
    getSecurityStats,
    logAuthenticationEvent,
    logDataAccessEvent,
    logEncryptionEvent,
    logBackupEvent
  }
}

// Funções auxiliares
async function getClientIPAddress(): Promise<string> {
  try {
    // Tentar obter IP via API pública
    const response = await fetch('https://api.ipify.org?format=json')
    if (response.ok) {
      const data = await response.json()
      return data.ip
    }
  } catch (error) {
    // Fallback: retornar IP local ou desconhecido
    console.warn('Não foi possível obter endereço IP do cliente')
  }
  
  return 'unknown'
}

function processSecurityStats(data: any[]): {
  totalEvents: number
  failedEvents: number
  eventsByCategory: Record<string, number>
  eventsBySeverity: Record<string, number>
  recentEvents: any[]
} {
  const eventsByCategory: Record<string, number> = {}
  const eventsBySeverity: Record<string, number> = {}
  
  data.forEach(event => {
    // Contar por categoria
    eventsByCategory[event.event_category] = (eventsByCategory[event.event_category] || 0) + 1
    
    // Contar por severidade
    eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1
  })

  return {
    totalEvents: data.length,
    failedEvents: data.filter(event => !event.success).length,
    eventsByCategory,
    eventsBySeverity,
    recentEvents: data.slice(0, 10) // Últimos 10 eventos
  }
}
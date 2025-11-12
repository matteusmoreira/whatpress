import { useCallback, useRef, useMemo, useState } from 'react'
import { rateLimitService, RateLimitInfo } from '@/lib/rateLimit'
import { useToast } from '@/hooks/use-toast'

export interface RateLimitConfig {
  id?: string
  name?: string
  description?: string
  scope?: string
  target_id?: string
  messages_per_minute?: number
  messages_per_hour?: number
  messages_per_day?: number
  burst_limit?: number
  burst_window_seconds?: number
  cooldown_after_burst_minutes?: number
  time_window_start?: string
  time_window_end?: string
  allowed_days?: string[]
  adaptive_rate_enabled?: boolean
  adaptive_rate_factor?: number
  adaptive_rate_recovery_minutes?: number
  priority_multiplier?: number
  is_active?: boolean
  tenant_id?: string
  created_at?: string
  updated_at?: string
}

export function useRateLimit() {
  const { toast } = useToast()
  const lastChecks = useRef<Record<string, { allowed: boolean; nextAllowedAt: Date | null; remaining?: number }>>({})
  const [configs] = useState<RateLimitConfig[]>([])
  const [activeConfigs] = useState<RateLimitConfig[]>([])
  const [rateLimitStatuses] = useState<Array<{ config_id: string; messages_sent_hour: number; messages_sent_day: number }>>([])
  const isLoading = false

  const checkRateLimit = useCallback(async (
    key: string,
    configName: string = 'api_general',
    userId?: string,
    tenantId?: string
  ): Promise<{ allowed: boolean; info: RateLimitInfo }> => {
    try {
      const result = await rateLimitService.checkRateLimit(key, configName, userId, tenantId)
      
      if (!result.allowed) {
        toast({
          title: "Limite de requisições excedido",
          description: `Você atingiu o limite de ${result.info.limit} requisições. Tente novamente em ${Math.ceil((result.info.resetTime.getTime() - Date.now()) / 1000)} segundos.`,
          variant: "destructive",
        })
      }
      
      return result
    } catch (error) {
      console.error('Erro ao verificar rate limit:', error)
      // Em caso de erro, permitir a requisição
      return {
        allowed: true,
        info: {
          limit: 0,
          current: 0,
          remaining: 999999,
          resetTime: new Date(Date.now() + 60000)
        }
      }
    }
  }, [toast])

  const checkMessageRateLimit = useCallback(async (
    userId?: string,
    tenantId?: string
  ): Promise<{ allowed: boolean; info: RateLimitInfo }> => {
    return await checkRateLimit('message_send', 'message_send', userId, tenantId)
  }, [checkRateLimit])

  const checkBulkMessageRateLimit = useCallback(async (
    userId?: string,
    tenantId?: string
  ): Promise<{ allowed: boolean; info: RateLimitInfo }> => {
    return await checkRateLimit('bulk_message', 'bulk_message', userId, tenantId)
  }, [checkRateLimit])

  const checkAuthenticationRateLimit = useCallback(async (
    identifier: string,
    userId?: string,
    tenantId?: string
  ): Promise<{ allowed: boolean; info: RateLimitInfo }> => {
    return await checkRateLimit(identifier, 'authentication', userId, tenantId)
  }, [checkRateLimit])

  const checkPasswordResetRateLimit = useCallback(async (
    email: string,
    userId?: string,
    tenantId?: string
  ): Promise<{ allowed: boolean; info: RateLimitInfo }> => {
    return await checkRateLimit(email, 'password_reset', userId, tenantId)
  }, [checkRateLimit])

  const checkFileUploadRateLimit = useCallback(async (
    userId?: string,
    tenantId?: string
  ): Promise<{ allowed: boolean; info: RateLimitInfo }> => {
    return await checkRateLimit('file_upload', 'file_upload', userId, tenantId)
  }, [checkRateLimit])

  const checkTemplateCreationRateLimit = useCallback(async (
    userId?: string,
    tenantId?: string
  ): Promise<{ allowed: boolean; info: RateLimitInfo }> => {
    return await checkRateLimit('template_creation', 'template_creation', userId, tenantId)
  }, [checkRateLimit])

  const canSendMessage = useCallback((scope: string = 'global', _targetId?: string): boolean => {
    const record = lastChecks.current[scope]
    if (!record) return true
    if (record.allowed) return true
    if (record.nextAllowedAt && record.nextAllowedAt.getTime() <= Date.now()) return true
    return false
  }, [])

  const getNextAllowedTime = useCallback((scope: string = 'global', _targetId?: string): Date | null => {
    const record = lastChecks.current[scope]
    return record ? record.nextAllowedAt : null
  }, [])

  const getStatus = useCallback((scope: string = 'global', _targetId?: string): { isLimited: boolean; code: 'ok' | 'limited' } => {
    const record = lastChecks.current[scope]
    if (!record) return { isLimited: false, code: 'ok' }
    return record.allowed ? { isLimited: false, code: 'ok' } : { isLimited: true, code: 'limited' }
  }, [])

  const refreshData = useCallback(async (scope: string = 'global', userId?: string, tenantId?: string) => {
    const res = await checkMessageRateLimit(userId, tenantId)
    lastChecks.current[scope] = {
      allowed: res.allowed,
      nextAllowedAt: res.allowed ? null : res.info.resetTime,
      remaining: res.info.remaining
    }
    return lastChecks.current[scope]
  }, [checkMessageRateLimit])

  const getRemainingQuota = useCallback((scope: string = 'global', _targetId?: string): number => {
    const record = lastChecks.current[scope]
    return record?.remaining ?? rateLimitService.getConfig('message_send').points
  }, [])

  const createConfig = useCallback(async (_config: Omit<RateLimitConfig, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>): Promise<boolean> => {
    return true
  }, [])

  const updateConfig = useCallback(async (_id: string, _updates: Partial<RateLimitConfig>): Promise<boolean> => {
    return true
  }, [])

  const deleteConfig = useCallback(async (_id: string): Promise<boolean> => {
    return true
  }, [])

  const activateConfig = useCallback(async (_id: string): Promise<boolean> => {
    return true
  }, [])

  const deactivateConfig = useCallback(async (_id: string): Promise<boolean> => {
    return true
  }, [])

  return {
    checkRateLimit,
    checkMessageRateLimit,
    checkBulkMessageRateLimit,
    checkAuthenticationRateLimit,
    checkPasswordResetRateLimit,
    checkFileUploadRateLimit,
    checkTemplateCreationRateLimit,
    configs,
    activeConfigs,
    rateLimitStatuses,
    isLoading,
    canSendMessage,
    getNextAllowedTime,
    getRemainingQuota,
    getStatus,
    refreshData,
    createConfig,
    updateConfig,
    deleteConfig,
    activateConfig,
    deactivateConfig,
    getConfig: rateLimitService.getConfig.bind(rateLimitService),
    getAllConfigs: rateLimitService.getAllConfigs.bind(rateLimitService)
  }
}

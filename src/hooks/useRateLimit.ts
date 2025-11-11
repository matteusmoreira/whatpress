import { useCallback } from 'react'
import { rateLimitService, RateLimitInfo } from '@/lib/rateLimit'
import { useToast } from '@/hooks/use-toast'

export function useRateLimit() {
  const { toast } = useToast()

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

  return {
    checkRateLimit,
    checkMessageRateLimit,
    checkBulkMessageRateLimit,
    checkAuthenticationRateLimit,
    checkPasswordResetRateLimit,
    checkFileUploadRateLimit,
    checkTemplateCreationRateLimit,
    getConfig: rateLimitService.getConfig.bind(rateLimitService),
    getAllConfigs: rateLimitService.getAllConfigs.bind(rateLimitService)
  }
}
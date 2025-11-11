import { supabase } from '@/lib/supabase'
import { monitorFunction } from '@/lib/monitoring'
import crypto from 'crypto'

export interface APIKey {
  id: string
  name: string
  key: string
  tenant_id: string
  permissions: string[]
  rate_limit: number
  rate_limit_window: number
  is_active: boolean
  expires_at?: Date
  last_used_at?: Date
  created_at: Date
  updated_at: Date
}

export interface APIUser {
  id: string
  tenant_id: string
  api_key_id: string
  permissions: string[]
  rate_limit_remaining: number
  rate_limit_reset: number
}

export interface AuthRequest {
  apiKey: string
  method: string
  path: string
  ip?: string
  userAgent?: string
}

export interface RateLimitInfo {
  limit: number
  remaining: number
  reset: number
  window: number
}

class APIAuthService {
  private rateLimitStore = new Map<string, { count: number; reset: number }>()
  private readonly DEFAULT_RATE_LIMIT = 1000
  private readonly RATE_LIMIT_WINDOW = 3600000 // 1 hora

  /**
   * Autentica uma requisição API
   */
  async authenticate(request: AuthRequest): Promise<{
    user: APIUser | null
    error: string | null
    rateLimit: RateLimitInfo | null
  }> {
    return monitorFunction('api.auth.authenticate', async () => {
      try {
        // Validar formato da API key
        if (!this.isValidAPIKeyFormat(request.apiKey)) {
          return {
            user: null,
            error: 'Invalid API key format',
            rateLimit: null
          }
        }

        // Buscar API key no banco
        const apiKey = await this.getAPIKey(request.apiKey)
        if (!apiKey) {
          return {
            user: null,
            error: 'Invalid API key',
            rateLimit: null
          }
        }

        // Verificar se a key está ativa
        if (!apiKey.is_active) {
          return {
            user: null,
            error: 'API key is deactivated',
            rateLimit: null
          }
        }

        // Verificar expiração
        if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
          return {
            user: null,
            error: 'API key has expired',
            rateLimit: null
          }
        }

        // Verificar rate limiting
        const rateLimit = await this.checkRateLimit(apiKey, request)
        if (rateLimit.remaining <= 0) {
          return {
            user: null,
            error: 'Rate limit exceeded',
            rateLimit
          }
        }

        // Verificar permissões para o endpoint
        if (!this.hasPermission(apiKey, request.method, request.path)) {
          return {
            user: null,
            error: 'Insufficient permissions',
            rateLimit
          }
        }

        // Criar usuário API
        const user: APIUser = {
          id: apiKey.id,
          tenant_id: apiKey.tenant_id,
          api_key_id: apiKey.id,
          permissions: apiKey.permissions,
          rate_limit_remaining: rateLimit.remaining,
          rate_limit_reset: rateLimit.reset
        }

        // Atualizar último uso
        await this.updateLastUsed(apiKey.id)

        return {
          user,
          error: null,
          rateLimit
        }

      } catch (error) {
        console.error('Authentication error:', error)
        return {
          user: null,
          error: 'Authentication failed',
          rateLimit: null
        }
      }
    })
  }

  /**
   * Valida formato da API key
   */
  private isValidAPIKeyFormat(apiKey: string): boolean {
    // Formato: wp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    return /^wp_(live|test)_[a-zA-Z0-9]{32}$/.test(apiKey)
  }

  /**
   * Busca API key no banco de dados
   */
  private async getAPIKey(key: string): Promise<APIKey | null> {
    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('key', key)
      .single()

    if (error || !data) {
      return null
    }

    return {
      id: data.id,
      name: data.name,
      key: data.key,
      tenant_id: data.tenant_id,
      permissions: data.permissions || [],
      rate_limit: data.rate_limit || this.DEFAULT_RATE_LIMIT,
      rate_limit_window: data.rate_limit_window || this.RATE_LIMIT_WINDOW,
      is_active: data.is_active,
      expires_at: data.expires_at ? new Date(data.expires_at) : undefined,
      last_used_at: data.last_used_at ? new Date(data.last_used_at) : undefined,
      created_at: new Date(data.created_at),
      updated_at: new Date(data.updated_at)
    }
  }

  /**
   * Verifica rate limiting
   */
  private async checkRateLimit(apiKey: APIKey, request: AuthRequest): Promise<RateLimitInfo> {
    const key = `rate_limit:${apiKey.id}`
    const now = Date.now()
    const window = apiKey.rate_limit_window
    const limit = apiKey.rate_limit

    let current = this.rateLimitStore.get(key)

    // Reset se a janela expirou
    if (!current || now > current.reset) {
      current = {
        count: 0,
        reset: now + window
      }
      this.rateLimitStore.set(key, current)
    }

    // Incrementar contador
    current.count++

    return {
      limit,
      remaining: Math.max(0, limit - current.count),
      reset: current.reset,
      window
    }
  }

  /**
   * Verifica se a API key tem permissão para o endpoint
   */
  private hasPermission(apiKey: APIKey, method: string, path: string): boolean {
    // Admin tem todas as permissões
    if (apiKey.permissions.includes('admin')) {
      return true
    }

    // Verificar permissões específicas
    const requiredPermission = this.getRequiredPermission(method, path)
    return apiKey.permissions.includes(requiredPermission)
  }

  /**
   * Determina a permissão necessária para um endpoint
   */
  private getRequiredPermission(method: string, path: string): string {
    // Remover parâmetros da URL
    const cleanPath = path.split('?')[0].replace(/\/$/, '')
    const segments = cleanPath.split('/').filter(Boolean)

    // Mapear endpoints para permissões
    if (segments[0] === 'api' && segments[1] === 'v1') {
      const resource = segments[2]
      const action = this.methodToAction(method)
      return `${resource}:${action}`
    }

    return 'general:read'
  }

  /**
   * Converte método HTTP para ação
   */
  private methodToAction(method: string): string {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'read'
      case 'POST':
        return 'create'
      case 'PUT':
      case 'PATCH':
        return 'update'
      case 'DELETE':
        return 'delete'
      default:
        return 'read'
    }
  }

  /**
   * Atualiza último uso da API key
   */
  private async updateLastUsed(apiKeyId: string): Promise<void> {
    await supabase
      .from('api_keys')
      .update({ 
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', apiKeyId)
  }

  /**
   * Cria uma nova API key
   */
  async createAPIKey(params: {
    name: string
    tenant_id: string
    permissions: string[]
    rate_limit?: number
    expires_at?: Date
  }): Promise<APIKey> {
    return monitorFunction('api.auth.createAPIKey', async () => {
      const key = this.generateAPIKey()
      
      const { data, error } = await supabase
        .from('api_keys')
        .insert({
          name: params.name,
          key,
          tenant_id: params.tenant_id,
          permissions: params.permissions,
          rate_limit: params.rate_limit || this.DEFAULT_RATE_LIMIT,
          rate_limit_window: this.RATE_LIMIT_WINDOW,
          is_active: true,
          expires_at: params.expires_at?.toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        throw new Error(`Failed to create API key: ${error.message}`)
      }

      return {
        id: data.id,
        name: data.name,
        key: data.key,
        tenant_id: data.tenant_id,
        permissions: data.permissions || [],
        rate_limit: data.rate_limit,
        rate_limit_window: data.rate_limit_window,
        is_active: data.is_active,
        expires_at: data.expires_at ? new Date(data.expires_at) : undefined,
        last_used_at: data.last_used_at ? new Date(data.last_used_at) : undefined,
        created_at: new Date(data.created_at),
        updated_at: new Date(data.updated_at)
      }
    })
  }

  /**
   * Revoga uma API key
   */
  async revokeAPIKey(id: string): Promise<void> {
    await supabase
      .from('api_keys')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
  }

  /**
   * Lista API keys de um tenant
   */
  async listAPIKeys(tenant_id: string): Promise<APIKey[]> {
    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to list API keys: ${error.message}`)
    }

    return data.map(item => ({
      id: item.id,
      name: item.name,
      key: item.key,
      tenant_id: item.tenant_id,
      permissions: item.permissions || [],
      rate_limit: item.rate_limit,
      rate_limit_window: item.rate_limit_window,
      is_active: item.is_active,
      expires_at: item.expires_at ? new Date(item.expires_at) : undefined,
      last_used_at: item.last_used_at ? new Date(item.last_used_at) : undefined,
      created_at: new Date(item.created_at),
      updated_at: new Date(item.updated_at)
    }))
  }

  /**
   * Gera uma nova API key
   */
  private generateAPIKey(): string {
    const prefix = 'wp_live_'
    const randomBytes = crypto.randomBytes(16).toString('hex')
    return prefix + randomBytes
  }

  /**
   * Limpa rate limits expirados
   */
  cleanupRateLimits(): void {
    const now = Date.now()
    for (const [key, data] of this.rateLimitStore.entries()) {
      if (now > data.reset) {
        this.rateLimitStore.delete(key)
      }
    }
  }
}

export const apiAuth = new APIAuthService()

// Limpar rate limits expirados periodicamente
setInterval(() => {
  apiAuth.cleanupRateLimits()
}, 60000) // A cada minuto
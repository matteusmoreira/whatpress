import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible'
import { redis } from './redis'
import { supabase } from './supabase'

// Configurações de rate limiting
const rateLimitConfig = {
  // Rate limiting por IP
  byIP: {
    keyPrefix: 'rl:ip',
    points: 100,        // 100 requisições
    duration: 60,       // por minuto
    blockDuration: 60,  // bloquear por 1 minuto se exceder
  },
  
  // Rate limiting por usuário
  byUser: {
    keyPrefix: 'rl:user',
    points: 50,         // 50 requisições
    duration: 60,       // por minuto
    blockDuration: 120, // bloquear por 2 minutos se exceder
  },
  
  // Rate limiting por endpoint
  byEndpoint: {
    keyPrefix: 'rl:endpoint',
    points: 20,         // 20 requisições
    duration: 60,       // por minuto
    blockDuration: 30,  // bloquear por 30 segundos se exceder
  },
  
  // Rate limiting para envio de mensagens
  messageSending: {
    keyPrefix: 'rl:messages',
    points: 10,         // 10 mensagens
    duration: 60,       // por minuto
    blockDuration: 300, // bloquear por 5 minutos se exceder
  },
  
  // Rate limiting para login
  loginAttempts: {
    keyPrefix: 'rl:login',
    points: 5,          // 5 tentativas
    duration: 300,      // por 5 minutos
    blockDuration: 900, // bloquear por 15 minutos se exceder
  },
  
  // Rate limiting para cadastro
  registration: {
    keyPrefix: 'rl:register',
    points: 3,          // 3 cadastros
    duration: 3600,     // por hora
    blockDuration: 7200, // bloquear por 2 horas se exceder
  },
  
  // Rate limiting para webhooks
  webhookProcessing: {
    keyPrefix: 'rl:webhook',
    points: 50,         // 50 webhooks
    duration: 60,       // por minuto
    blockDuration: 60,  // bloquear por 1 minuto se exceder
  },
  
  // Rate limiting para upload de arquivos
  fileUpload: {
    keyPrefix: 'rl:upload',
    points: 10,         // 10 uploads
    duration: 60,       // por minuto
    blockDuration: 300, // bloquear por 5 minutos se exceder
  },
  
  // Rate limiting para API externa (WhatsApp)
  externalAPI: {
    keyPrefix: 'rl:external',
    points: 30,         // 30 chamadas
    duration: 60,       // por minuto
    blockDuration: 60,  // bloquear por 1 minuto se exceder
  },
  
  // Rate limiting para buscas
  searchQueries: {
    keyPrefix: 'rl:search',
    points: 20,         // 20 buscas
    duration: 60,       // por minuto
    blockDuration: 30,  // bloquear por 30 segundos se exceder
  },
  
  // Rate limiting para exportação de dados
  dataExport: {
    keyPrefix: 'rl:export',
    points: 5,          // 5 exportações
    duration: 3600,     // por hora
    blockDuration: 3600, // bloquear por 1 hora se exceder
  },
}

// Instâncias de rate limiters
export const rateLimiters = {
  // Rate limiter distribuído com Redis (preferencial)
  byIP: new RateLimiterRedis({
    storeClient: redis,
    ...rateLimitConfig.byIP,
  }),
  
  byUser: new RateLimiterRedis({
    storeClient: redis,
    ...rateLimitConfig.byUser,
  }),
  
  byEndpoint: new RateLimiterRedis({
    storeClient: redis,
    ...rateLimitConfig.byEndpoint,
  }),
  
  messageSending: new RateLimiterRedis({
    storeClient: redis,
    ...rateLimitConfig.messageSending,
  }),
  
  loginAttempts: new RateLimiterRedis({
    storeClient: redis,
    ...rateLimitConfig.loginAttempts,
  }),
  
  registration: new RateLimiterRedis({
    storeClient: redis,
    ...rateLimitConfig.registration,
  }),
  
  webhookProcessing: new RateLimiterRedis({
    storeClient: redis,
    ...rateLimitConfig.webhookProcessing,
  }),
  
  fileUpload: new RateLimiterRedis({
    storeClient: redis,
    ...rateLimitConfig.fileUpload,
  }),
  
  externalAPI: new RateLimiterRedis({
    storeClient: redis,
    ...rateLimitConfig.externalAPI,
  }),
  
  searchQueries: new RateLimiterRedis({
    storeClient: redis,
    ...rateLimitConfig.searchQueries,
  }),
  
  dataExport: new RateLimiterRedis({
    storeClient: redis,
    ...rateLimitConfig.dataExport,
  }),
}

// Fallback para memória se Redis não estiver disponível
export const memoryRateLimiters = {
  byIP: new RateLimiterMemory({
    ...rateLimitConfig.byIP,
  }),
  
  byUser: new RateLimiterMemory({
    ...rateLimitConfig.byUser,
  }),
  
  byEndpoint: new RateLimiterMemory({
    ...rateLimitConfig.byEndpoint,
  }),
  
  messageSending: new RateLimiterMemory({
    ...rateLimitConfig.messageSending,
  }),
  
  loginAttempts: new RateLimiterMemory({
    ...rateLimitConfig.loginAttempts,
  }),
  
  registration: new RateLimiterMemory({
    ...rateLimitConfig.registration,
  }),
  
  webhookProcessing: new RateLimiterMemory({
    ...rateLimitConfig.webhookProcessing,
  }),
  
  fileUpload: new RateLimiterMemory({
    ...rateLimitConfig.fileUpload,
  }),
  
  externalAPI: new RateLimiterMemory({
    ...rateLimitConfig.externalAPI,
  }),
  
  searchQueries: new RateLimiterMemory({
    ...rateLimitConfig.searchQueries,
  }),
  
  dataExport: new RateLimiterMemory({
    ...rateLimitConfig.dataExport,
  }),
}

// Função para obter o rate limiter apropriado
function getRateLimiter(type: keyof typeof rateLimiters) {
  // Se Redis estiver disponível, usar o distribuído
  if (redis.status === 'ready') {
    return rateLimiters[type]
  }
  
  // Fallback para memória
  return memoryRateLimiters[type]
}

// Função para verificar rate limit
export async function checkRateLimit(
  type: keyof typeof rateLimiters,
  key: string,
  pointsToConsume = 1
): Promise<{
  allowed: boolean
  remainingPoints: number
  msBeforeNext: number
  totalHits: number
}> {
  const limiter = getRateLimiter(type)
  
  try {
    const result = await limiter.consume(key, pointsToConsume)
    
    return {
      allowed: true,
      remainingPoints: result.remainingPoints,
      msBeforeNext: result.msBeforeNext,
      totalHits: result.totalHits,
    }
  } catch (error) {
    // Rate limit excedido
    if (error && typeof error === 'object' && 'msBeforeNext' in error) {
      return {
        allowed: false,
        remainingPoints: 0,
        msBeforeNext: error.msBeforeNext as number,
        totalHits: error.totalHits as number,
      }
    }
    
    // Outro erro, permitir por segurança mas logar
    console.error(`Erro no rate limiting (${type}):`, error)
    
    return {
      allowed: true,
      remainingPoints: 0,
      msBeforeNext: 0,
      totalHits: 0,
    }
  }
}

// Função para obter estatísticas de rate limiting
export async function getRateLimitStats(type: keyof typeof rateLimiters, key: string) {
  const limiter = getRateLimiter(type)
  
  try {
    const resRateLimiter = await limiter.get(key)
    
    if (resRateLimiter !== null) {
      return {
        totalHits: resRateLimiter.totalHits,
        totalReset: new Date(Date.now() + resRateLimiter.msBeforeNext),
        remainingPoints: limiter.points - resRateLimiter.totalHits,
      }
    }
    
    return {
      totalHits: 0,
      totalReset: new Date(Date.now() + limiter.duration * 1000),
      remainingPoints: limiter.points,
    }
  } catch (error) {
    console.error(`Erro ao obter estatísticas de rate limit (${type}):`, error)
    return null
  }
}

// Função para resetar rate limit de um usuário/especific key
export async function resetRateLimit(type: keyof typeof rateLimiters, key: string) {
  const limiter = getRateLimiter(type)
  
  try {
    await limiter.delete(key)
    return true
  } catch (error) {
    console.error(`Erro ao resetar rate limit (${type}):`, error)
    return false
  }
}

// Função para bloquear um usuário/especific key
export async function blockUser(type: keyof typeof rateLimiters, key: string, durationSeconds?: number) {
  const limiter = getRateLimiter(type)
  
  try {
    // Consumir todos os pontos para bloquear
    await limiter.consume(key, limiter.points)
    
    // Se duracao especificada, ajustar bloqueio
    if (durationSeconds) {
      await limiter.block(key, durationSeconds)
    }
    
    return true
  } catch (error) {
    console.error(`Erro ao bloquear usuário (${type}):`, error)
    return false
  }
}

// Middleware Express para rate limiting
export function createRateLimitMiddleware(
  type: keyof typeof rateLimiters,
  keyGenerator?: (req: any) => string,
  pointsToConsume = 1
) {
  return async (req: any, res: any, next: any) => {
    try {
      // Gerar chave baseada no tipo
      let key: string
      
      if (keyGenerator) {
        key = keyGenerator(req)
      } else {
        switch (type) {
          case 'byIP':
            key = req.ip || req.connection.remoteAddress || 'unknown'
            break
          case 'byUser':
            key = req.user?.id || 'anonymous'
            break
          case 'byEndpoint':
            key = `${req.method}:${req.path}`
            break
          case 'loginAttempts':
            key = req.body?.email || req.ip || 'unknown'
            break
          case 'registration':
            key = req.ip || 'unknown'
            break
          case 'messageSending':
            key = req.user?.id || req.ip || 'unknown'
            break
          default:
            key = req.ip || 'unknown'
        }
      }
      
      const result = await checkRateLimit(type, key, pointsToConsume)
      
      // Adicionar headers de rate limit
      res.set({
        'X-RateLimit-Limit': getRateLimiter(type).points,
        'X-RateLimit-Remaining': result.remainingPoints,
        'X-RateLimit-Reset': new Date(Date.now() + result.msBeforeNext).toISOString(),
      })
      
      if (!result.allowed) {
        // Registrar tentativa bloqueada
        await supabase.from('audit_logs').insert([{
          user_id: req.user?.id || null,
          action: 'rate_limit_exceeded',
          resource: type,
          metadata: {
            key,
            pointsToConsume,
            endpoint: req.path,
            method: req.method,
            ip: req.ip,
          },
          severity: 'warning',
        }])
        
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit excedido. Tente novamente mais tarde.',
          retryAfter: Math.ceil(result.msBeforeNext / 1000),
        })
      }
      
      next()
    } catch (error) {
      console.error('Erro no middleware de rate limiting:', error)
      // Em caso de erro, permitir por segurança mas logar
      next()
    }
  }
}

// Função para verificar se Redis está disponível
export function isRedisAvailable() {
  return redis.status === 'ready'
}

// Função para obter estatísticas gerais de rate limiting
export async function getGlobalRateLimitStats() {
  const stats = {
    redisAvailable: isRedisAvailable(),
    limiters: {} as Record<string, any>,
  }
  
  // Obter configurações de cada limiter
  Object.keys(rateLimitConfig).forEach(key => {
    const config = rateLimitConfig[key as keyof typeof rateLimitConfig]
    stats.limiters[key] = {
      points: config.points,
      duration: config.duration,
      blockDuration: config.blockDuration,
      keyPrefix: config.keyPrefix,
    }
  })
  
  return stats
}

export default {
  rateLimiters,
  memoryRateLimiters,
  checkRateLimit,
  getRateLimitStats,
  resetRateLimit,
  blockUser,
  createRateLimitMiddleware,
  isRedisAvailable,
  getGlobalRateLimitStats,
}

export interface RateLimitInfo {
  limit: number
  current: number
  remaining: number
  resetTime: Date
}

const CLIENT_CONFIG_MAP: Record<string, keyof typeof rateLimiters> = {
  api_general: 'byIP',
  message_send: 'messageSending',
  bulk_message: 'messageSending',
  authentication: 'loginAttempts',
  password_reset: 'loginAttempts',
  file_upload: 'fileUpload',
  template_creation: 'byUser',
}

export const rateLimitService = {
  getConfig: (name: string) => {
    const type = CLIENT_CONFIG_MAP[name] || 'byIP'
    const cfg = (rateLimitConfig as any)[type]
    return {
      name,
      points: cfg.points,
      duration: cfg.duration,
      blockDuration: cfg.blockDuration,
    }
  },
  getAllConfigs: () => {
    return Object.keys(CLIENT_CONFIG_MAP).map(name => {
      const type = CLIENT_CONFIG_MAP[name]
      const cfg = (rateLimitConfig as any)[type]
      return {
        name,
        points: cfg.points,
        duration: cfg.duration,
        blockDuration: cfg.blockDuration,
      }
    })
  },
  checkRateLimit: async (
    key: string,
    configName: string,
    _userId?: string,
    _tenantId?: string
  ): Promise<{ allowed: boolean; info: RateLimitInfo }> => {
    const type = CLIENT_CONFIG_MAP[configName] || 'byIP'
    const res = await checkRateLimit(type, key, 1)
    const limiter = getRateLimiter(type)
    const info: RateLimitInfo = {
      limit: limiter.points,
      current: Math.max(0, limiter.points - res.remainingPoints),
      remaining: res.remainingPoints,
      resetTime: new Date(Date.now() + res.msBeforeNext),
    }
    return { allowed: res.allowed, info }
  }
}
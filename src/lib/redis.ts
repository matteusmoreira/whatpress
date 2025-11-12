import { env } from './env'

const isBrowser = typeof window !== 'undefined'

const redisConfig = {
  host: env.VITE_REDIS_HOST || 'localhost',
  port: parseInt(env.VITE_REDIS_PORT || '6379'),
  password: env.VITE_REDIS_PASSWORD,
  db: parseInt(env.VITE_REDIS_DB || '0'),
  maxRetriesPerRequest: 3,
  retryDelayOnFailure: 1000,
  enableReadyCheck: true,
  maxmemoryPolicy: 'allkeys-lru',
  lazyConnect: true,
  keepAlive: 30000,
  family: 4,
  tls: env.VITE_REDIS_TLS === 'true' ? {} : undefined,
  // Configurações de retry
  retryDelayOnFailover: 100,
  enableOfflineQueue: true,
  // Configurações de performance
  connectTimeout: 10000,
  commandTimeout: 5000,
  // Configurações de pool
  maxmemory: '256mb',
}

type RedisLike = {
  get?: (...args: any[]) => Promise<any>
  setex?: (...args: any[]) => Promise<any>
  del?: (...args: any[]) => Promise<any>
  keys?: (...args: any[]) => Promise<string[]>
  exists?: (...args: any[]) => Promise<any>
  incrby?: (...args: any[]) => Promise<number>
  info?: (...args: any[]) => Promise<any>
  memory?: (...args: any[]) => Promise<any>
  status?: string
  serverInfo?: any
  on?: (...args: any[]) => any
  flushall?: (...args: any[]) => Promise<any>
  set?: (...args: any[]) => Promise<any>
  multi?: (...args: any[]) => any
}

const stubClient: RedisLike = {
  get: async () => null,
  setex: async () => undefined,
  del: async () => undefined,
  keys: async () => [],
  exists: async () => false,
  incrby: async () => 0,
  info: async () => '',
  memory: async () => '',
  status: 'offline',
  serverInfo: {},
  on: () => undefined,
  flushall: async () => undefined,
  set: async () => 'OK',
  multi: () => ({
    incr: () => undefined,
    expire: () => undefined,
    exec: async () => [],
  })
}

let redisClientPromise: Promise<any> | null = null
let redisPubPromise: Promise<any> | null = null
let redisSubPromise: Promise<any> | null = null
let redisQueuePromise: Promise<any> | null = null

async function loadRedisClient(config: Record<string, any>) {
  const mod: any = await import('ioredis')
  const Ctor = mod?.default || mod?.Redis || mod
  return new Ctor(config)
}

function getClientPromise(): Promise<any> | null {
  if (isBrowser) return null
  if (!redisClientPromise) {
    redisClientPromise = loadRedisClient(redisConfig)
  }
  return redisClientPromise
}

function getPubPromise(): Promise<any> | null {
  if (isBrowser) return null
  if (!redisPubPromise) {
    redisPubPromise = loadRedisClient(redisConfig)
  }
  return redisPubPromise
}

function getSubPromise(): Promise<any> | null {
  if (isBrowser) return null
  if (!redisSubPromise) {
    redisSubPromise = loadRedisClient(redisConfig)
  }
  return redisSubPromise
}

function getQueuePromise(): Promise<any> | null {
  if (isBrowser) return null
  if (!redisQueuePromise) {
    redisQueuePromise = loadRedisClient({
      ...redisConfig,
      db: parseInt(env.VITE_REDIS_QUEUE_DB || '1'),
      maxRetriesPerRequest: 5,
      retryDelayOnFailure: 500,
    })
  }
  return redisQueuePromise
}

export const redis: RedisLike = {
  async get(...args: any[]) {
    if (isBrowser) return stubClient.get!(...args)
    const c = await getClientPromise()!
    return c.get(...args)
  },
  async setex(...args: any[]) {
    if (isBrowser) return stubClient.setex!(...args)
    const c = await getClientPromise()!
    return c.setex(...args)
  },
  async del(...args: any[]) {
    if (isBrowser) return stubClient.del!(...args)
    const c = await getClientPromise()!
    return c.del(...args)
  },
  async keys(...args: any[]) {
    if (isBrowser) return stubClient.keys!(...args)
    const c = await getClientPromise()!
    return c.keys(...args)
  },
  async exists(...args: any[]) {
    if (isBrowser) return stubClient.exists!(...args)
    const c = await getClientPromise()!
    return c.exists(...args)
  },
  async incrby(...args: any[]) {
    if (isBrowser) return stubClient.incrby!(...args)
    const c = await getClientPromise()!
    return c.incrby(...args)
  },
  async info(...args: any[]) {
    if (isBrowser) return stubClient.info!(...args)
    const c = await getClientPromise()!
    return c.info(...args)
  },
  async memory(...args: any[]) {
    if (isBrowser) return stubClient.memory!(...args)
    const c = await getClientPromise()!
    return c.memory(...args)
  },
  status: isBrowser ? 'offline' : 'unknown',
  serverInfo: {},
  on(...args: any[]) {
    if (isBrowser) return stubClient.on!(...args)
    getClientPromise()!.then(c => c.on(...args))
  },
  async flushall(...args: any[]) {
    if (isBrowser) return stubClient.flushall!(...args)
    const c = await getClientPromise()!
    return c.flushall(...args)
  },
  async set(...args: any[]) {
    if (isBrowser) return stubClient.set!(...args)
    const c = await getClientPromise()!
    return c.set(...args)
  },
  multi(...args: any[]) {
    if (isBrowser) return stubClient.multi!(...args)
    const m = {
      incr: (key: string) => {
        getClientPromise()!.then(c => c.multi().incr(key))
        return undefined
      },
      expire: (key: string, ttl: number) => {
        getClientPromise()!.then(c => c.multi().expire(key, ttl))
        return undefined
      },
      exec: async () => {
        const c = await getClientPromise()!
        const pipeline = c.multi()
        return pipeline.exec()
      }
    }
    return m
  }
}

export const redisPub: RedisLike = {
  on(...args: any[]) {
    if (isBrowser) return stubClient.on!(...args)
    getPubPromise()!.then(c => c.on(...args))
  }
}

export const redisSub: RedisLike = {
  on(...args: any[]) {
    if (isBrowser) return stubClient.on!(...args)
    getSubPromise()!.then(c => c.on(...args))
  }
}

export const redisQueue: RedisLike = {
  async get(...args: any[]) {
    if (isBrowser) return stubClient.get!(...args)
    const c = await getQueuePromise()!
    return c.get(...args)
  },
  on(...args: any[]) {
    if (isBrowser) return stubClient.on!(...args)
    getQueuePromise()!.then(c => c.on(...args))
  }
}

redis.on('connect', () => {})
redis.on('error', () => {})
redis.on('ready', () => {})
redis.on('close', () => {})

// Funções auxiliares para cache
export const cacheUtils = {
  // Gerar chave de cache com namespace
  generateKey: (namespace: string, ...parts: string[]): string => {
    return `${env.VITE_REDIS_PREFIX || 'whatpress'}:${namespace}:${parts.join(':')}`
  },

  // Definir valor com TTL
  setWithTTL: async (key: string, value: any, ttl: number = 3600): Promise<void> => {
    try {
      await redis.setex(key, ttl, JSON.stringify(value))
    } catch (error) {
      console.error('Erro ao definir cache:', error)
      throw error
    }
  },

  // Obter valor
  get: async (key: string): Promise<any | null> => {
    try {
      const value = await redis.get(key)
      return value ? JSON.parse(value) : null
    } catch (error) {
      console.error('Erro ao obter cache:', error)
      return null
    }
  },

  // Deletar chave
  del: async (key: string): Promise<void> => {
    try {
      await redis.del(key)
    } catch (error) {
      console.error('Erro ao deletar cache:', error)
      throw error
    }
  },

  // Deletar múltiplas chaves por padrão
  delByPattern: async (pattern: string): Promise<number> => {
    try {
      const keys = await redis.keys(pattern)
      if (keys.length > 0) {
        return await redis.del(...keys)
      }
      return 0
    } catch (error) {
      console.error('Erro ao deletar cache por padrão:', error)
      return 0
    }
  },

  // Verificar se chave existe
  exists: async (key: string): Promise<boolean> => {
    try {
      const result = await redis.exists(key)
      return result === 1
    } catch (error) {
      console.error('Erro ao verificar cache:', error)
      return false
    }
  },

  // Incrementar contador
  increment: async (key: string, amount: number = 1): Promise<number> => {
    try {
      return await redis.incrby(key, amount)
    } catch (error) {
      console.error('Erro ao incrementar cache:', error)
      throw error
    }
  },

  // Obter estatísticas do Redis
  getStats: async () => {
    try {
      const info = await redis.info()
      const memory = await redis.memory('usage', 'samples=0')
      
      return {
        connected: redis.status === 'ready',
        uptime: redis.serverInfo?.uptime_in_seconds || 0,
        memory: {
          used: parseInt(redis.serverInfo?.used_memory || '0'),
          peak: parseInt(redis.serverInfo?.used_memory_peak || '0'),
          human: redis.serverInfo?.used_memory_human || '0B'
        },
        connections: {
          connected: parseInt(redis.serverInfo?.connected_clients || '0'),
          blocked: parseInt(redis.serverInfo?.blocked_clients || '0')
        },
        commands: {
          processed: parseInt(redis.serverInfo?.total_commands_processed || '0'),
          perSecond: parseFloat(redis.serverInfo?.instantaneous_ops_per_sec || '0')
        },
        keyspace: redis.serverInfo?.db0 || '0 keys'
      }
    } catch (error) {
      console.error('Erro ao obter estatísticas do Redis:', error)
      return null
    }
  },

  // Limpar todo o cache (use com cuidado!)
  flushAll: async (): Promise<void> => {
    try {
      await redis.flushall()
    } catch (error) {
      console.error('Erro ao limpar cache:', error)
      throw error
    }
  }
}

// Funções para rate limiting
export const rateLimitUtils = {
  // Incrementar contador de requisições
  incrementRequest: async (key: string, window: number = 60): Promise<number> => {
    try {
      const multi = redis.multi()
      const windowKey = `rate_limit:${key}:${Math.floor(Date.now() / (window * 1000))}`
      
      multi.incr(windowKey)
      multi.expire(windowKey, window)
      
      const results = await multi.exec()
      return results?.[0]?.[1] as number || 0
    } catch (error) {
      console.error('Erro ao incrementar rate limit:', error)
      return 0
    }
  },

  // Obter contador atual
  getRequestCount: async (key: string, window: number = 60): Promise<number> => {
    try {
      const windowKey = `rate_limit:${key}:${Math.floor(Date.now() / (window * 1000))}`
      const count = await redis.get(windowKey)
      return count ? parseInt(count) : 0
    } catch (error) {
      console.error('Erro ao obter contador de rate limit:', error)
      return 0
    }
  },

  // Verificar se está dentro do limite
  checkLimit: async (key: string, limit: number, window: number = 60): Promise<boolean> => {
    try {
      const count = await rateLimitUtils.getRequestCount(key, window)
      return count < limit
    } catch (error) {
      console.error('Erro ao verificar limite:', error)
      return true // Em caso de erro, permitir (fail open)
    }
  }
}

// Funções para sessões e locks distribuídos
export const distributedUtils = {
  // Obter lock distribuído
  acquireLock: async (key: string, ttl: number = 30000): Promise<boolean> => {
    try {
      const lockKey = `lock:${key}`
      const result = await redis.set(lockKey, '1', 'PX', ttl, 'NX')
      return result === 'OK'
    } catch (error) {
      console.error('Erro ao adquirir lock:', error)
      return false
    }
  },

  // Liberar lock
  releaseLock: async (key: string): Promise<void> => {
    try {
      const lockKey = `lock:${key}`
      await redis.del(lockKey)
    } catch (error) {
      console.error('Erro ao liberar lock:', error)
    }
  },

  // Publicar mensagem
  publish: async (channel: string, message: any): Promise<void> => {
    try {
      await redisPub.publish(channel, JSON.stringify(message))
    } catch (error) {
      console.error('Erro ao publicar mensagem:', error)
      throw error
    }
  },

  // Assinar canal
  subscribe: async (channel: string, callback: (message: any) => void): Promise<void> => {
    try {
      await redisSub.subscribe(channel)
      redisSub.on('message', (receivedChannel, message) => {
        if (receivedChannel === channel) {
          try {
            callback(JSON.parse(message))
          } catch (error) {
            console.error('Erro ao processar mensagem:', error)
          }
        }
      })
    } catch (error) {
      console.error('Erro ao assinar canal:', error)
      throw error
    }
  }
}

export default redis
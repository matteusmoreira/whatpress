import * as Sentry from '@sentry/react'
import React from 'react'
import { useLocation, useNavigationType, createRoutesFromChildren, matchRoutes } from 'react-router-dom'
import { env } from './env'

// Configuração do Sentry
export const initializeSentry = () => {
  if (env.VITE_SENTRY_DSN) {
    Sentry.init({
      dsn: env.VITE_SENTRY_DSN,
      environment: env.VITE_ENVIRONMENT || 'development',
      integrations: [
        ...(typeof window !== 'undefined' ? [
          Sentry.browserTracingIntegration({
            routingInstrumentation: Sentry.reactRouterV6Instrumentation(
              React.useEffect,
              useLocation,
              useNavigationType,
              createRoutesFromChildren,
              matchRoutes
            ),
          })
        ] : []),
      ],
      tracesSampleRate: env.VITE_ENVIRONMENT === 'production' ? 0.1 : 1.0,
      tracePropagationTargets: ['localhost', env.VITE_API_URL || '', /^\/api\//],
      beforeSend: (event, hint) => {
        // Filtrar eventos sensíveis
        if (event.exception) {
          const error = hint.originalException
          if (error && error.toString().includes('senha')) {
            return null // Não enviar erros com senhas
          }
        }
        
        // Remover dados sensíveis dos eventos
        if (event.request) {
          if (event.request.headers) {
            delete event.request.headers['authorization']
            delete event.request.headers['x-api-key']
            delete event.request.headers['cookie']
          }
        }
        
        return event
      },
      ignoreErrors: [
        // Ignorar erros conhecidos e não críticos
        'ResizeObserver loop limit exceeded',
        'Non-Error promise rejection captured',
        'Network Error',
        'Failed to fetch',
        'Request aborted',
        'User denied geolocation',
        'Permission denied',
        'NotAllowedError',
        'AbortError',
      ],
      denyUrls: [
        // Ignorar erros de extensões do navegador
        /extensions\//i,
        /^chrome:\/\//i,
        /^chrome-extension:\/\//i,
      ],
    })
    
    console.log('✅ Sentry inicializado')
  } else {
    console.log('⚠️ Sentry DSN não configurado')
  }
}

// Classe para monitoramento de performance
export class PerformanceMonitor {
  private rootSpan: Sentry.Span | null = null
  private spans: Map<string, Sentry.Span> = new Map()

  startTransaction(name: string, operation: string) {
    this.rootSpan = Sentry.startSpanManual({
      name,
      op: operation,
    })
    return this.rootSpan
  }

  startSpan(name: string, operation: string) {
    const span = Sentry.startSpanManual({
      name,
      op: operation,
    })
    this.spans.set(name, span)
    return span
  }

  finishSpan(name: string) {
    const span = this.spans.get(name)
    if (span) {
      (span as any).end?.()
      this.spans.delete(name)
    }
  }

  finishTransaction() {
    if (this.rootSpan) {
      (this.rootSpan as any).end?.()
      this.rootSpan = null
      this.spans.clear()
    }
  }

  setTag(key: string, value: string) {
    Sentry.setTag(key, value)
  }

  setContext(name: string, context: any) {
    Sentry.setContext(name, context)
  }

  setUser(user: any) {
    Sentry.setUser(user)
  }
}

// Helper to safely get current transaction without throwing in non-initialized contexts
const getActiveTransaction = (): Sentry.Transaction | null => {
  try {
    // Some environments may not have a scope or transaction
    const hub = (Sentry as any)?.getCurrentHub?.()
    const scope = hub?.getScope?.()
    const tx = scope?.getTransaction?.()
    return tx ?? null
  } catch {
    return null
  }
}

// Funções auxiliares para monitoramento
export async function monitorFunction<T>(
  name: string,
  fn: () => Promise<T>,
  options?: any
): Promise<T>
export async function monitorFunction<T>(
  name: string,
  operation: string,
  fn: () => Promise<T>,
  options?: any
): Promise<T>
export async function monitorFunction<T>(
  fn: () => Promise<T>,
  options?: any
): Promise<T>
export async function monitorFunction<T>(
  nameOrFn: any,
  opOrFnOrOptions?: any,
  fnMaybe?: any,
  optionsMaybe?: any
): Promise<T> {
  const isNameString = typeof nameOrFn === 'string'
  const isFirstArgFn = typeof nameOrFn === 'function'

  let name = 'function'
  let operation = 'function'
  let fn: () => Promise<T>
  let options: any = {}

  if (isNameString) {
    name = nameOrFn
    if (typeof opOrFnOrOptions === 'function') {
      fn = opOrFnOrOptions
      options = fnMaybe || {}
    } else {
      operation = typeof opOrFnOrOptions === 'string' ? opOrFnOrOptions : 'function'
      fn = fnMaybe
      options = optionsMaybe || {}
    }
  } else if (isFirstArgFn) {
    fn = nameOrFn
    options = opOrFnOrOptions || {}
    name = options?.functionName || options?.name || 'function'
    operation = options?.operation || options?.category || 'function'
  } else {
    throw new Error('Invalid monitorFunction arguments')
  }

  return await Sentry.startSpan({ name, op: operation }, async () => {
    try {
      const result = await fn()
      return result as T
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation, function: name },
        extra: options,
      })
      throw error
    }
  })
}

export async function monitorAPIRequest<T>(
  url: string,
  method: string,
  fn: () => Promise<T>,
  context?: any
): Promise<T>
export async function monitorAPIRequest<T>(
  fn: () => Promise<T>,
  options?: { url: string; method: string; operation?: string; [key: string]: any }
): Promise<T>
export async function monitorAPIRequest<T>(
  urlOrFn: any,
  methodOrOptions?: any,
  fnMaybe?: any,
  contextMaybe?: any
): Promise<T> {
  let url = ''
  let method = 'GET'
  let operation = 'http'
  let fn: () => Promise<T>
  let context: any = {}

  if (typeof urlOrFn === 'function') {
    fn = urlOrFn
    const options = methodOrOptions || {}
    url = options.url || ''
    method = options.method || 'GET'
    operation = options.operation || 'http'
    context = options
  } else {
    url = urlOrFn
    method = methodOrOptions
    fn = fnMaybe
    context = contextMaybe || {}
  }

  return await Sentry.startSpan({
    name: `${String(method).toUpperCase()} ${url}`,
    op: operation,
  }, async () => {
    try {
      const result = await fn()
      return result as T
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          operation: 'api_request',
          method: String(method).toUpperCase(),
          url,
        },
        extra: context,
      })
      throw error
    }
  })
}

// A flexible monitor for DB queries supporting both signatures:
// 1) monitorDatabaseQuery('SELECT ...', async () => {...}, context)
// 2) monitorDatabaseQuery(async () => {...}, { query: 'SELECT ...', operation: 'select', ... })
export const monitorDatabaseQuery = async <T>(
  queryOrFn: any,
  fnOrContext?: any,
  context?: any
): Promise<T> => {
  const transaction = getActiveTransaction()

  const isFirstArgFunction = typeof queryOrFn === 'function'
  const fn: () => Promise<T> = isFirstArgFunction ? queryOrFn : (fnOrContext as () => Promise<T>)
  const meta = isFirstArgFunction ? (fnOrContext || {}) : (context || {})

  const rawQuery = isFirstArgFunction ? (meta?.query || meta?.text || meta?.name) : queryOrFn
  const queryDesc: string = typeof rawQuery === 'string' && rawQuery.length > 0 ? rawQuery : 'query'
  const queryType: string = (() => {
    if (typeof rawQuery === 'string' && rawQuery.length > 0) {
      const first = rawQuery.trim().split(/\s+/)[0]
      return (first || 'query').toLowerCase()
    }
    const op = meta?.operation || meta?.op || meta?.type
    return (typeof op === 'string' && op.length > 0 ? op : 'query').toLowerCase()
  })()

  const span = transaction?.startChild({
    name: queryDesc,
    op: 'db',
    description: queryDesc,
    data: {
      'db.system': 'postgresql',
      'db.operation': queryType,
      ...meta,
    },
  })

  try {
    const result = await fn()
    span?.setStatus('ok')
    return result
  } catch (error) {
    span?.setStatus('internal_error')
    Sentry.captureException(error, {
      tags: {
        operation: 'database_query',
        query_type: queryType,
      },
      extra: meta,
    })
    throw error
  } finally {
    span?.finish()
  }
}

export const monitorCacheOperation = async <T>(
  operation: 'get' | 'set' | 'del' | 'exists',
  key: string,
  fn: () => Promise<T>,
  context?: any
): Promise<T> => {
  const transaction = getActiveTransaction()
  
  const span = transaction?.startChild({
    name: `cache.${operation}`,
    op: 'cache',
    description: `Cache ${operation} operation`,
    data: {
      'cache.operation': operation,
      'cache.key': key,
      ...context,
    },
  })

  try {
    const result = await fn()
    
    span?.setStatus('ok')
    return result
  } catch (error) {
    span?.setStatus('internal_error')
    
    Sentry.captureException(error, {
      tags: { 
        operation: 'cache_operation',
        cache_operation: operation,
      },
      extra: { key, ...context },
    })
    
    throw error
  } finally {
    span?.finish()
  }
}

export const monitorQueueJob = async <T>(
  queueName: string,
  fn: () => Promise<T>,
  context?: any
): Promise<T> => {
  const span = Sentry.startSpanManual({
    name: `queue.${queueName}`,
    op: 'queue',
  })

  try {
    const result = await fn()
    (span as any).setStatus?.('ok')
    return result
  } catch (error) {
    (span as any).setStatus?.('internal_error')
    Sentry.captureException(error, {
      tags: { 
        operation: 'queue_job',
        queue: queueName,
      },
      extra: context,
    })
    throw error
  } finally {
    (span as any).end?.()
  }
}

// Classe para alertas de performance
export class PerformanceAlert {
  private thresholds = {
    apiResponseTime: 5000, // 5 segundos
    databaseQueryTime: 2000, // 2 segundos
    cacheHitRate: 0.8, // 80%
    memoryUsage: 0.9, // 90%
    errorRate: 0.05, // 5%
  }

  checkAPIResponseTime(responseTime: number): boolean {
    if (responseTime > this.thresholds.apiResponseTime) {
      Sentry.captureMessage(`API response time alert: ${responseTime}ms`, {
        level: 'warning',
        tags: { type: 'performance', metric: 'api_response_time' },
        extra: { responseTime, threshold: this.thresholds.apiResponseTime },
      })
      return true
    }
    return false
  }

  checkDatabaseQueryTime(queryTime: number): boolean {
    if (queryTime > this.thresholds.databaseQueryTime) {
      Sentry.captureMessage(`Database query time alert: ${queryTime}ms`, {
        level: 'warning',
        tags: { type: 'performance', metric: 'database_query_time' },
        extra: { queryTime, threshold: this.thresholds.databaseQueryTime },
      })
      return true
    }
    return false
  }

  checkCacheHitRate(hitRate: number): boolean {
    if (hitRate < this.thresholds.cacheHitRate) {
      Sentry.captureMessage(`Cache hit rate alert: ${(hitRate * 100).toFixed(1)}%`, {
        level: 'warning',
        tags: { type: 'performance', metric: 'cache_hit_rate' },
        extra: { hitRate, threshold: this.thresholds.cacheHitRate },
      })
      return true
    }
    return false
  }

  checkMemoryUsage(usage: number): boolean {
    if (usage > this.thresholds.memoryUsage) {
      Sentry.captureMessage(`Memory usage alert: ${(usage * 100).toFixed(1)}%`, {
        level: 'error',
        tags: { type: 'performance', metric: 'memory_usage' },
        extra: { usage, threshold: this.thresholds.memoryUsage },
      })
      return true
    }
    return false
  }

  checkErrorRate(errorRate: number): boolean {
    if (errorRate > this.thresholds.errorRate) {
      Sentry.captureMessage(`Error rate alert: ${(errorRate * 100).toFixed(1)}%`, {
        level: 'error',
        tags: { type: 'performance', metric: 'error_rate' },
        extra: { errorRate, threshold: this.thresholds.errorRate },
      })
      return true
    }
    return false
  }
}

// Função para obter saúde do sistema
export const getSystemHealth = async () => {
  const health = {
    status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
    components: {
      database: { status: 'unknown', latency: 0, lastCheck: new Date() },
      redis: { status: 'unknown', latency: 0, lastCheck: new Date() },
      api: { status: 'unknown', latency: 0, lastCheck: new Date() },
      memory: { status: 'unknown', usage: 0, lastCheck: new Date() },
    },
    overallLatency: 0,
    lastCheck: new Date(),
  }

  try {
    // Verificar Redis
    const redisStart = Date.now()
    // Aqui você adicionaria a verificação real do Redis
    health.components.redis = {
      status: 'healthy',
      latency: Date.now() - redisStart,
      lastCheck: new Date(),
    }

    // Verificar API
    const apiStart = Date.now()
    // Aqui você adicionaria a verificação real da API
    health.components.api = {
      status: 'healthy',
      latency: Date.now() - apiStart,
      lastCheck: new Date(),
    }

    // Verificar banco de dados
    const dbStart = Date.now()
    // Aqui você adicionaria a verificação real do banco de dados
    health.components.database = {
      status: 'healthy',
      latency: Date.now() - dbStart,
      lastCheck: new Date(),
    }

    // Verificar uso de memória
    if (typeof window !== 'undefined' && (window as any).performance?.memory) {
      const memoryInfo = (window as any).performance.memory
      health.components.memory = {
        status: 'healthy',
        usage: memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit,
        lastCheck: new Date(),
      }
    }

    // Calcular latência geral
    health.overallLatency = Math.round(
      (health.components.database.latency + 
       health.components.redis.latency + 
       health.components.api.latency) / 3
    )

    // Determinar status geral
    const hasUnhealthy = Object.values(health.components).some(c => c.status === 'unhealthy')
    const hasDegraded = Object.values(health.components).some(c => c.status === 'degraded')
    
    if (hasUnhealthy) {
      health.status = 'unhealthy'
    } else if (hasDegraded) {
      health.status = 'degraded'
    } else {
      health.status = 'healthy'
    }

  } catch (error) {
    health.status = 'unhealthy'
    Sentry.captureException(error, {
      tags: { operation: 'health_check' }
    })
  }

  return health
}

export default {
  initializeSentry,
  PerformanceMonitor,
  monitorFunction,
  monitorAPIRequest,
  monitorDatabaseQuery,
  monitorCacheOperation,
  monitorQueueJob,
  PerformanceAlert,
  getSystemHealth,
}

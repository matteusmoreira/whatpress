// Circuit Breaker e Retry Pattern para resiliência

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing fast
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

export interface CircuitBreakerConfig {
  failureThreshold: number      // Número de falhas antes de abrir
  successThreshold: number      // Número de sucessos antes de fechar
  timeout: number              // Tempo em ms antes de tentar half-open
  resetTimeout: number         // Tempo em ms antes de resetar para closed
  retryDelay: number          // Delay inicial entre retries (ms)
  maxRetries: number          // Número máximo de retries
  backoffMultiplier: number   // Multiplicador para exponential backoff
  maxDelay: number           // Delay máximo entre retries (ms)
}

export interface RetryConfig {
  maxRetries: number
  retryDelay: number
  backoffMultiplier: number
  maxDelay: number
  retryableErrors: string[]
}

export interface ExecutionContext {
  operation: string
  [key: string]: any
}

// Configurações padrão para diferentes tipos de serviços
export const defaultCircuitBreakerConfigs = {
  network: {
    failureThreshold: 5,
    successThreshold: 3,
    timeout: 30000, // 30 segundos
    resetTimeout: 60000, // 1 minuto
    retryDelay: 1000,
    maxRetries: 3,
    backoffMultiplier: 2,
    maxDelay: 10000,
  },
  database: {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 15000, // 15 segundos
    resetTimeout: 30000, // 30 segundos
    retryDelay: 500,
    maxRetries: 2,
    backoffMultiplier: 1.5,
    maxDelay: 5000,
  },
  externalApi: {
    failureThreshold: 10,
    successThreshold: 5,
    timeout: 60000, // 1 minuto
    resetTimeout: 120000, // 2 minutos
    retryDelay: 2000,
    maxRetries: 5,
    backoffMultiplier: 2,
    maxDelay: 30000,
  },
  critical: {
    failureThreshold: 2,
    successThreshold: 1,
    timeout: 10000, // 10 segundos
    resetTimeout: 20000, // 20 segundos
    retryDelay: 500,
    maxRetries: 1,
    backoffMultiplier: 1,
    maxDelay: 1000,
  }
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED
  private failureCount = 0
  private successCount = 0
  private lastFailureTime = 0
  private nextAttemptTime = 0
  private config: CircuitBreakerConfig
  private operation: string

  constructor(operation: string, config: CircuitBreakerConfig) {
    this.operation = operation
    this.config = config
  }

  async execute<T>(fn: () => Promise<T>, context?: ExecutionContext): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        throw new Error(`Circuit breaker is OPEN for operation: ${this.operation}`)
      } else {
        this.state = CircuitBreakerState.HALF_OPEN
        console.log(`Circuit breaker HALF_OPEN for operation: ${this.operation}`)
      }
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      
      // Adicionar contexto ao erro
      if (context) {
        (error as any).context = context
      }
      
      throw error
    }
  }

  private onSuccess(): void {
    this.failureCount = 0
    
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++
      
      if (this.successCount >= this.config.successThreshold) {
        this.state = CircuitBreakerState.CLOSED
        this.successCount = 0
        console.log(`Circuit breaker CLOSED for operation: ${this.operation}`)
      }
    }
  }

  private onFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()
    
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.OPEN
      this.nextAttemptTime = Date.now() + this.config.resetTimeout
      console.log(`Circuit breaker OPEN for operation: ${this.operation}`)
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitBreakerState.OPEN
      this.nextAttemptTime = Date.now() + this.config.resetTimeout
      console.log(`Circuit breaker OPEN for operation: ${this.operation} after ${this.failureCount} failures`)
    }
  }

  getState(): CircuitBreakerState {
    return this.state
  }

  getMetrics() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
    }
  }
}

export class RetryManager {
  private config: RetryConfig

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      backoffMultiplier: config.backoffMultiplier || 2,
      maxDelay: config.maxDelay || 10000,
      retryableErrors: config.retryableErrors || [
        'Network Error',
        'Timeout Error',
        'ECONNREFUSED',
        'ENOTFOUND',
        'ETIMEDOUT',
        'ECONNRESET',
        'EPIPE',
        'EHOSTUNREACH',
        'Rate limit exceeded',
        'Service temporarily unavailable',
      ],
    }
  }

  async executeWithRetry<T>(
    fn: () => Promise<T>,
    context?: ExecutionContext,
    onRetry?: (error: Error, attempt: number) => void
  ): Promise<T> {
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error as Error
        
        if (!this.shouldRetry(error as Error)) {
          throw error
        }
        
        if (attempt < this.config.maxRetries) {
          const delay = this.calculateDelay(attempt)
          
          console.log(`Retry attempt ${attempt}/${this.config.maxRetries} after ${delay}ms. Error: ${(error as Error).message}`)
          
          if (onRetry) {
            onRetry(error as Error, attempt)
          }
          
          await this.delay(delay)
        }
      }
    }
    
    throw lastError
  }

  private shouldRetry(error: Error): boolean {
    // Verificar se o erro é retryable
    const errorMessage = error.message || error.toString()
    
    return this.config.retryableErrors.some(retryableError => 
      errorMessage.toLowerCase().includes(retryableError.toLowerCase())
    )
  }

  private calculateDelay(attempt: number): number {
    const delay = this.config.retryDelay * Math.pow(this.config.backoffMultiplier, attempt - 1)
    return Math.min(delay, this.config.maxDelay)
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Gerenciador de circuit breakers
export class CircuitBreakerManager {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map()
  private defaultConfig: CircuitBreakerConfig

  constructor(defaultConfig: CircuitBreakerConfig = defaultCircuitBreakerConfigs.network) {
    this.defaultConfig = defaultConfig
  }

  getCircuitBreaker(operation: string, config?: CircuitBreakerConfig): CircuitBreaker {
    if (!this.circuitBreakers.has(operation)) {
      const breakerConfig = config || this.defaultConfig
      this.circuitBreakers.set(operation, new CircuitBreaker(operation, breakerConfig))
    }
    
    return this.circuitBreakers.get(operation)!
  }

  getAllMetrics() {
    const metrics: Record<string, any> = {}
    
    this.circuitBreakers.forEach((breaker, operation) => {
      metrics[operation] = breaker.getMetrics()
    })
    
    return metrics
  }

  resetCircuitBreaker(operation: string): void {
    const breaker = this.circuitBreakers.get(operation)
    if (breaker) {
      this.circuitBreakers.delete(operation)
    }
  }

  resetAll(): void {
    this.circuitBreakers.clear()
  }
}

// Funções auxiliares para uso comum
export const executeWithCircuitBreaker = async <T>(
  operation: string,
  fn: () => Promise<T>,
  config?: CircuitBreakerConfig,
  context?: ExecutionContext
): Promise<T> => {
  const manager = new CircuitBreakerManager(config)
  const breaker = manager.getCircuitBreaker(operation, config)
  
  return await breaker.execute(fn, context)
}

export const executeWithRetryAndCircuitBreaker = async <T>(
  fn: () => Promise<T>,
  options: {
    operation: string
    circuitBreakerConfig?: CircuitBreakerConfig
    retryConfig?: Partial<RetryConfig>
    context?: ExecutionContext
    onRetry?: (error: Error, attempt: number) => void
  }
): Promise<T> => {
  const {
    operation,
    circuitBreakerConfig,
    retryConfig,
    context,
    onRetry,
  } = options

  const manager = new CircuitBreakerManager(circuitBreakerConfig)
  const breaker = manager.getCircuitBreaker(operation, circuitBreakerConfig)
  const retryManager = new RetryManager(retryConfig)

  return await breaker.execute(async () => {
    return await retryManager.executeWithRetry(fn, context, onRetry)
  }, context)
}

// Funções especializadas para diferentes tipos de erros
export const retryNetworkErrors = async <T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  onRetry?: (error: Error, attempt: number) => void
): Promise<T> => {
  const retryManager = new RetryManager({
    maxRetries,
    retryDelay: 1000,
    backoffMultiplier: 2,
    maxDelay: 10000,
    retryableErrors: [
      'Network Error',
      'Failed to fetch',
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNRESET',
      'EPIPE',
      'EHOSTUNREACH',
    ],
  })
  
  return await retryManager.executeWithRetry(fn, undefined, onRetry)
}

export const retryDatabaseErrors = async <T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  onRetry?: (error: Error, attempt: number) => void
): Promise<T> => {
  const retryManager = new RetryManager({
    maxRetries,
    retryDelay: 500,
    backoffMultiplier: 1.5,
    maxDelay: 5000,
    retryableErrors: [
      'Connection terminated unexpectedly',
      'Connection lost',
      'Connection timed out',
      'Lock wait timeout exceeded',
      'Deadlock found',
      'Server shutdown in progress',
    ],
  })
  
  return await retryManager.executeWithRetry(fn, undefined, onRetry)
}

export const retryExternalAPIErrors = async <T>(
  fn: () => Promise<T>,
  maxRetries = 5,
  onRetry?: (error: Error, attempt: number) => void
): Promise<T> => {
  const retryManager = new RetryManager({
    maxRetries,
    retryDelay: 2000,
    backoffMultiplier: 2,
    maxDelay: 30000,
    retryableErrors: [
      'Rate limit exceeded',
      'Too Many Requests',
      'Service temporarily unavailable',
      'Gateway timeout',
      'Bad Gateway',
      'Service Unavailable',
      'Request timeout',
      'ETIMEDOUT',
      'ECONNRESET',
    ],
  })
  
  return await retryManager.executeWithRetry(fn, undefined, onRetry)
}

// Exportar instância global do gerenciador
export const circuitBreakerManager = new CircuitBreakerManager()

export default {
  CircuitBreaker,
  RetryManager,
  CircuitBreakerManager,
  executeWithCircuitBreaker,
  executeWithRetryAndCircuitBreaker,
  retryNetworkErrors,
  retryDatabaseErrors,
  retryExternalAPIErrors,
  defaultCircuitBreakerConfigs,
  circuitBreakerManager,
}
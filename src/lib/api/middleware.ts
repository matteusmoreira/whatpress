import { Request, Response, NextFunction } from 'express'
import { apiAuth, APIUser, RateLimitInfo } from './auth'
import { monitorFunction } from '@/lib/monitoring'

/**
 * Middleware de autenticação para API
 */
export async function apiAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  await monitorFunction('api.middleware.auth', async () => {
    try {
      const apiKey = extractAPIKey(req)
      
      if (!apiKey) {
        res.status(401).json({
          error: 'API key required',
          code: 'MISSING_API_KEY'
        })
        return
      }

      const result = await apiAuth.authenticate({
        apiKey,
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      })

      if (result.error) {
        res.status(result.error === 'Rate limit exceeded' ? 429 : 401).json({
          error: result.error,
          code: result.error === 'Rate limit exceeded' ? 'RATE_LIMIT_EXCEEDED' : 'UNAUTHORIZED'
        })
        return
      }

      // Adicionar informações ao request
      req.apiUser = result.user!
      req.rateLimit = result.rateLimit!

      // Adicionar headers de rate limit
      res.set({
        'X-RateLimit-Limit': result.rateLimit!.limit.toString(),
        'X-RateLimit-Remaining': result.rateLimit!.remaining.toString(),
        'X-RateLimit-Reset': result.rateLimit!.reset.toString()
      })

      next()
    } catch (error) {
      console.error('Auth middleware error:', error)
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      })
    }
  })
}

/**
 * Middleware de rate limiting para endpoints de pagamento (mais restritivo)
 */
export function paymentRateLimitMiddleware() {
  return rateLimitMiddleware(60000, 50) // 50 requisições por minuto
}

/**
 * Middleware de rate limiting
 */
export function rateLimitMiddleware(
  windowMs: number = 60000, // 1 minuto
  max: number = 100
) {
  const requests = new Map<string, { count: number; reset: number }>()

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown'
    const now = Date.now()

    let current = requests.get(key)

    // Reset se a janela expirou
    if (!current || now > current.reset) {
      current = {
        count: 0,
        reset: now + windowMs
      }
      requests.set(key, current)
    }

    // Verificar limite
    if (current.count >= max) {
      res.status(429).json({
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((current.reset - now) / 1000)
      })
      return
    }

    // Incrementar contador
    current.count++

    // Adicionar headers
    res.set({
      'X-RateLimit-Limit': max.toString(),
      'X-RateLimit-Remaining': (max - current.count).toString(),
      'X-RateLimit-Reset': current.reset.toString()
    })

    next()
  }
}

/**
 * Middleware de validação de permissões
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.apiUser) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED'
      })
      return
    }

    const user = req.apiUser as APIUser
    
    // Admin tem todas as permissões
    if (user.permissions.includes('admin')) {
      next()
      return
    }

    // Verificar permissão específica
    if (!user.permissions.includes(permission)) {
      res.status(403).json({
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        required: permission
      })
      return
    }

    next()
  }
}

/**
 * Middleware de validação de tenant
 */
export function requireTenant() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.apiUser) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED'
      })
      return
    }

    const user = req.apiUser as APIUser
    
    if (!user.tenant_id) {
      res.status(400).json({
        error: 'Tenant required',
        code: 'TENANT_REQUIRED'
      })
      return
    }

    // Adicionar tenant ao request
    req.tenantId = user.tenant_id
    next()
  }
}

/**
 * Middleware de logging de API
 */
export function apiLoggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now()
  
  // Capturar resposta
  const originalSend = res.send
  res.send = function(body) {
    const duration = Date.now() - start
    
    // Log da requisição
    console.log('API Request:', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      user: req.apiUser?.id,
      tenant: req.apiUser?.tenant_id,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    })

    // Enviar para monitoramento
    monitorFunction('api.request', async () => {
      // Métricas podem ser enviadas para sistema de monitoramento
    })

    return originalSend.call(this, body)
  }

  next()
}

/**
 * Middleware de tratamento de erros
 */
export function apiErrorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('API Error:', error)

  // Enviar para monitoramento
  monitorFunction('api.error', async () => {
    // Métricas de erro podem ser enviadas para sistema de monitoramento
  })

  // Não expor detalhes de erro em produção
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    ...(isDevelopment && { 
      message: error.message,
      stack: error.stack 
    })
  })
}

/**
 * Extrai API key do request
 */
function extractAPIKey(req: Request): string | null {
  // Verificar header Authorization
  const authHeader = req.get('Authorization')
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/)
    if (match) {
      return match[1]
    }
  }

  // Verificar query parameter
  const apiKey = req.query.api_key as string
  if (apiKey) {
    return apiKey
  }

  // Verificar header X-API-Key
  const xApiKey = req.get('X-API-Key')
  if (xApiKey) {
    return xApiKey
  }

  return null
}

// Extensões do Request
declare global {
  namespace Express {
    interface Request {
      apiUser?: APIUser
      rateLimit?: RateLimitInfo
      tenantId?: string
    }
  }
}
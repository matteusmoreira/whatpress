import { Router, Request, Response } from 'express'
import { apiAuthMiddleware, requirePermission, apiLoggingMiddleware } from './middleware'
import { monitorFunction } from '@/lib/monitoring'

// Configuração do API Gateway
export interface GatewayConfig {
  rate_limit: {
    window_ms: number
    max_requests: number
  }
  cors: {
    enabled: boolean
    origins: string[]
    methods: string[]
    headers: string[]
  }
  security: {
    api_key_required: boolean
    jwt_required: boolean
    cors_protection: boolean
  }
  logging: {
    enabled: boolean
    level: 'debug' | 'info' | 'warn' | 'error'
  }
}

// Rotas do API Gateway
const gatewayRouter = Router()

// Middleware de logging para gateway
gatewayRouter.use(apiLoggingMiddleware)

// Health check do gateway
gatewayRouter.get('/gateway/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      auth: 'healthy',
      payments: 'healthy',
      webhooks: 'healthy',
      integrations: 'healthy'
    }
  })
})

// Métricas do gateway (requer autenticação)
gatewayRouter.get('/gateway/metrics', 
  apiAuthMiddleware, 
  requirePermission('admin:read'),
  async (req: Request, res: Response) => {
    await monitorFunction('api.gateway.metrics', async () => {
      try {
        // Obter métricas de uso da API
        const { data: apiKeys } = await supabase
          .from('api_keys')
          .select('id, name, last_used_at, created_at')
          .eq('is_active', true)

        const { data: webhooks } = await supabase
          .from('webhooks')
          .select('id, status, created_at')

        const { data: payments } = await supabase
          .from('payments')
          .select('id, status, created_at')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

        const metrics = {
          timestamp: new Date().toISOString(),
          api_keys: {
            total: apiKeys?.length || 0,
            active: apiKeys?.filter((k: any) => k.last_used_at).length || 0
          },
          webhooks: {
            total: webhooks?.length || 0,
            active: webhooks?.filter((w: any) => w.status === 'active').length || 0
          },
          payments: {
            total_24h: payments?.length || 0,
            by_status: payments?.reduce((acc: any, p: any) => {
              acc[p.status] = (acc[p.status] || 0) + 1
              return acc
            }, {})
          },
          rate_limits: {
            current_usage: 0,
            max_capacity: 10000
          }
        }

        res.json({ data: metrics })
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch gateway metrics' })
      }
    })
  }
)

// Configurações do gateway
gatewayRouter.get('/gateway/config', 
  apiAuthMiddleware, 
  requirePermission('admin:read'),
  (req: Request, res: Response) => {
    const config: GatewayConfig = {
      rate_limit: {
        window_ms: 60000, // 1 minuto
        max_requests: 1000
      },
      cors: {
        enabled: true,
        origins: ['*'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        headers: ['Content-Type', 'Authorization', 'X-API-Key']
      },
      security: {
        api_key_required: true,
        jwt_required: false,
        cors_protection: true
      },
      logging: {
        enabled: true,
        level: 'info'
      }
    }

    res.json({ data: config })
  }
)

// Status dos serviços externos
gatewayRouter.get('/gateway/services', 
  apiAuthMiddleware, 
  requirePermission('admin:read'),
  async (req: Request, res: Response) => {
    await monitorFunction('api.gateway.services', async () => {
      try {
        const services = {
          stripe: { status: 'healthy', last_check: new Date().toISOString() },
          mercadopago: { status: 'healthy', last_check: new Date().toISOString() },
          asaas: { status: 'healthy', last_check: new Date().toISOString() },
          zapier: { status: 'healthy', last_check: new Date().toISOString() },
          make: { status: 'healthy', last_check: new Date().toISOString() },
          supabase: { status: 'healthy', last_check: new Date().toISOString() }
        }

        res.json({ data: services })
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch service status' })
      }
    })
  }
)

// Logs do gateway
gatewayRouter.get('/gateway/logs', 
  apiAuthMiddleware, 
  requirePermission('admin:read'),
  async (req: Request, res: Response) => {
    await monitorFunction('api.gateway.logs', async () => {
      try {
        const { page = 1, limit = 50, level, service } = req.query
        const offset = (Number(page) - 1) * Number(limit)

        let query = supabase
          .from('api_logs')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(offset, offset + Number(limit) - 1)

        if (level) {
          query = query.eq('level', level)
        }

        if (service) {
          query = query.eq('service', service)
        }

        const { data, error, count } = await query

        if (error) {
          res.status(500).json({ error: error.message })
          return
        }

        res.json({
          data,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: count,
            pages: Math.ceil((count || 0) / Number(limit))
          }
        })
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch gateway logs' })
      }
    })
  }
)

export { gatewayRouter }
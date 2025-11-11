import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { rateLimitMiddleware, apiErrorHandler } from './middleware'
import { 
  campaignsRouter, 
  contactsRouter, 
  listsRouter, 
  analyticsRouter, 
  healthRouter,
  gatewayRouter
} from './routes'
import { crmRouter, webhooksRouter } from './integrations'
import { automationRouter } from './automation'
import { paymentsRouter } from './payments'
import { apiAuth } from './auth'

const app = express()
const server = createServer(app)
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
})

// Configuração básica
app.use(helmet())
app.use(compression())
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}))

// Rate limiting global
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // limite de 1000 requisições por IP
  message: 'Too many requests from this IP'
}))

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Health check (sem autenticação)
app.use('/api', healthRouter)

// Documentação da API (sem autenticação)
app.get('/api/docs', (req, res) => {
  res.json({
    title: 'WhatPress API',
    version: '1.0.0',
    description: 'API para gerenciamento de campanhas de marketing',
    endpoints: {
      health: {
        'GET /api/health': 'Health check básico',
        'GET /api/health/detailed': 'Health check detalhado com status dos serviços'
      },
      campaigns: {
        'GET /api/campaigns': 'Listar campanhas',
        'POST /api/campaigns': 'Criar campanha',
        'GET /api/campaigns/:id': 'Obter campanha específica',
        'PUT /api/campaigns/:id': 'Atualizar campanha',
        'DELETE /api/campaigns/:id': 'Deletar campanha'
      },
      contacts: {
        'GET /api/contacts': 'Listar contatos',
        'POST /api/contacts': 'Criar contato',
        'GET /api/contacts/:id': 'Obter contato específico',
        'PUT /api/contacts/:id': 'Atualizar contato',
        'DELETE /api/contacts/:id': 'Deletar contato'
      },
      lists: {
        'GET /api/lists': 'Listar listas de contatos',
        'POST /api/lists': 'Criar lista de contatos',
        'GET /api/lists/:id': 'Obter lista específica',
        'PUT /api/lists/:id': 'Atualizar lista',
        'DELETE /api/lists/:id': 'Deletar lista'
      },
      analytics: {
        'GET /api/analytics/metrics': 'Obter métricas',
        'GET /api/analytics/events': 'Obter eventos'
      },
      auth: {
        'GET /api/auth/keys': 'Listar API keys',
        'POST /api/auth/keys': 'Criar API key',
        'DELETE /api/auth/keys/:id': 'Revogar API key'
      },
      payments: {
        'GET /api/payments/providers': 'Listar provedores de pagamento',
        'POST /api/payments/providers': 'Criar provedor de pagamento',
        'GET /api/payments/providers/available': 'Listar provedores disponíveis',
        'GET /api/payments/providers/:id': 'Obter provedor específico',
        'PUT /api/payments/providers/:id': 'Atualizar provedor',
        'DELETE /api/payments/providers/:id': 'Deletar provedor',
        'POST /api/payments/providers/:id/test': 'Testar conexão com provedor',
        'POST /api/payments/create-intent': 'Criar intenção de pagamento',
        'GET /api/payments': 'Listar pagamentos',
        'GET /api/payments/:id': 'Obter pagamento específico',
        'GET /api/payments/stats': 'Estatísticas de pagamentos',
        'POST /api/payments/webhooks/:provider': 'Webhook de atualização de pagamento'
      },
      gateway: {
        'GET /api/gateway/health': 'Health check do API Gateway',
        'GET /api/gateway/metrics': 'Métricas do gateway (admin)',
        'GET /api/gateway/config': 'Configurações do gateway (admin)',
        'GET /api/gateway/services': 'Status dos serviços externos (admin)',
        'GET /api/gateway/logs': 'Logs do gateway (admin)'
      }
    },
    authentication: {
      type: 'API Key',
      header: 'Authorization: Bearer YOUR_API_KEY',
      alternative: 'X-API-Key: YOUR_API_KEY'
    },
    rateLimiting: {
      default: '1000 requests per 15 minutes per IP',
      authenticated: 'Varies by API key tier'
    }
  })
})

// Rotas autenticadas
app.use('/api/campaigns', campaignsRouter)
app.use('/api/contacts', contactsRouter)
app.use('/api/lists', listsRouter)
app.use('/api/analytics', analyticsRouter)

// Rotas de integrações
app.use('/api/integrations/crm', crmRouter)
app.use('/api/integrations/webhooks', webhooksRouter)
app.use('/api/integrations/automation', automationRouter)

// Rotas de pagamento
app.use('/api/payments', paymentsRouter)

// Rotas do API Gateway
import { gatewayRouter } from './gateway'
app.use('/api', gatewayRouter)
const authRouter = Router()
authRouter.use(apiAuthMiddleware, apiLoggingMiddleware)

// Listar API keys
authRouter.get('/keys', async (req, res) => {
  try {
    const keys = await apiAuth.listKeys(req.apiUser!.id, req.tenantId!)
    res.json({ data: keys })
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Criar API key
authRouter.post('/keys', requirePermission('api.write'), async (req, res) => {
  try {
    const { name, permissions, rateLimit } = req.body
    
    const key = await apiAuth.createKey({
      userId: req.apiUser!.id,
      tenantId: req.tenantId!,
      name,
      permissions,
      rateLimit
    })

    res.status(201).json({ data: key })
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Revogar API key
authRouter.delete('/keys/:id', requirePermission('api.write'), async (req, res) => {
  try {
    await apiAuth.revokeKey(req.params.id, req.apiUser!.id)
    res.status(204).send()
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.use('/api/auth', authRouter)

// WebSocket para real-time
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id)

  socket.on('subscribe_tenant', (tenantId: string) => {
    socket.join(`tenant:${tenantId}`)
    console.log(`Client ${socket.id} subscribed to tenant ${tenantId}`)
  })

  socket.on('unsubscribe_tenant', (tenantId: string) => {
    socket.leave(`tenant:${tenantId}`)
    console.log(`Client ${socket.id} unsubscribed from tenant ${tenantId}`)
  })

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id)
  })
})

// Função para emitir eventos de tenant
export function emitTenantEvent(tenantId: string, event: string, data: any) {
  io.to(`tenant:${tenantId}`).emit(event, data)
}

// Tratamento de erros (deve ser o último middleware)
app.use(apiErrorHandler)

// Rota 404
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  })
})

const PORT = process.env.API_PORT || 3001

export function startAPIServer() {
  server.listen(PORT, () => {
    console.log(`🚀 API Server running on port ${PORT}`)
    console.log(`📚 API Docs available at http://localhost:${PORT}/api/docs`)
  })

  return { app, server, io }
}

export { app, server, io }
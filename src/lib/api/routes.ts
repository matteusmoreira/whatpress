import { Router, Request, Response } from 'express'
import { apiAuthMiddleware, requirePermission, requireTenant, apiLoggingMiddleware } from './middleware'
import { supabase } from '@/lib/supabase'
import { monitorFunction } from '@/lib/monitoring'
import { z } from 'zod'

// Schemas de validação
const campaignSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['email', 'sms', 'whatsapp']),
  subject: z.string().min(1).max(1000),
  content: z.string().min(1),
  recipient_list: z.array(z.string().uuid()),
  scheduled_at: z.string().datetime().optional(),
  template_id: z.string().uuid().optional()
})

const contactSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255),
  phone: z.string().optional(),
  tags: z.array(z.string()).optional(),
  custom_fields: z.record(z.string()).optional()
})

const listSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  contacts: z.array(z.string().uuid()).optional()
})

// Rotas de campanhas
export const campaignsRouter = Router()
campaignsRouter.use(apiAuthMiddleware, requireTenant, apiLoggingMiddleware)

// Listar campanhas
campaignsRouter.get('/', async (req: Request, res: Response) => {
  await monitorFunction('api.campaigns.list', async () => {
    try {
      const { page = 1, limit = 50, status, type } = req.query
      const offset = (Number(page) - 1) * Number(limit)

      let query = supabase
        .from('campaigns')
        .select('*', { count: 'exact' })
        .eq('tenant_id', req.tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + Number(limit) - 1)

      if (status) {
        query = query.eq('status', status)
      }

      if (type) {
        query = query.eq('type', type)
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
      res.status(500).json({ error: 'Internal server error' })
    }
  })
})

// Criar campanha
campaignsRouter.post('/', requirePermission('campaigns.write'), async (req: Request, res: Response) => {
  await monitorFunction('api.campaigns.create', async () => {
    try {
      const validated = campaignSchema.parse(req.body)
      
      const { data, error } = await supabase
        .from('campaigns')
        .insert({
          ...validated,
          tenant_id: req.tenantId,
          created_by: req.apiUser!.id
        })
        .select()
        .single()

      if (error) {
        res.status(500).json({ error: error.message })
        return
      }

      res.status(201).json(data)
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors })
        return
      }
      res.status(500).json({ error: 'Internal server error' })
    }
  })
})

// Obter campanha específica
campaignsRouter.get('/:id', async (req: Request, res: Response) => {
  await monitorFunction('api.campaigns.get', async () => {
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', req.params.id)
        .eq('tenant_id', req.tenantId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          res.status(404).json({ error: 'Campaign not found' })
          return
        }
        res.status(500).json({ error: error.message })
        return
      }

      res.json(data)
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' })
    }
  })
})

// Atualizar campanha
campaignsRouter.put('/:id', requirePermission('campaigns.write'), async (req: Request, res: Response) => {
  await monitorFunction('api.campaigns.update', async () => {
    try {
      const validated = campaignSchema.partial().parse(req.body)
      
      const { data, error } = await supabase
        .from('campaigns')
        .update(validated)
        .eq('id', req.params.id)
        .eq('tenant_id', req.tenantId)
        .select()
        .single()

      if (error) {
        res.status(500).json({ error: error.message })
        return
      }

      res.json(data)
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors })
        return
      }
      res.status(500).json({ error: 'Internal server error' })
    }
  })
})

// Deletar campanha
campaignsRouter.delete('/:id', requirePermission('campaigns.write'), async (req: Request, res: Response) => {
  await monitorFunction('api.campaigns.delete', async () => {
    try {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', req.params.id)
        .eq('tenant_id', req.tenantId)

      if (error) {
        res.status(500).json({ error: error.message })
        return
      }

      res.status(204).send()
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' })
    }
  })
})

// Rotas de contatos
export const contactsRouter = Router()
contactsRouter.use(apiAuthMiddleware, requireTenant, apiLoggingMiddleware)

// Listar contatos
contactsRouter.get('/', async (req: Request, res: Response) => {
  await monitorFunction('api.contacts.list', async () => {
    try {
      const { page = 1, limit = 50, search, tags } = req.query
      const offset = (Number(page) - 1) * Number(limit)

      let query = supabase
        .from('contacts')
        .select('*', { count: 'exact' })
        .eq('tenant_id', req.tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + Number(limit) - 1)

      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
      }

      if (tags) {
        const tagList = (tags as string).split(',')
        query = query.contains('tags', tagList)
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
      res.status(500).json({ error: 'Internal server error' })
    }
  })
})

// Criar contato
contactsRouter.post('/', requirePermission('contacts.write'), async (req: Request, res: Response) => {
  await monitorFunction('api.contacts.create', async () => {
    try {
      const validated = contactSchema.parse(req.body)
      
      const { data, error } = await supabase
        .from('contacts')
        .insert({
          ...validated,
          tenant_id: req.tenantId,
          created_by: req.apiUser!.id
        })
        .select()
        .single()

      if (error) {
        res.status(500).json({ error: error.message })
        return
      }

      res.status(201).json(data)
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors })
        return
      }
      res.status(500).json({ error: 'Internal server error' })
    }
  })
})

// Rotas de listas
export const listsRouter = Router()
listsRouter.use(apiAuthMiddleware, requireTenant, apiLoggingMiddleware)

// Listar listas
listsRouter.get('/', async (req: Request, res: Response) => {
  await monitorFunction('api.lists.list', async () => {
    try {
      const { page = 1, limit = 50 } = req.query
      const offset = (Number(page) - 1) * Number(limit)

      const { data, error, count } = await supabase
        .from('contact_lists')
        .select('*', { count: 'exact' })
        .eq('tenant_id', req.tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + Number(limit) - 1)

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
      res.status(500).json({ error: 'Internal server error' })
    }
  })
})

// Criar lista
listsRouter.post('/', requirePermission('contacts.write'), async (req: Request, res: Response) => {
  await monitorFunction('api.lists.create', async () => {
    try {
      const validated = listSchema.parse(req.body)
      
      const { data, error } = await supabase
        .from('contact_lists')
        .insert({
          ...validated,
          tenant_id: req.tenantId,
          created_by: req.apiUser!.id
        })
        .select()
        .single()

      if (error) {
        res.status(500).json({ error: error.message })
        return
      }

      res.status(201).json(data)
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors })
        return
      }
      res.status(500).json({ error: 'Internal server error' })
    }
  })
})

// Rotas de analytics
export const analyticsRouter = Router()
analyticsRouter.use(apiAuthMiddleware, requireTenant, apiLoggingMiddleware)

// Obter métricas
analyticsRouter.get('/metrics', async (req: Request, res: Response) => {
  await monitorFunction('api.analytics.metrics', async () => {
    try {
      const { start_date, end_date, period = '7d' } = req.query

      let startDate: Date
      let endDate: Date

      if (start_date && end_date) {
        startDate = new Date(start_date as string)
        endDate = new Date(end_date as string)
      } else {
        endDate = new Date()
        startDate = new Date()
        
        switch (period) {
          case '24h':
            startDate.setDate(startDate.getDate() - 1)
            break
          case '7d':
            startDate.setDate(startDate.getDate() - 7)
            break
          case '30d':
            startDate.setDate(startDate.getDate() - 30)
            break
          case '90d':
            startDate.setDate(startDate.getDate() - 90)
            break
          default:
            startDate.setDate(startDate.getDate() - 7)
        }
      }

      // Obter métricas do Supabase
      const [campaigns, contacts, analytics] = await Promise.all([
        supabase
          .from('campaigns')
          .select('status, created_at')
          .eq('tenant_id', req.tenantId)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString()),

        supabase
          .from('contacts')
          .select('status, created_at')
          .eq('tenant_id', req.tenantId)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString()),

        supabase
          .from('analytics')
          .select('metric_type, value, created_at')
          .eq('tenant_id', req.tenantId)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
      ])

      const metrics = {
        campaigns: {
          total: campaigns.data?.length || 0,
          by_status: campaigns.data?.reduce((acc, campaign) => {
            acc[campaign.status] = (acc[campaign.status] || 0) + 1
            return acc
          }, {} as Record<string, number>) || {}
        },
        contacts: {
          total: contacts.data?.length || 0,
          by_status: contacts.data?.reduce((acc, contact) => {
            acc[contact.status] = (acc[contact.status] || 0) + 1
            return acc
          }, {} as Record<string, number>) || {}
        },
        analytics: analytics.data || [],
        period: {
          start: startDate,
          end: endDate
        }
      }

      res.json(metrics)
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' })
    }
  })
})

// Obter eventos
analyticsRouter.get('/events', async (req: Request, res: Response) => {
  await monitorFunction('api.analytics.events', async () => {
    try {
      const { page = 1, limit = 100, event_type, start_date, end_date } = req.query
      const offset = (Number(page) - 1) * Number(limit)

      let query = supabase
        .from('analytics')
        .select('*', { count: 'exact' })
        .eq('tenant_id', req.tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + Number(limit) - 1)

      if (event_type) {
        query = query.eq('event_type', event_type)
      }

      if (start_date) {
        query = query.gte('created_at', start_date)
      }

      if (end_date) {
        query = query.lte('created_at', end_date)
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
      res.status(500).json({ error: 'Internal server error' })
    }
  })
})

// Rota de health check
export const healthRouter = Router()

// Exportar roteador de pagamentos
export { paymentsRouter } from './payments'

// Exportar roteador do gateway
export { gatewayRouter } from './gateway'

healthRouter.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
})

healthRouter.get('/health/detailed', async (req: Request, res: Response) => {
  try {
    // Verificar conexão com Supabase
    const { error } = await supabase.from('campaigns').select('id').limit(1)
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        supabase: error ? 'unhealthy' : 'healthy'
      }
    })
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed'
    })
  }
})
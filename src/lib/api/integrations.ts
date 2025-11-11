import { Router, Request, Response } from 'express'
import { apiAuthMiddleware, requirePermission, requireTenant, apiLoggingMiddleware } from '../middleware'
import { crmIntegrationService, CRMIntegration } from './crm'
import { webhookService } from './webhooks'
import { automationRouter } from './automation'
import { z } from 'zod'
import { monitorFunction } from '@/lib/monitoring'

// Schemas de validação
const crmIntegrationSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['salesforce', 'hubspot', 'pipedrive']),
  config: z.object({}).passthrough(), // Configuração específica por CRM
  status: z.enum(['active', 'inactive']).default('inactive')
})

const webhookSchema = z.object({
  name: z.string().min(1).max(255),
  url: z.string().url(),
  secret: z.string().optional(),
  events: z.array(z.string()).min(1),
  headers: z.record(z.string()).optional(),
  retry_config: z.object({
    max_attempts: z.number().min(1).max(10).default(5),
    backoff_multiplier: z.number().min(1).max(10).default(2),
    initial_delay: z.number().min(1000).max(60000).default(5000) // 1-60 segundos
  }).default({}),
  status: z.enum(['active', 'inactive']).default('active')
})

// Rotas de CRM
const crmRouter = Router()
crmRouter.use(apiAuthMiddleware, requireTenant, apiLoggingMiddleware)

// Listar integrações CRM
crmRouter.get('/', async (req: Request, res: Response) => {
  await monitorFunction('api.crm.list', async () => {
    try {
      const { data, error } = await supabase
        .from('crm_integrations')
        .select('*')
        .eq('tenant_id', req.tenantId)
        .order('created_at', { ascending: false })

      if (error) {
        res.status(500).json({ error: error.message })
        return
      }

      // Remover informações sensíveis da config
      const sanitizedData = data.map((integration: any) => ({
        ...integration,
        config: sanitizeCRMConfig(integration.config, integration.type)
      }))

      res.json({ data: sanitizedData })
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' })
    }
  })
})

// Criar integração CRM
crmRouter.post('/', requirePermission('integrations.write'), async (req: Request, res: Response) => {
  await monitorFunction('api.crm.create', async () => {
    try {
      const validated = crmIntegrationSchema.parse(req.body)
      
      const integrationData = {
        ...validated,
        tenant_id: req.tenantId,
        created_by: req.apiUser!.id
      }

      const { data, error } = await supabase
        .from('crm_integrations')
        .insert(integrationData)
        .select()
        .single()

      if (error) {
        res.status(500).json({ error: error.message })
        return
      }

      res.status(201).json({ 
        data: {
          ...data,
          config: sanitizeCRMConfig(data.config, data.type)
        }
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors })
        return
      }
      res.status(500).json({ error: 'Internal server error' })
    }
  })
})

// Testar conexão CRM
crmRouter.post('/:id/test', requirePermission('integrations.write'), async (req: Request, res: Response) => {
  await monitorFunction('api.crm.test', async () => {
    try {
      const { data: integration } = await supabase
        .from('crm_integrations')
        .select('*')
        .eq('id', req.params.id)
        .eq('tenant_id', req.tenantId)
        .single()

      if (!integration) {
        res.status(404).json({ error: 'Integration not found' })
        return
      }

      const crmIntegration = await crmIntegrationService.createIntegration(integration)
      const isConnected = await crmIntegration.testConnection()

      // Atualizar status baseado no teste
      await supabase
        .from('crm_integrations')
        .update({ 
          status: isConnected ? 'active' : 'error',
          updated_at: new Date()
        })
        .eq('id', req.params.id)

      res.json({ 
        data: { 
          connected: isConnected,
          status: isConnected ? 'active' : 'error'
        }
      })
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' })
    }
  })
})

// Sincronizar contatos
crmRouter.post('/:id/sync/contacts', requirePermission('integrations.write'), async (req: Request, res: Response) => {
  await monitorFunction('api.crm.sync.contacts', async () => {
    try {
      const { data: integration } = await supabase
        .from('crm_integrations')
        .select('*')
        .eq('id', req.params.id)
        .eq('tenant_id', req.tenantId)
        .single()

      if (!integration) {
        res.status(404).json({ error: 'Integration not found' })
        return
      }

      // Iniciar sincronização em background
      crmIntegrationService.syncContacts(integration.id).catch(error => {
        console.error('Contact sync failed:', error)
      })

      res.json({ 
        data: { 
          message: 'Contact sync started',
          status: 'syncing'
        }
      })
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' })
    }
  })
})

// Sincronizar leads
crmRouter.post('/:id/sync/leads', requirePermission('integrations.write'), async (req: Request, res: Response) => {
  await monitorFunction('api.crm.sync.leads', async () => {
    try {
      const { data: integration } = await supabase
        .from('crm_integrations')
        .select('*')
        .eq('id', req.params.id)
        .eq('tenant_id', req.tenantId)
        .single()

      if (!integration) {
        res.status(404).json({ error: 'Integration not found' })
        return
      }

      // Iniciar sincronização em background
      crmIntegrationService.syncLeads(integration.id).catch(error => {
        console.error('Lead sync failed:', error)
      })

      res.json({ 
        data: { 
          message: 'Lead sync started',
          status: 'syncing'
        }
      })
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' })
    }
  })
})

// Obter campos do CRM
crmRouter.get('/:id/fields', requirePermission('integrations.read'), async (req: Request, res: Response) => {
  await monitorFunction('api.crm.fields', async () => {
    try {
      const { data: integration } = await supabase
        .from('crm_integrations')
        .select('*')
        .eq('id', req.params.id)
        .eq('tenant_id', req.tenantId)
        .single()

      if (!integration) {
        res.status(404).json({ error: 'Integration not found' })
        return
      }

      const crmIntegration = await crmIntegrationService.createIntegration(integration)
      const fields = await crmIntegration.getFields()

      res.json({ data: fields })
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' })
    }
  })
})

// Rotas de Webhooks
const webhooksRouter = Router()
webhooksRouter.use(apiAuthMiddleware, requireTenant, apiLoggingMiddleware)

// Listar webhooks
webhooksRouter.get('/', async (req: Request, res: Response) => {
  await monitorFunction('api.webhooks.list', async () => {
    try {
      const webhooks = await webhookService.listWebhooks(req.tenantId!)
      res.json({ data: webhooks })
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' })
    }
  })
})

// Criar webhook
webhooksRouter.post('/', requirePermission('integrations.write'), async (req: Request, res: Response) => {
  await monitorFunction('api.webhooks.create', async () => {
    try {
      const validated = webhookSchema.parse(req.body)
      
      const webhook = await webhookService.createWebhook({
        ...validated,
        tenant_id: req.tenantId!
      })

      res.status(201).json({ data: webhook })
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors })
        return
      }
      res.status(500).json({ error: 'Internal server error' })
    }
  })
})

// Obter webhook específico
webhooksRouter.get('/:id', async (req: Request, res: Response) => {
  await monitorFunction('api.webhooks.get', async () => {
    try {
      const webhook = await webhookService.getWebhook(req.params.id, req.tenantId!)
      if (!webhook) {
        res.status(404).json({ error: 'Webhook not found' })
        return
      }

      res.json({ data: webhook })
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' })
    }
  })
})

// Atualizar webhook
webhooksRouter.put('/:id', requirePermission('integrations.write'), async (req: Request, res: Response) => {
  await monitorFunction('api.webhooks.update', async () => {
    try {
      const validated = webhookSchema.partial().parse(req.body)
      
      const webhook = await webhookService.updateWebhook(
        req.params.id,
        req.tenantId!,
        validated
      )

      res.json({ data: webhook })
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors })
        return
      }
      res.status(500).json({ error: 'Internal server error' })
    }
  })
})

// Deletar webhook
webhooksRouter.delete('/:id', requirePermission('integrations.write'), async (req: Request, res: Response) => {
  await monitorFunction('api.webhooks.delete', async () => {
    try {
      await webhookService.deleteWebhook(req.params.id, req.tenantId!)
      res.status(204).send()
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' })
    }
  })
})

// Obter tentativas de um webhook
webhooksRouter.get('/:id/attempts', async (req: Request, res: Response) => {
  await monitorFunction('api.webhooks.attempts', async () => {
    try {
      const limit = parseInt(req.query.limit as string) || 50
      const attempts = await webhookService.getWebhookAttempts(
        req.params.id,
        req.tenantId!,
        limit
      )

      res.json({ data: attempts })
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' })
    }
  })
})

// Reprocessar tentativa
webhooksRouter.post('/attempts/:attemptId/retry', requirePermission('integrations.write'), async (req: Request, res: Response) => {
  await monitorFunction('api.webhooks.retry', async () => {
    try {
      await webhookService.retryAttempt(req.params.attemptId, req.tenantId!)
      res.json({ data: { message: 'Retry initiated' } })
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' })
    }
  })
})

// Testar webhook (endpoint de teste)
webhooksRouter.post('/:id/test', requirePermission('integrations.write'), async (req: Request, res: Response) => {
  await monitorFunction('api.webhooks.test', async () => {
    try {
      const webhook = await webhookService.getWebhook(req.params.id, req.tenantId!)
      if (!webhook) {
        res.status(404).json({ error: 'Webhook not found' })
        return
      }

      // Emitir evento de teste
      const testEvent = await webhookService.emitEvent({
        type: 'test.webhook',
        tenant_id: req.tenantId!,
        data: {
          message: 'Test webhook event',
          timestamp: new Date().toISOString(),
          webhook_id: webhook.id
        }
      })

      res.json({ 
        data: { 
          message: 'Test event sent',
          event_id: testEvent.id
        }
      })
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' })
    }
  })
})

/**
 * Sanitiza configuração de CRM removendo dados sensíveis
 */
function sanitizeCRMConfig(config: any, type: string): any {
  const sanitized = { ...config }
  
  switch (type) {
    case 'salesforce':
      if (sanitized.password) sanitized.password = '***'
      if (sanitized.securityToken) sanitized.securityToken = '***'
      if (sanitized.clientSecret) sanitized.clientSecret = '***'
      break
    case 'hubspot':
      if (sanitized.accessToken) sanitized.accessToken = '***'
      break
    case 'pipedrive':
      if (sanitized.apiToken) sanitized.apiToken = '***'
      break
  }
  
  return sanitized
}

export { crmRouter, webhooksRouter }
/**
 * Integrações com plataformas de automação - Zapier, Make.com, n8n
 * Suporte para webhooks bidirecionais e templates de integração
 */

import { Router } from 'express'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { monitorFunction } from '@/lib/monitoring'
import { webhookService } from './webhooks'

const router = Router()

// Schemas de validação
const automationPlatformSchema = z.object({
  name: z.string(),
  platform: z.enum(['zapier', 'make', 'n8n', 'custom']),
  webhook_url: z.string().url(),
  events: z.array(z.string()),
  config: z.object({
    api_key: z.string().optional(),
    secret: z.string().optional(),
    headers: z.record(z.string()).optional(),
    auth_type: z.enum(['none', 'api_key', 'bearer', 'basic']).default('none'),
    retry_config: z.object({
      max_attempts: z.number().min(1).max(10).default(3),
      backoff_multiplier: z.number().min(1).max(5).default(2),
      initial_delay: z.number().min(1000).default(1000)
    }).default({
      max_attempts: 3,
      backoff_multiplier: 2,
      initial_delay: 1000
    })
  }).default({})
})

const zapierHookSchema = z.object({
  hook_url: z.string().url(),
  event: z.string(),
  target_url: z.string().url(),
  subscription_id: z.string().optional()
})

const makeWebhookSchema = z.object({
  webhook_url: z.string().url(),
  scenario_id: z.string(),
  auth_token: z.string().optional()
})

// Templates de integração pré-configurados
const INTEGRATION_TEMPLATES = {
  zapier: {
    name: 'Zapier Integration',
    description: 'Integração padrão com Zapier',
    events: [
      'campaign.sent',
      'contact.created',
      'contact.updated',
      'analytics.metrics_updated'
    ],
    config: {
      auth_type: 'api_key',
      retry_config: {
        max_attempts: 5,
        backoff_multiplier: 2,
        initial_delay: 2000
      }
    }
  },
  make: {
    name: 'Make.com Integration',
    description: 'Integração padrão com Make.com',
    events: [
      'campaign.sent',
      'campaign.updated',
      'contact.created',
      'contact.deleted'
    ],
    config: {
      auth_type: 'bearer',
      retry_config: {
        max_attempts: 3,
        backoff_multiplier: 1.5,
        initial_delay: 1000
      }
    }
  },
  n8n: {
    name: 'n8n Integration',
    description: 'Integração com n8n (self-hosted)',
    events: [
      'campaign.sent',
      'contact.created',
      'contact.updated',
      'list.created',
      'analytics.metrics_updated'
    ],
    config: {
      auth_type: 'none',
      retry_config: {
        max_attempts: 3,
        backoff_multiplier: 2,
        initial_delay: 1500
      }
    }
  }
}

/**
 * Criar integração com plataforma de automação
 */
router.post('/automation', async (req, res) => {
  try {
    const validated = automationPlatformSchema.parse(req.body)
    const tenantId = req.headers['x-tenant-id'] as string

    const webhook = await monitorFunction(
      async () => {
        // Criar webhook no sistema
        const webhookData = {
          name: validated.name,
          url: validated.webhook_url,
          events: validated.events,
          status: 'active' as const,
          retry_config: validated.config.retry_config,
          headers: validated.config.headers || {},
          secret: validated.config.secret,
          metadata: {
            platform: validated.platform,
            auth_type: validated.config.auth_type,
            api_key: validated.config.api_key ? '***' : undefined
          }
        }

        const { data, error } = await supabase
          .from('webhooks')
          .insert({
            ...webhookData,
            tenant_id: tenantId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single()

        if (error) throw error
        return data
      },
      'create_automation_integration',
      { platform: validated.platform, tenant_id: tenantId }
    )

    res.json({
      success: true,
      data: webhook,
      message: 'Integração criada com sucesso'
    })
  } catch (error) {
    console.error('Erro ao criar integração de automação:', error)
    res.status(400).json({
      success: false,
      error: 'Erro ao criar integração',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    })
  }
})

/**
 * Obter templates de integração
 */
router.get('/automation/templates', (req, res) => {
  res.json({
    success: true,
    data: INTEGRATION_TEMPLATES,
    message: 'Templates disponíveis'
  })
})

/**
 * Criar integração usando template
 */
router.post('/automation/templates/:template', async (req, res) => {
  try {
    const { template } = req.params
    const { webhook_url, api_key, secret } = req.body
    const tenantId = req.headers['x-tenant-id'] as string

    const templateConfig = INTEGRATION_TEMPLATES[template as keyof typeof INTEGRATION_TEMPLATES]
    if (!templateConfig) {
      return res.status(404).json({
        success: false,
        error: 'Template não encontrado'
      })
    }

    const webhook = await monitorFunction(
      async () => {
        const webhookData = {
          name: templateConfig.name,
          url: webhook_url,
          events: templateConfig.events,
          status: 'active' as const,
          retry_config: templateConfig.config.retry_config,
          headers: template === 'make' ? { 'Authorization': `Bearer ${api_key}` } : {},
          secret,
          metadata: {
            platform: template,
            auth_type: templateConfig.config.auth_type,
            template: true
          }
        }

        const { data, error } = await supabase
          .from('webhooks')
          .insert({
            ...webhookData,
            tenant_id: tenantId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single()

        if (error) throw error
        return data
      },
      'create_automation_template',
      { template, tenant_id: tenantId }
    )

    res.json({
      success: true,
      data: webhook,
      message: `Integração ${template} criada com sucesso`
    })
  } catch (error) {
    console.error('Erro ao criar integração por template:', error)
    res.status(400).json({
      success: false,
      error: 'Erro ao criar integração',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    })
  }
})

/**
 * Configurar webhook Zapier
 * Endpoint compatível com Zapier REST Hooks
 */
router.post('/zapier/hooks', async (req, res) => {
  try {
    const validated = zapierHookSchema.parse(req.body)
    const tenantId = req.headers['x-tenant-id'] as string

    // Criar webhook para Zapier
    const webhook = await monitorFunction(
      async () => {
        const webhookData = {
          name: `Zapier Hook - ${validated.event}`,
          url: validated.hook_url,
          events: [validated.event],
          status: 'active' as const,
          retry_config: {
            max_attempts: 5,
            backoff_multiplier: 2,
            initial_delay: 2000
          },
          metadata: {
            platform: 'zapier',
            zapier_target_url: validated.target_url,
            subscription_id: validated.subscription_id,
            hook_type: 'rest_hook'
          }
        }

        const { data, error } = await supabase
          .from('webhooks')
          .insert({
            ...webhookData,
            tenant_id: tenantId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single()

        if (error) throw error
        return data
      },
      'create_zapier_hook',
      { event: validated.event, tenant_id: tenantId }
    )

    res.json({
      success: true,
      data: {
        id: webhook.id,
        subscription_id: validated.subscription_id || webhook.id,
        target_url: validated.target_url,
        event: validated.event,
        status: 'active'
      },
      message: 'Webhook Zapier criado com sucesso'
    })
  } catch (error) {
    console.error('Erro ao criar hook Zapier:', error)
    res.status(400).json({
      success: false,
      error: 'Erro ao criar hook',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    })
  }
})

/**
 * Deletar webhook Zapier
 */
router.delete('/zapier/hooks/:id', async (req, res) => {
  try {
    const { id } = req.params
    const tenantId = req.headers['x-tenant-id'] as string

    await monitorFunction(
      async () => {
        const { error } = await supabase
          .from('webhooks')
          .delete()
          .eq('id', id)
          .eq('tenant_id', tenantId)
          .eq('metadata->platform', 'zapier')

        if (error) throw error
      },
      'delete_zapier_hook',
      { webhook_id: id, tenant_id: tenantId }
    )

    res.json({
      success: true,
      message: 'Webhook Zapier deletado com sucesso'
    })
  } catch (error) {
    console.error('Erro ao deletar hook Zapier:', error)
    res.status(400).json({
      success: false,
      error: 'Erro ao deletar hook',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    })
  }
})

/**
 * Configurar webhook Make.com
 */
router.post('/make/webhooks', async (req, res) => {
  try {
    const validated = makeWebhookSchema.parse(req.body)
    const tenantId = req.headers['x-tenant-id'] as string

    const webhook = await monitorFunction(
      async () => {
        const webhookData = {
          name: `Make.com Scenario ${validated.scenario_id}`,
          url: validated.webhook_url,
          events: ['campaign.sent', 'contact.created', 'contact.updated'],
          status: 'active' as const,
          retry_config: {
            max_attempts: 3,
            backoff_multiplier: 1.5,
            initial_delay: 1000
          },
          headers: validated.auth_token ? { 'Authorization': `Bearer ${validated.auth_token}` } : {},
          metadata: {
            platform: 'make',
            scenario_id: validated.scenario_id,
            auth_token: validated.auth_token ? '***' : undefined
          }
        }

        const { data, error } = await supabase
          .from('webhooks')
          .insert({
            ...webhookData,
            tenant_id: tenantId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single()

        if (error) throw error
        return data
      },
      'create_make_webhook',
      { scenario_id: validated.scenario_id, tenant_id: tenantId }
    )

    res.json({
      success: true,
      data: {
        id: webhook.id,
        scenario_id: validated.scenario_id,
        webhook_url: validated.webhook_url,
        status: 'active'
      },
      message: 'Webhook Make.com criado com sucesso'
    })
  } catch (error) {
    console.error('Erro ao criar webhook Make.com:', error)
    res.status(400).json({
      success: false,
      error: 'Erro ao criar webhook',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    })
  }
})

/**
 * Testar conexão com plataforma de automação
 */
router.post('/automation/:platform/test', async (req, res) => {
  try {
    const { platform } = req.params
    const { webhook_url, api_key, auth_type } = req.body

    const testResult = await monitorFunction(
      async () => {
        // Enviar teste para a plataforma
        const testData = {
          event: 'test.connection',
          timestamp: new Date().toISOString(),
          data: {
            message: 'Teste de conexão WhatPress',
            platform: platform
          }
        }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'User-Agent': 'WhatPress-Automation/1.0.0'
        }

        if (auth_type === 'api_key' && api_key) {
          headers['X-API-Key'] = api_key
        } else if (auth_type === 'bearer' && api_key) {
          headers['Authorization'] = `Bearer ${api_key}`
        }

        const response = await fetch(webhook_url, {
          method: 'POST',
          headers,
          body: JSON.stringify(testData),
          signal: AbortSignal.timeout(10000)
        })

        return {
          success: response.ok,
          status_code: response.status,
          message: response.ok ? 'Conexão bem-sucedida' : 'Falha na conexão',
          response_time: Date.now()
        }
      },
      'test_automation_connection',
      { platform, webhook_url }
    )

    res.json({
      success: testResult.success,
      data: testResult,
      message: testResult.message
    })
  } catch (error) {
    console.error('Erro ao testar conexão:', error)
    res.status(400).json({
      success: false,
      error: 'Erro ao testar conexão',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    })
  }
})

/**
 * Obter estatísticas de uso de automação
 */
router.get('/automation/stats', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string

    const stats = await monitorFunction(
      async () => {
        // Obter webhooks de automação
        const { data: webhooks, error } = await supabase
          .from('webhooks')
          .select('*')
          .eq('tenant_id', tenantId)
          .not('metadata->platform', 'is', null)

        if (error) throw error

        // Obter tentativas recentes
        const { data: attempts, error: attemptsError } = await supabase
          .from('webhook_attempts')
          .select('*')
          .in('webhook_id', webhooks.map(w => w.id))
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

        if (attemptsError) throw attemptsError

        // Agrupar por plataforma
        const platformStats = webhooks.reduce((acc, webhook) => {
          const platform = webhook.metadata?.platform || 'custom'
          if (!acc[platform]) {
            acc[platform] = {
              webhooks: 0,
              successful_deliveries: 0,
              failed_deliveries: 0,
              last_delivery: null
            }
          }
          acc[platform].webhooks++
          return acc
        }, {} as Record<string, any>)

        // Adicionar estatísticas de entrega
        attempts.forEach(attempt => {
          const webhook = webhooks.find(w => w.id === attempt.webhook_id)
          if (webhook) {
            const platform = webhook.metadata?.platform || 'custom'
            if (attempt.status === 'success') {
              platformStats[platform].successful_deliveries++
            } else if (attempt.status === 'failed') {
              platformStats[platform].failed_deliveries++
            }
            
            if (!platformStats[platform].last_delivery || 
                new Date(attempt.created_at) > new Date(platformStats[platform].last_delivery)) {
              platformStats[platform].last_delivery = attempt.created_at
            }
          }
        })

        return platformStats
      },
      'get_automation_stats',
      { tenant_id: tenantId }
    )

    res.json({
      success: true,
      data: stats,
      message: 'Estatísticas de automação obtidas com sucesso'
    })
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error)
    res.status(400).json({
      success: false,
      error: 'Erro ao obter estatísticas',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    })
  }
})

export { router as automationRouter }
/**
 * Integrações com sistemas de pagamento
 * Stripe, Mercado Pago, PayPal, etc.
 */

import { Router } from 'express'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { monitorFunction } from '@/lib/monitoring'
import { PaymentService, paymentProviderSchema, paymentSchema } from '@/lib/integrations/paymentProviders'
import { apiAuthMiddleware, requireTenant, apiLoggingMiddleware, paymentRateLimitMiddleware } from './middleware'

const router = Router()

// Aplicar middlewares
router.use(apiAuthMiddleware, requireTenant, apiLoggingMiddleware)

// Inicializar serviço de pagamentos
const paymentService = new PaymentService(supabase)

const paymentIntentSchema = z.object({
  amount: z.number().min(1),
  currency: z.string().default('BRL'),
  description: z.string(),
  customer: z.object({
    email: z.string().email(),
    name: z.string(),
    document: z.string().optional(),
    phone: z.string().optional()
  }),
  metadata: z.object({}).optional(),
  payment_method: z.string().optional(),
  installments: z.number().min(1).max(12).optional()
})

const subscriptionSchema = z.object({
  plan_id: z.string(),
  customer: z.object({
    email: z.string().email(),
    name: z.string(),
    document: z.string().optional()
  }),
  payment_method: z.string().optional(),
  metadata: z.object({}).optional()
})

// Configurações dos provedores (apenas Stripe, Asaas e Mercado Pago)
const PROVIDER_CONFIGS = {
  stripe: {
    name: 'Stripe',
    features: ['cards', 'pix', 'boleto', 'subscription'],
    currencies: ['BRL', 'USD', 'EUR'],
    countries: ['BR', 'US', 'CA', 'GB', 'DE', 'FR']
  },
  mercadopago: {
    name: 'Mercado Pago',
    features: ['cards', 'pix', 'boleto', 'wallet'],
    currencies: ['BRL', 'ARS', 'CLP', 'COP', 'MXN', 'PEN', 'UYU'],
    countries: ['BR', 'AR', 'CL', 'CO', 'MX', 'PE', 'UY']
  },
  asaas: {
    name: 'Asaas',
    features: ['cards', 'pix', 'boleto', 'subscription'],
    currencies: ['BRL'],
    countries: ['BR']
  }
}

/**
 * Criar configuração de provedor de pagamento
 */
router.post('/providers', async (req, res) => {
  try {
    const validated = paymentProviderSchema.parse(req.body)
    const tenantId = req.headers['x-tenant-id'] as string

    const provider = await monitorFunction(
      async () => {
        // Criar provedor usando nosso serviço
        const providerData = {
          ...validated,
          tenant_id: tenantId
        }
        
        return await paymentService.createPaymentProvider(providerData)
      },
      'create_payment_provider',
      { provider: validated.provider, tenant_id: tenantId }
    )

    res.json({
      success: true,
      data: provider,
      message: 'Provedor de pagamento criado com sucesso'
    })
  } catch (error) {
    console.error('Erro ao criar provedor de pagamento:', error)
    res.status(400).json({
      success: false,
      error: 'Erro ao criar provedor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    })
  }
})

/**
 * Listar provedores de pagamento
 */
router.get('/providers', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string

    const providers = await monitorFunction(
      async () => {
        const { data, error } = await supabase
          .from('payment_providers')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })

        if (error) throw error
        return data
      },
      'list_payment_providers',
      { tenant_id: tenantId }
    )

    res.json({
      success: true,
      data: providers,
      message: 'Provedores listados com sucesso'
    })
  } catch (error) {
    console.error('Erro ao listar provedores:', error)
    res.status(400).json({
      success: false,
      error: 'Erro ao listar provedores',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    })
  }
})

/**
 * Obter provedor específico
 */
router.get('/providers/:id', async (req, res) => {
  try {
    const { id } = req.params
    const tenantId = req.headers['x-tenant-id'] as string

    const provider = await monitorFunction(
      async () => {
        const { data, error } = await supabase
          .from('payment_providers')
          .select('*')
          .eq('id', id)
          .eq('tenant_id', tenantId)
          .single()

        if (error) throw error
        return data
      },
      'get_payment_provider',
      { provider_id: id, tenant_id: tenantId }
    )

    res.json({
      success: true,
      data: provider,
      message: 'Provedor obtido com sucesso'
    })
  } catch (error) {
    console.error('Erro ao obter provedor:', error)
    res.status(400).json({
      success: false,
      error: 'Erro ao obter provedor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    })
  }
})

/**
 * Testar conexão com provedor
 */
router.post('/providers/:id/test', async (req, res) => {
  try {
    const { id } = req.params
    const tenantId = req.headers['x-tenant-id'] as string

    // Testar conexão usando nosso serviço
    const testResult = await monitorFunction(
      async () => {
        return await paymentService.testProviderConnection(id, tenantId)
      },
      'test_provider_connection',
      { provider_id: id, tenant_id: tenantId }
    )

    res.json({
      success: true,
      data: testResult,
      message: testResult.success ? 'Conexão testada com sucesso' : 'Falha na conexão'
    })
  } catch (error) {
    console.error('Erro ao testar provedor:', error)
    res.status(500).json({
      success: false,
      error: 'Erro ao testar conexão',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    })
  }
})

/**
 * Criar intenção de pagamento
 */
router.post('/create-intent', paymentRateLimitMiddleware(), async (req, res) => {
  try {
    const validated = paymentIntentSchema.parse(req.body)
    const tenantId = req.headers['x-tenant-id'] as string

    // Criar pagamento usando nosso serviço
    const payment = await monitorFunction(
      async () => {
        return await paymentService.createPayment(
          validated.provider,
          tenantId,
          {
            amount: validated.amount,
            currency: validated.currency,
            customer_id: validated.customer_id,
            order_id: validated.order_id,
            metadata: validated.metadata
          }
        )
      },
      'create_payment_intent',
      { provider: validated.provider, tenant_id: tenantId, amount: validated.amount }
    )

    res.json({
      success: true,
      data: payment,
      message: 'Pagamento criado com sucesso'
    })
  } catch (error) {
    console.error('Erro ao criar pagamento:', error)
    res.status(400).json({
      success: false,
      error: 'Erro ao criar pagamento',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    })
  }
})

/**
 * Webhook para atualização de status de pagamento
 */
router.post('/webhooks/:provider', async (req, res) => {
  try {
    const { provider } = req.params
    const signature = req.headers['stripe-signature'] as string

    console.log(`Webhook recebido de ${provider}`, req.body)

    // Processar webhook usando nosso serviço
    const result = await monitorFunction(
      async () => {
        return await paymentService.handleWebhook(provider, req.body, signature)
      },
      'handle_webhook',
      { provider, has_signature: !!signature }
    )

    res.json({ received: true, processed: result })
  } catch (error) {
    console.error('Erro ao processar webhook:', error)
    res.status(500).json({
      success: false,
      error: 'Erro ao processar webhook',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    })
  }
})

/**
 * Listar pagamentos
 */
router.get('/payments', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string
    const { 
      page = 1, 
      limit = 50, 
      status, 
      customer_email 
    } = req.query

    // Listar pagamentos usando nosso serviço
    const result = await monitorFunction(
      async () => {
        return await paymentService.listPayments(tenantId, {
          page: Number(page),
          limit: Number(limit),
          status: status as string,
          customer_email: customer_email as string
        })
      },
      'list_payments',
      { tenant_id: tenantId, page, limit, status, customer_email }
    )

    res.json({
      success: true,
      data: result.payments,
      pagination: result.pagination
    })
  } catch (error) {
    console.error('Erro ao listar pagamentos:', error)
    res.status(500).json({
      success: false,
      error: 'Erro ao listar pagamentos',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    })
  }
})

/**
 * Obter estatísticas de pagamento
 */
router.get('/stats', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string
    const { period = '30d' } = req.query

    // Obter estatísticas usando nosso serviço
    const stats = await monitorFunction(
      async () => {
        return await paymentService.getPaymentStats(tenantId, period as string)
      },
      'get_payment_stats',
      { tenant_id: tenantId, period }
    )

    res.json({
      success: true,
      data: stats,
      period: period
    })
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error)
    res.status(500).json({
      success: false,
      error: 'Erro ao calcular estatísticas',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    })
  }
})

/**
 * Obter provedores disponíveis
 */
router.get('/providers/available', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string

    // Obter provedores disponíveis usando nosso serviço
    const providers = await monitorFunction(
      async () => {
        return await paymentService.getAvailableProviders()
      },
      'get_available_providers',
      { tenant_id: tenantId }
    )

    res.json({
      success: true,
      data: providers,
      message: 'Provedores disponíveis listados com sucesso'
    })
  } catch (error) {
    console.error('Erro ao listar provedores disponíveis:', error)
    res.status(500).json({
      success: false,
      error: 'Erro ao listar provedores',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    })
  }
})

/**
 * Listar todos os provedores do tenant
 */
router.get('/providers', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string

    const providers = await monitorFunction(
      async () => {
        const { data, error } = await supabase
          .from('payment_providers')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })

        if (error) throw error
        return data
      },
      'list_payment_providers',
      { tenant_id: tenantId }
    )

    res.json({
      success: true,
      data: providers,
      message: 'Provedores listados com sucesso'
    })
  } catch (error) {
    console.error('Erro ao listar provedores:', error)
    res.status(500).json({
      success: false,
      error: 'Erro ao listar provedores',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    })
  }
})

/**
 * Obter provedor específico
 */
router.get('/providers/:id', async (req, res) => {
  try {
    const { id } = req.params
    const tenantId = req.headers['x-tenant-id'] as string

    const provider = await monitorFunction(
      async () => {
        const { data, error } = await supabase
          .from('payment_providers')
          .select('*')
          .eq('id', id)
          .eq('tenant_id', tenantId)
          .single()

        if (error) throw error
        return data
      },
      'get_payment_provider',
      { provider_id: id, tenant_id: tenantId }
    )

    if (!provider) {
      return res.status(404).json({
        success: false,
        error: 'Provedor não encontrado'
      })
    }

    res.json({
      success: true,
      data: provider,
      message: 'Provedor obtido com sucesso'
    })
  } catch (error) {
    console.error('Erro ao obter provedor:', error)
    res.status(500).json({
      success: false,
      error: 'Erro ao obter provedor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    })
  }
})

/**
 * Atualizar provedor
 */
router.put('/providers/:id', async (req, res) => {
  try {
    const { id } = req.params
    const tenantId = req.headers['x-tenant-id'] as string
    const updates = req.body

    const provider = await monitorFunction(
      async () => {
        const { data, error } = await supabase
          .from('payment_providers')
          .update({
            ...updates,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .eq('tenant_id', tenantId)
          .select()
          .single()

        if (error) throw error
        return data
      },
      'update_payment_provider',
      { provider_id: id, tenant_id: tenantId }
    )

    res.json({
      success: true,
      data: provider,
      message: 'Provedor atualizado com sucesso'
    })
  } catch (error) {
    console.error('Erro ao atualizar provedor:', error)
    res.status(500).json({
      success: false,
      error: 'Erro ao atualizar provedor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    })
  }
})

/**
 * Deletar provedor
 */
router.delete('/providers/:id', async (req, res) => {
  try {
    const { id } = req.params
    const tenantId = req.headers['x-tenant-id'] as string

    await monitorFunction(
      async () => {
        // Deletar chaves secretas primeiro
        await supabase
          .from('payment_provider_secrets')
          .delete()
          .eq('provider_id', id)
          .eq('tenant_id', tenantId)

        // Deletar provedor
        const { error } = await supabase
          .from('payment_providers')
          .delete()
          .eq('id', id)
          .eq('tenant_id', tenantId)

        if (error) throw error
      },
      'delete_payment_provider',
      { provider_id: id, tenant_id: tenantId }
    )

    res.json({
      success: true,
      message: 'Provedor deletado com sucesso'
    })
  } catch (error) {
    console.error('Erro ao deletar provedor:', error)
    res.status(500).json({
      success: false,
      error: 'Erro ao deletar provedor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    })
  }
})

/**
 * Obter detalhes de um pagamento específico
 */
router.get('/payments/:id', async (req, res) => {
  try {
    const { id } = req.params
    const tenantId = req.headers['x-tenant-id'] as string

    const payment = await monitorFunction(
      async () => {
        const { data, error } = await supabase
          .from('payments')
          .select('*')
          .eq('id', id)
          .eq('tenant_id', tenantId)
          .single()

        if (error) throw error
        return data
      },
      'get_payment',
      { payment_id: id, tenant_id: tenantId }
    )

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Pagamento não encontrado'
      })
    }

    res.json({
      success: true,
      data: payment,
      message: 'Pagamento obtido com sucesso'
    })
  } catch (error) {
    console.error('Erro ao obter pagamento:', error)
    res.status(500).json({
      success: false,
      error: 'Erro ao obter pagamento',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    })
  }
})

export { router as paymentsRouter }
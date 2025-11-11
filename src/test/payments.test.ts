import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SupabaseClient } from '@supabase/supabase-js'
import { PaymentsService } from '../lib/api/payments'

// Mock do Supabase
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null }))
      })),
      order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      range: vi.fn(() => Promise.resolve({ data: [], error: null }))
    })),
    insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    update: vi.fn(() => Promise.resolve({ data: null, error: null })),
    delete: vi.fn(() => Promise.resolve({ data: null, error: null }))
  }))
} as unknown as SupabaseClient

// Mock do Stripe
vi.mock('stripe', () => {
  return {
    default: vi.fn(() => ({
      paymentIntents: {
        create: vi.fn(() => Promise.resolve({
          id: 'pi_test123',
          client_secret: 'pi_test_secret',
          status: 'requires_payment_method'
        }))
      },
      balance: {
        retrieve: vi.fn(() => Promise.resolve({
          available: [{ amount: 1000, currency: 'usd' }]
        }))
      }
    }))
  }
})

// Mock do MercadoPago
vi.mock('mercadopago', () => {
  return {
    default: vi.fn(() => ({
      configure: vi.fn(),
      payment: {
        create: vi.fn(() => Promise.resolve({
          body: {
            id: 12345,
            status: 'pending',
            transaction_amount: 100
          }
        }))
      },
      merchant_orders: {
        create: vi.fn()
      }
    }))
  }
})

describe('PaymentsService', () => {
  let paymentsService: PaymentsService

  beforeEach(() => {
    paymentsService = new PaymentsService(mockSupabase)
  })

  describe('createPaymentProvider', () => {
    it('deve criar um provedor Stripe com sucesso', async () => {
      const providerData = {
        name: 'Stripe Principal',
        provider: 'stripe' as const,
        config: {
          secret_key: 'sk_test_123',
          public_key: 'pk_test_123',
          sandbox: true,
          currency: 'BRL',
          country: 'BR'
        },
        status: 'testing' as const
      }

      const result = await paymentsService.createPaymentProvider(providerData)

      expect(result).toHaveProperty('id')
      expect(result.name).toBe('Stripe Principal')
      expect(result.provider).toBe('stripe')
      expect(result.status).toBe('testing')
    })

    it('deve criar um provedor MercadoPago com sucesso', async () => {
      const providerData = {
        name: 'MercadoPago Principal',
        provider: 'mercadopago' as const,
        config: {
          secret_key: 'TEST-123456789',
          public_key: 'TEST-987654321',
          sandbox: true,
          currency: 'BRL',
          country: 'BR'
        },
        status: 'testing' as const
      }

      const result = await paymentsService.createPaymentProvider(providerData)

      expect(result).toHaveProperty('id')
      expect(result.name).toBe('MercadoPago Principal')
      expect(result.provider).toBe('mercadopago')
      expect(result.status).toBe('testing')
    })

    it('deve rejeitar provedor inválido', async () => {
      const providerData = {
        name: 'Provedor Inválido',
        provider: 'invalid_provider' as any,
        config: { secret_key: 'test' },
        status: 'testing' as const
      }

      await expect(paymentsService.createPaymentProvider(providerData))
        .rejects.toThrow('Provedor de pagamento inválido')
    })
  })

  describe('testPaymentProviderConnection', () => {
    it('deve testar conexão Stripe com sucesso', async () => {
      const providerId = 'provider_123'
      
      const result = await paymentsService.testPaymentProviderConnection(providerId)

      expect(result.success).toBe(true)
      expect(result.message).toContain('Conexão bem-sucedida')
    })

    it('deve testar conexão MercadoPago com sucesso', async () => {
      const providerId = 'provider_mercadopago_123'
      
      const result = await paymentsService.testPaymentProviderConnection(providerId)

      expect(result.success).toBe(true)
      expect(result.message).toContain('Conexão bem-sucedida')
    })
  })

  describe('createPayment', () => {
    it('deve criar pagamento com Stripe', async () => {
      const paymentData = {
        amount: 10000, // R$ 100,00 em centavos
        currency: 'BRL',
        description: 'Assinatura mensal',
        customer: {
          email: 'cliente@example.com',
          name: 'João Silva',
          document: '12345678901',
          phone: '11999999999'
        },
        metadata: {
          campaign_id: 'camp_123',
          contact_id: 'cont_456'
        }
      }

      const result = await paymentsService.createPayment('stripe_provider_123', paymentData)

      expect(result).toHaveProperty('id')
      expect(result).toHaveProperty('client_secret')
      expect(result.amount).toBe(10000)
      expect(result.currency).toBe('BRL')
    })

    it('deve criar pagamento com MercadoPago', async () => {
      const paymentData = {
        amount: 5000, // R$ 50,00 em centavos
        currency: 'BRL',
        description: 'Assinatura semestral',
        customer: {
          email: 'maria@example.com',
          name: 'Maria Santos',
          document: '98765432109',
          phone: '11888888888'
        },
        installments: 2
      }

      const result = await paymentsService.createPayment('mercadopago_provider_123', paymentData)

      expect(result).toHaveProperty('id')
      expect(result.amount).toBe(5000)
      expect(result.currency).toBe('BRL')
    })

    it('deve rejeitar provedor inativo', async () => {
      const paymentData = {
        amount: 1000,
        currency: 'BRL',
        description: 'Teste',
        customer: { email: 'test@example.com', name: 'Teste' }
      }

      await expect(paymentsService.createPayment('inactive_provider_123', paymentData))
        .rejects.toThrow('Provedor de pagamento inativo')
    })
  })

  describe('getPaymentStats', () => {
    it('deve retornar estatísticas de pagamento', async () => {
      const result = await paymentsService.getPaymentStats('30d')

      expect(result).toHaveProperty('total_amount')
      expect(result).toHaveProperty('total_transactions')
      expect(result).toHaveProperty('by_status')
      expect(result).toHaveProperty('by_currency')
      expect(result).toHaveProperty('period')
    })

    it('deve calcular estatísticas corretamente', async () => {
      // Mock de dados de pagamento
      const mockPayments = [
        { amount: 1000, currency: 'BRL', status: 'succeeded' },
        { amount: 2000, currency: 'BRL', status: 'succeeded' },
        { amount: 3000, currency: 'USD', status: 'failed' },
        { amount: 1500, currency: 'BRL', status: 'pending' }
      ]

      const result = await paymentsService.getPaymentStats('7d')

      expect(result.total_amount).toBeGreaterThan(0)
      expect(result.total_transactions).toBeGreaterThan(0)
      expect(result.by_status).toHaveProperty('succeeded')
      expect(result.by_status).toHaveProperty('failed')
      expect(result.by_status).toHaveProperty('pending')
    })
  })

  describe('getAvailablePaymentProviders', () => {
    it('deve retornar lista de provedores disponíveis', async () => {
      const result = await paymentsService.getAvailablePaymentProviders()

      expect(result).toHaveProperty('stripe')
      expect(result).toHaveProperty('mercadopago')
      expect(result).toHaveProperty('paypal')
      expect(result).toHaveProperty('pagarme')
      expect(result).toHaveProperty('asaas')

      expect(result.stripe).toHaveProperty('features')
      expect(result.stripe).toHaveProperty('currencies')
      expect(result.stripe).toHaveProperty('countries')
    })

    it('deve incluir informações corretas para cada provedor', async () => {
      const result = await paymentsService.getAvailablePaymentProviders()

      expect(result.stripe.features).toContain('Cartões de crédito')
      expect(result.stripe.features).toContain('Boleto bancário')
      expect(result.mercadopago.features).toContain('Pix')
      expect(result.mercadopago.features).toContain('Cartões de crédito')
    })
  })

  describe('handlePaymentWebhook', () => {
    it('deve processar webhook de pagamento com sucesso', async () => {
      const webhookData = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test123',
            amount: 1000,
            currency: 'brl'
          }
        }
      }

      const result = await paymentsService.handlePaymentWebhook('stripe', webhookData)

      expect(result.success).toBe(true)
      expect(result.message).toContain('Webhook processado')
    })

    it('deve validar assinatura do webhook', async () => {
      const webhookData = {
        type: 'payment.updated',
        data: {
          id: 12345,
          status: 'approved',
          transaction_amount: 5000
        }
      }

      const result = await paymentsService.handlePaymentWebhook('mercadopago', webhookData)

      expect(result.success).toBe(true)
      expect(result.message).toContain('Webhook processado')
    })

    it('deve rejeitar provedor de webhook inválido', async () => {
      const webhookData = { type: 'test', data: {} }

      await expect(paymentsService.handlePaymentWebhook('invalid_provider', webhookData))
        .rejects.toThrow('Provedor de webhook inválido')
    })
  })
})
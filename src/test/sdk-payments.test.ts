import { describe, it, expect, beforeEach, vi } from 'vitest'
import { WhatPressSDK } from '../lib/sdk'

// Mock do fetch global
global.fetch = vi.fn()

describe('WhatPressSDK - Pagamentos', () => {
  let sdk: WhatPressSDK
  const mockApiKey = 'test-api-key-123'

  beforeEach(() => {
    sdk = new WhatPressSDK({
      baseURL: 'https://api.whatpress.com',
      apiKey: mockApiKey
    })
    vi.clearAllMocks()
  })

  describe('payments.listProviders', () => {
    it('deve listar provedores de pagamento', async () => {
      const mockResponse = {
        data: [
          {
            id: 'provider_1',
            name: 'Stripe Principal',
            provider: 'stripe',
            status: 'active'
          },
          {
            id: 'provider_2',
            name: 'MercadoPago Principal',
            provider: 'mercadopago',
            status: 'testing'
          }
        ],
        total: 2,
        page: 1,
        limit: 10
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const result = await sdk.payments.listProviders()

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.whatpress.com/api/payments/providers',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-API-Key': mockApiKey
          })
        })
      )

      expect(result.data).toHaveLength(2)
      expect(result.data[0].provider).toBe('stripe')
      expect(result.data[1].provider).toBe('mercadopago')
    })
  })

  describe('payments.createProvider', () => {
    it('deve criar provedor Stripe', async () => {
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

      const mockResponse = {
        id: 'provider_123',
        ...providerData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const result = await sdk.payments.createProvider(providerData)

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.whatpress.com/api/payments/providers',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-API-Key': mockApiKey,
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify(providerData)
        })
      )

      expect(result.name).toBe('Stripe Principal')
      expect(result.provider).toBe('stripe')
      expect(result.status).toBe('testing')
    })
  })

  describe('payments.testProvider', () => {
    it('deve testar conexão com provedor', async () => {
      const providerId = 'provider_123'
      const mockResponse = {
        success: true,
        message: 'Conexão bem-sucedida com Stripe',
        balance: { available: [{ amount: 1000, currency: 'usd' }] }
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const result = await sdk.payments.testProvider(providerId)

      expect(global.fetch).toHaveBeenCalledWith(
        `https://api.whatpress.com/api/payments/providers/${providerId}/test`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-API-Key': mockApiKey
          })
        })
      )

      expect(result.success).toBe(true)
      expect(result.message).toContain('Conexão bem-sucedida')
    })
  })

  describe('payments.createPayment', () => {
    it('deve criar intenção de pagamento', async () => {
      const paymentData = {
        amount: 10000,
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

      const mockResponse = {
        id: 'payment_123',
        provider_id: 'provider_123',
        provider_payment_id: 'pi_test123',
        client_secret: 'pi_test_secret',
        amount: 10000,
        currency: 'BRL',
        status: 'pending',
        customer_email: 'cliente@example.com',
        customer_name: 'João Silva',
        description: 'Assinatura mensal',
        metadata: paymentData.metadata,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const result = await sdk.payments.createPayment(paymentData)

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.whatpress.com/api/payments',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-API-Key': mockApiKey,
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify(paymentData)
        })
      )

      expect(result.id).toBe('payment_123')
      expect(result.amount).toBe(10000)
      expect(result.currency).toBe('BRL')
      expect(result.client_secret).toBe('pi_test_secret')
    })
  })

  describe('payments.listPayments', () => {
    it('deve listar pagamentos com filtros', async () => {
      const options = {
        page: 1,
        limit: 10,
        status: 'succeeded',
        customer_email: 'cliente@example.com'
      }

      const mockResponse = {
        data: [
          {
            id: 'payment_1',
            amount: 10000,
            currency: 'BRL',
            status: 'succeeded',
            customer_email: 'cliente@example.com',
            created_at: new Date().toISOString()
          }
        ],
        total: 1,
        page: 1,
        limit: 10
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const result = await sdk.payments.listPayments(options)

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.whatpress.com/api/payments?page=1&limit=10&status=succeeded&customer_email=cliente@example.com',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-API-Key': mockApiKey
          })
        })
      )

      expect(result.data).toHaveLength(1)
      expect(result.data[0].status).toBe('succeeded')
      expect(result.data[0].customer_email).toBe('cliente@example.com')
    })
  })

  describe('payments.getStats', () => {
    it('deve obter estatísticas de pagamento', async () => {
      const period = '30d'
      const mockResponse = {
        total_amount: 150000,
        total_transactions: 15,
        by_status: {
          succeeded: 12,
          failed: 2,
          pending: 1,
          cancelled: 0,
          refunded: 0
        },
        by_currency: {
          BRL: 150000,
          USD: 0
        },
        period: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-31T23:59:59Z'
        }
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const result = await sdk.payments.getStats(period)

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.whatpress.com/api/payments/stats?period=30d',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-API-Key': mockApiKey
          })
        })
      )

      expect(result.total_amount).toBe(150000)
      expect(result.total_transactions).toBe(15)
      expect(result.by_status.succeeded).toBe(12)
      expect(result.by_currency.BRL).toBe(150000)
    })
  })

  describe('payments.getAvailableProviders', () => {
    it('deve obter lista de provedores disponíveis', async () => {
      const mockResponse = {
        stripe: {
          name: 'Stripe',
          features: ['Cartões de crédito', 'Boleto bancário', 'Pix'],
          currencies: ['BRL', 'USD', 'EUR'],
          countries: ['BR', 'US', 'CA', 'GB']
        },
        mercadopago: {
          name: 'MercadoPago',
          features: ['Pix', 'Cartões de crédito', 'Boleto bancário'],
          currencies: ['BRL', 'ARS', 'CLP', 'MXN'],
          countries: ['BR', 'AR', 'CL', 'MX']
        },
        paypal: {
          name: 'PayPal',
          features: ['Cartões de crédito', 'PayPal Wallet'],
          currencies: ['BRL', 'USD', 'EUR'],
          countries: ['BR', 'US', 'CA', 'GB', 'DE']
        }
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const result = await sdk.payments.getAvailableProviders()

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.whatpress.com/api/payments/providers/available',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-API-Key': mockApiKey
          })
        })
      )

      expect(result).toHaveProperty('stripe')
      expect(result).toHaveProperty('mercadopago')
      expect(result).toHaveProperty('paypal')
      expect(result.stripe.features).toContain('Cartões de crédito')
      expect(result.mercadopago.features).toContain('Pix')
    })
  })

  describe('Error handling', () => {
    it('deve lidar com erro de autenticação', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized', message: 'API Key inválida' })
      })

      await expect(sdk.payments.listProviders()).rejects.toThrow('Unauthorized')
    })

    it('deve lidar com erro de validação', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Bad Request', message: 'Dados inválidos' })
      })

      await expect(sdk.payments.createPayment({
        amount: -100, // valor inválido
        currency: 'BRL',
        description: 'Teste',
        customer: { email: 'test@example.com', name: 'Teste' }
      })).rejects.toThrow('Bad Request')
    })

    it('deve lidar com erro de servidor', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal Server Error', message: 'Erro interno' })
      })

      await expect(sdk.payments.testProvider('provider_123')).rejects.toThrow('Internal Server Error')
    })

    it('deve lidar com erro de rede', async () => {
      ;(global.fetch as any).mockRejectedValueOnce(new Error('Network error'))

      await expect(sdk.payments.getStats()).rejects.toThrow('Network error')
    })
  })

  describe('Rate limiting', () => {
    it('deve respeitar rate limit e fazer retry', async () => {
      const mockResponse = { data: [], total: 0, page: 1, limit: 10 }

      // Primeira tentativa: rate limited
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Map([['retry-after', '1']]),
        json: async () => ({ error: 'Too Many Requests', message: 'Rate limit exceeded' })
      })

      // Segunda tentativa: sucesso
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const result = await sdk.payments.listProviders()

      expect(global.fetch).toHaveBeenCalledTimes(2)
      expect(result).toEqual(mockResponse)
    })
  })
})
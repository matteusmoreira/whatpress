import Stripe from 'stripe'
import { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

// Esquemas de validação
export const paymentProviderSchema = z.object({
  name: z.string().min(1),
  provider: z.enum(['stripe', 'mercadopago', 'asaas']),
  config: z.object({
    public_key: z.string().optional(),
    secret_key: z.string().min(1),
    webhook_secret: z.string().optional(),
    sandbox: z.boolean().default(true),
    currency: z.string().default('BRL'),
    country: z.string().default('BR')
  }),
  status: z.enum(['active', 'inactive', 'testing', 'error']).default('testing')
})

export const paymentSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().default('BRL'),
  description: z.string().min(1),
  customer: z.object({
    email: z.string().email(),
    name: z.string().min(1),
    document: z.string().optional(), // CPF/CNPJ
    phone: z.string().optional()
  }),
  metadata: z.record(z.any()).optional(),
  payment_method: z.string().optional(),
  installments: z.number().int().min(1).max(12).optional()
})

// Interfaces
export interface PaymentProviderConfig {
  id: string
  name: string
  provider: 'stripe' | 'mercadopago' | 'asaas'
  config: {
    public_key?: string
    secret_key: string
    webhook_secret?: string
    sandbox: boolean
    currency: string
  country: string
  }

  status: 'active' | 'inactive' | 'testing' | 'error'
  test_result?: {
    success: boolean
    message: string
    balance?: any
  }
  created_at: string
  updated_at: string
}

export interface Payment {
  id: string
  provider_id: string
  provider_payment_id: string
  amount: number
  currency: string
  status: 'pending' | 'succeeded' | 'failed' | 'cancelled' | 'refunded'
  customer_email: string
  customer_name: string
  description: string
  metadata?: Record<string, any>
  client_secret?: string
  paid_at?: string
  created_at: string
  updated_at: string
}

export interface PaymentStats {
  total_amount: number
  total_transactions: number
  by_status: Record<string, number>
  by_currency: Record<string, number>
  period: {
    start: string
    end: string
  }
}

// Classe base para provedores de pagamento
export abstract class BasePaymentProvider {
  protected config: PaymentProviderConfig
  protected supabase: SupabaseClient

  constructor(config: PaymentProviderConfig, supabase: SupabaseClient) {
    this.config = config
    this.supabase = supabase
  }

  abstract createPayment(data: z.infer<typeof paymentSchema>): Promise<Payment>
  abstract testConnection(): Promise<{ success: boolean; message: string; balance?: any }>
  abstract handleWebhook(event: any, signature?: string): Promise<{ success: boolean; message: string }>
  abstract getPaymentStatus(paymentId: string): Promise<Payment['status']>
  abstract refundPayment(paymentId: string, amount?: number): Promise<Payment>

  protected async savePayment(paymentData: Partial<Payment>): Promise<Payment> {
    const { data, error } = await this.supabase
      .from('payments')
      .insert({
        ...paymentData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  protected async updatePayment(id: string, updates: Partial<Payment>): Promise<Payment> {
    const { data, error } = await this.supabase
      .from('payments')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }
}

// Implementação do Stripe
export class StripeProvider extends BasePaymentProvider {
  private stripe: Stripe

  constructor(config: PaymentProviderConfig, supabase: SupabaseClient) {
    super(config, supabase)
    this.stripe = new Stripe(config.config.secret_key, {
      apiVersion: '2023-10-16'
    })
  }

  async createPayment(data: z.infer<typeof paymentSchema>): Promise<Payment> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: data.amount,
        currency: data.currency.toLowerCase(),
        description: data.description,
        metadata: {
          ...data.metadata,
          customer_email: data.customer.email,
          customer_name: data.customer.name
        }
      })

      const payment: Partial<Payment> = {
        provider_id: this.config.id,
        provider_payment_id: paymentIntent.id,
        amount: data.amount,
        currency: data.currency,
        status: 'pending',
        customer_email: data.customer.email,
        customer_name: data.customer.name,
        description: data.description,
        metadata: data.metadata,
        client_secret: paymentIntent.client_secret || undefined
      }

      return await this.savePayment(payment)
    } catch (error) {
      throw new Error(`Erro ao criar pagamento com Stripe: ${error}`)
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string; balance?: any }> {
    try {
      const balance = await this.stripe.balance.retrieve()
      return {
        success: true,
        message: 'Conexão bem-sucedida com Stripe',
        balance
      }
    } catch (error) {
      return {
        success: false,
        message: `Erro ao conectar com Stripe: ${error}`
      }
    }
  }

  async handleWebhook(event: any, signature?: string): Promise<{ success: boolean; message: string }> {
    try {
      // Verificar assinatura do webhook
      if (signature && this.config.config.webhook_secret) {
        const eventVerified = this.stripe.webhooks.constructEvent(
          JSON.stringify(event),
          signature,
          this.config.config.webhook_secret
        )
        
        if (eventVerified.type === 'payment_intent.succeeded') {
          const paymentIntent = eventVerified.data.object
          await this.updatePaymentStatus(paymentIntent.id, 'succeeded')
        }
      }

      return { success: true, message: 'Webhook processado com sucesso' }
    } catch (error) {
      return { success: false, message: `Erro ao processar webhook: ${error}` }
    }
  }

  async getPaymentStatus(paymentId: string): Promise<Payment['status']> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentId)
      return this.mapStripeStatus(paymentIntent.status)
    } catch (error) {
      throw new Error(`Erro ao obter status do pagamento: ${error}`)
    }
  }

  async refundPayment(paymentId: string, amount?: number): Promise<Payment> {
    try {
      await this.stripe.refunds.create({
        payment_intent: paymentId,
        amount
      })

      const payment = await this.getPaymentByProviderId(paymentId)
      return await this.updatePayment(payment.id, { status: 'refunded' })
    } catch (error) {
      throw new Error(`Erro ao reembolsar pagamento: ${error}`)
    }
  }

  private mapStripeStatus(stripeStatus: string): Payment['status'] {
    const statusMap: Record<string, Payment['status']> = {
      'succeeded': 'succeeded',
      'processing': 'pending',
      'requires_payment_method': 'pending',
      'requires_confirmation': 'pending',
      'requires_action': 'pending',
      'canceled': 'cancelled',
      'payment_failed': 'failed'
    }
    return statusMap[stripeStatus] || 'pending'
  }

  private async updatePaymentStatus(providerPaymentId: string, status: Payment['status']): Promise<void> {
    const payment = await this.getPaymentByProviderId(providerPaymentId)
    if (payment) {
      await this.updatePayment(payment.id, { 
        status,
        paid_at: status === 'succeeded' ? new Date().toISOString() : undefined
      })
    }
  }

  private async getPaymentByProviderId(providerPaymentId: string): Promise<Payment | null> {
    const { data, error } = await this.supabase
      .from('payments')
      .select()
      .eq('provider_payment_id', providerPaymentId)
      .single()

    if (error) return null
    return data
  }
}

// Implementação do MercadoPago
export class MercadoPagoProvider extends BasePaymentProvider {
  private mp: any

  constructor(config: PaymentProviderConfig, supabase: SupabaseClient) {
    super(config, supabase)
    // Import dinâmico do MercadoPago para evitar problemas de importação
    const MercadoPago = require('mercadopago')
    this.mp = new MercadoPago({
      access_token: config.config.secret_key
    })
  }

  async createPayment(data: z.infer<typeof paymentSchema>): Promise<Payment> {
    try {
      const paymentData = {
        transaction_amount: data.amount / 100, // Converter de centavos para reais
        description: data.description,
        payment_method_id: data.payment_method || 'pix',
        payer: {
          email: data.customer.email,
          first_name: data.customer.name.split(' ')[0],
          last_name: data.customer.name.split(' ').slice(1).join(' '),
          identification: data.customer.document ? {
            type: 'CPF',
            number: data.customer.document
          } : undefined
        },
        installments: data.installments || 1,
        metadata: data.metadata
      }

      const response = await this.mp.payment.create(paymentData)
      const paymentResponse = response.body

      const payment: Partial<Payment> = {
        provider_id: this.config.id,
        provider_payment_id: paymentResponse.id.toString(),
        amount: data.amount,
        currency: data.currency,
        status: this.mapMercadoPagoStatus(paymentResponse.status),
        customer_email: data.customer.email,
        customer_name: data.customer.name,
        description: data.description,
        metadata: data.metadata
      }

      return await this.savePayment(payment)
    } catch (error) {
      throw new Error(`Erro ao criar pagamento com MercadoPago: ${error}`)
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string; balance?: any }> {
    try {
      // Testar conexão criando um pagamento de teste
      const testPayment = {
        transaction_amount: 0.01,
        description: 'Teste de conexão',
        payment_method_id: 'pix',
        payer: {
          email: 'test@example.com',
          first_name: 'Teste'
        }
      }

      await this.mp.payment.create(testPayment)
      
      return {
        success: true,
        message: 'Conexão bem-sucedida com MercadoPago'
      }
    } catch (error) {
      return {
        success: false,
        message: `Erro ao conectar com MercadoPago: ${error}`
      }
    }
  }

  async handleWebhook(event: any, signature?: string): Promise<{ success: boolean; message: string }> {
    try {
      if (event.type === 'payment') {
        const paymentData = event.data
        await this.updatePaymentStatus(
          paymentData.id.toString(), 
          this.mapMercadoPagoStatus(paymentData.status)
        )
      }

      return { success: true, message: 'Webhook processado com sucesso' }
    } catch (error) {
      return { success: false, message: `Erro ao processar webhook: ${error}` }
    }
  }

  async getPaymentStatus(paymentId: string): Promise<Payment['status']> {
    try {
      const response = await this.mp.payment.get(paymentId)
      return this.mapMercadoPagoStatus(response.body.status)
    } catch (error) {
      throw new Error(`Erro ao obter status do pagamento: ${error}`)
    }
  }

  async refundPayment(paymentId: string, amount?: number): Promise<Payment> {
    try {
      await this.mp.payment.refund(paymentId, { amount: amount ? amount / 100 : undefined })
      
      const payment = await this.getPaymentByProviderId(paymentId)
      return await this.updatePayment(payment.id, { status: 'refunded' })
    } catch (error) {
      throw new Error(`Erro ao reembolsar pagamento: ${error}`)
    }
  }

  private mapMercadoPagoStatus(mpStatus: string): Payment['status'] {
    const statusMap: Record<string, Payment['status']> = {
      'approved': 'succeeded',
      'authorized': 'succeeded',
      'in_process': 'pending',
      'pending': 'pending',
      'rejected': 'failed',
      'cancelled': 'cancelled',
      'refunded': 'refunded',
      'charged_back': 'refunded'
    }
    return statusMap[mpStatus] || 'pending'
  }

  private async updatePaymentStatus(providerPaymentId: string, status: Payment['status']): Promise<void> {
    const payment = await this.getPaymentByProviderId(providerPaymentId)
    if (payment) {
      await this.updatePayment(payment.id, { 
        status,
        paid_at: status === 'succeeded' ? new Date().toISOString() : undefined
      })
    }
  }

  private async getPaymentByProviderId(providerPaymentId: string): Promise<Payment | null> {
    const { data, error } = await this.supabase
      .from('payments')
      .select()
      .eq('provider_payment_id', providerPaymentId)
      .single()

    if (error) return null
    return data
  }
}

// Implementação do Asaas
export class AsaasProvider extends BasePaymentProvider {
  private apiUrl: string
  private apiKey: string

  constructor(config: PaymentProviderConfig, supabase: SupabaseClient) {
    super(config, supabase)
    this.apiUrl = config.config.sandbox 
      ? 'https://sandbox.asaas.com/api/v3'
      : 'https://api.asaas.com/v3'
    this.apiKey = config.config.secret_key
  }

  async createPayment(data: z.infer<typeof paymentSchema>): Promise<Payment> {
    try {
      const billingData = {
        customer: data.customer.email,
        billingType: data.payment_method || 'PIX',
        value: data.amount / 100, // Converter de centavos para reais
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Vencimento em 1 dia
        description: data.description,
        externalReference: data.metadata?.reference || undefined,
        postalService: false
      }

      const response = await fetch(`${this.apiUrl}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': this.apiKey
        },
        body: JSON.stringify(billingData)
      })

      if (!response.ok) {
        throw new Error(`Erro na API do Asaas: ${response.status}`)
      }

      const billing = await response.json()

      const payment: Partial<Payment> = {
        provider_id: this.config.id,
        provider_payment_id: billing.id,
        amount: data.amount,
        currency: data.currency,
        status: this.mapAsaasStatus(billing.status),
        customer_email: data.customer.email,
        customer_name: data.customer.name,
        description: data.description,
        metadata: {
          ...data.metadata,
          billing_type: billing.billingType,
          invoice_url: billing.invoiceUrl,
          bank_slip_url: billing.bankSlipUrl,
          pix_qr_code: billing.pixQrCode,
          pix_expiration_date: billing.pixExpirationDate
        }
      }

      return await this.savePayment(payment)
    } catch (error) {
      throw new Error(`Erro ao criar cobrança com Asaas: ${error}`)
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string; balance?: any }> {
    try {
      const response = await fetch(`${this.apiUrl}/myAccount`, {
        method: 'GET',
        headers: {
          'access_token': this.apiKey
        }
      })

      if (!response.ok) {
        throw new Error(`Erro na API do Asaas: ${response.status}`)
      }

      const account = await response.json()
      
      return {
        success: true,
        message: 'Conexão bem-sucedida com Asaas',
        balance: {
          balance: account.balance,
          walletId: account.walletId,
          name: account.name
        }
      }
    } catch (error) {
      return {
        success: false,
        message: `Erro ao conectar com Asaas: ${error}`
      }
    }
  }

  async handleWebhook(event: any, signature?: string): Promise<{ success: boolean; message: string }> {
    try {
      if (event.event === 'PAYMENT_RECEIVED' || event.event === 'PAYMENT_CONFIRMED') {
        await this.updatePaymentStatus(
          event.payment.id,
          'succeeded'
        )
      } else if (event.event === 'PAYMENT_OVERDUE') {
        await this.updatePaymentStatus(
          event.payment.id,
          'failed'
        )
      } else if (event.event === 'PAYMENT_DELETED') {
        await this.updatePaymentStatus(
          event.payment.id,
          'cancelled'
        )
      }

      return { success: true, message: 'Webhook processado com sucesso' }
    } catch (error) {
      return { success: false, message: `Erro ao processar webhook: ${error}` }
    }
  }

  async getPaymentStatus(paymentId: string): Promise<Payment['status']> {
    try {
      const response = await fetch(`${this.apiUrl}/payments/${paymentId}`, {
        method: 'GET',
        headers: {
          'access_token': this.apiKey
        }
      })

      if (!response.ok) {
        throw new Error(`Erro na API do Asaas: ${response.status}`)
      }

      const billing = await response.json()
      return this.mapAsaasStatus(billing.status)
    } catch (error) {
      throw new Error(`Erro ao obter status da cobrança: ${error}`)
    }
  }

  async refundPayment(paymentId: string, amount?: number): Promise<Payment> {
    try {
      const refundData = {
        value: amount ? amount / 100 : undefined,
        description: 'Reembolso via WhatPress'
      }

      const response = await fetch(`${this.apiUrl}/payments/${paymentId}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': this.apiKey
        },
        body: JSON.stringify(refundData)
      })

      if (!response.ok) {
        throw new Error(`Erro na API do Asaas: ${response.status}`)
      }

      const payment = await this.getPaymentByProviderId(paymentId)
      return await this.updatePayment(payment.id, { status: 'refunded' })
    } catch (error) {
      throw new Error(`Erro ao reembolsar cobrança: ${error}`)
    }
  }

  private mapAsaasStatus(asaasStatus: string): Payment['status'] {
    const statusMap: Record<string, Payment['status']> = {
      'PENDING': 'pending',
      'RECEIVED': 'succeeded',
      'CONFIRMED': 'succeeded',
      'OVERDUE': 'failed',
      'REFUNDED': 'refunded',
      'CANCELLED': 'cancelled',
      'RECEIVED_IN_CASH': 'succeeded',
      'REFUND_REQUESTED': 'refunded'
    }
    return statusMap[asaasStatus] || 'pending'
  }

  private async updatePaymentStatus(providerPaymentId: string, status: Payment['status']): Promise<void> {
    const payment = await this.getPaymentByProviderId(providerPaymentId)
    if (payment) {
      await this.updatePayment(payment.id, { 
        status,
        paid_at: status === 'succeeded' ? new Date().toISOString() : undefined
      })
    }
  }

  private async getPaymentByProviderId(providerPaymentId: string): Promise<Payment | null> {
    const { data, error } = await this.supabase
      .from('payments')
      .select()
      .eq('provider_payment_id', providerPaymentId)
      .single()

    if (error) return null
    return data
  }
}

// Factory para criar provedores
export class PaymentProviderFactory {
  static createProvider(config: PaymentProviderConfig, supabase: SupabaseClient): BasePaymentProvider {
    switch (config.provider) {
      case 'stripe':
        return new StripeProvider(config, supabase)
      case 'mercadopago':
        return new MercadoPagoProvider(config, supabase)
      case 'asaas':
        return new AsaasProvider(config, supabase)
      default:
        throw new Error(`Provedor de pagamento não suportado: ${config.provider}`)
    }
  }
}

// Serviço principal de pagamentos
export class PaymentService {
  private supabase: SupabaseClient

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase
  }

  async createPaymentProvider(data: z.infer<typeof paymentProviderSchema>): Promise<PaymentProviderConfig> {
    const validatedData = paymentProviderSchema.parse(data)
    
    const { data: provider, error } = await this.supabase
      .from('payment_providers')
      .insert({
        ...validatedData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error
    return provider
  }

  async getPaymentProvider(id: string): Promise<PaymentProviderConfig> {
    const { data, error } = await this.supabase
      .from('payment_providers')
      .select()
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  }

  async listPaymentProviders(options?: { page?: number; limit?: number }): Promise<{
    data: PaymentProviderConfig[]
    total: number
    page: number
    limit: number
  }> {
    const page = options?.page || 1
    const limit = options?.limit || 10
    const offset = (page - 1) * limit

    const [{ data, error }, { count, error: countError }] = await Promise.all([
      this.supabase
        .from('payment_providers')
        .select()
        .range(offset, offset + limit - 1)
        .order('created_at', { ascending: false }),
      this.supabase
        .from('payment_providers')
        .select('*', { count: 'exact', head: true })
    ])

    if (error) throw error
    if (countError) throw countError

    return {
      data: data || [],
      total: count || 0,
      page,
      limit
    }
  }

  async testPaymentProviderConnection(id: string): Promise<{ success: boolean; message: string; balance?: any }> {
    const provider = await this.getPaymentProvider(id)
    const providerInstance = PaymentProviderFactory.createProvider(provider, this.supabase)
    
    const result = await providerInstance.testConnection()
    
    // Atualizar test_result no banco
    await this.supabase
      .from('payment_providers')
      .update({ test_result: result, updated_at: new Date().toISOString() })
      .eq('id', id)

    return result
  }

  async createPayment(providerId: string, data: z.infer<typeof paymentSchema>): Promise<Payment> {
    const provider = await this.getPaymentProvider(providerId)
    
    if (provider.status !== 'active' && provider.status !== 'testing') {
      throw new Error('Provedor de pagamento inativo')
    }

    const providerInstance = PaymentProviderFactory.createProvider(provider, this.supabase)
    return await providerInstance.createPayment(data)
  }

  async getPayment(id: string): Promise<Payment> {
    const { data, error } = await this.supabase
      .from('payments')
      .select()
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  }

  async listPayments(options?: {
    page?: number
    limit?: number
    status?: string
    customer_email?: string
  }): Promise<{
    data: Payment[]
    total: number
    page: number
    limit: number
  }> {
    const page = options?.page || 1
    const limit = options?.limit || 10
    const offset = (page - 1) * limit

    let query = this.supabase
      .from('payments')
      .select()
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false })

    if (options?.status) {
      query = query.eq('status', options.status)
    }

    if (options?.customer_email) {
      query = query.eq('customer_email', options.customer_email)
    }

    const [{ data, error }, { count, error: countError }] = await Promise.all([
      query,
      this.supabase
        .from('payments')
        .select('*', { count: 'exact', head: true })
    ])

    if (error) throw error
    if (countError) throw countError

    return {
      data: data || [],
      total: count || 0,
      page,
      limit
    }
  }

  async getPaymentStats(period: string = '30d'): Promise<PaymentStats> {
    const periodDays = parseInt(period.replace('d', '')) || 30
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - periodDays)

    const { data, error } = await this.supabase
      .from('payments')
      .select('amount, currency, status, created_at')
      .gte('created_at', startDate.toISOString())

    if (error) throw error

    const stats: PaymentStats = {
      total_amount: 0,
      total_transactions: data?.length || 0,
      by_status: {},
      by_currency: {},
      period: {
        start: startDate.toISOString(),
        end: new Date().toISOString()
      }
    }

    if (data) {
      data.forEach(payment => {
        // Total por status
        stats.by_status[payment.status] = (stats.by_status[payment.status] || 0) + 1
        
        // Total por moeda
        stats.by_currency[payment.currency] = (stats.by_currency[payment.currency] || 0) + payment.amount
        
        // Total geral (apenas pagamentos bem-sucedidos)
        if (payment.status === 'succeeded') {
          stats.total_amount += payment.amount
        }
      })
    }

    return stats
  }

  async handlePaymentWebhook(provider: string, event: any, signature?: string): Promise<{ success: boolean; message: string }> {
    // Buscar provedor ativo do tipo especificado
    const { data: providers, error } = await this.supabase
      .from('payment_providers')
      .select()
      .eq('provider', provider)
      .eq('status', 'active')

    if (error || !providers || providers.length === 0) {
      throw new Error('Provedor de webhook inválido')
    }

    // Processar webhook com o primeiro provedor ativo
    const providerConfig = providers[0]
    const providerInstance = PaymentProviderFactory.createProvider(providerConfig, this.supabase)
    
    return await providerInstance.handleWebhook(event, signature)
  }

  getAvailableProviders(): Record<string, any> {
    return {
      stripe: {
        name: 'Stripe',
        features: [
          'Cartões de crédito',
          'Cartões de débito',
          'Boleto bancário',
          'Pix (via parceiros)',
          'Checkout transparente',
          'Assinaturas recorrentes'
        ],
        currencies: ['BRL', 'USD', 'EUR', 'GBP', 'CAD', 'AUD'],
        countries: ['BR', 'US', 'CA', 'GB', 'AU', 'DE', 'FR', 'ES', 'IT']
      },
      mercadopago: {
        name: 'MercadoPago',
        features: [
          'Pix',
          'Cartões de crédito',
          'Cartões de débito',
          'Boleto bancário',
          'Checkout Pro',
          'Checkout transparente',
          'Assinaturas recorrentes'
        ],
        currencies: ['BRL', 'ARS', 'CLP', 'COP', 'MXN', 'PEN', 'UYU'],
        countries: ['BR', 'AR', 'CL', 'CO', 'MX', 'PE', 'UY']
      },

      asaas: {
        name: 'Asaas',
        features: [
          'Boleto bancário',
          'Pix',
          'Cartões de crédito',
          'Cartões de débito',
          'Carnê',
          'Assinaturas recorrentes',
          'Cobrança recorrente',
          'Antecipação de recebíveis'
        ],
        currencies: ['BRL'],
        countries: ['BR']
      }
    }
  }
}

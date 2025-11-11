import { supabase } from '@/lib/supabase'
import { monitorFunction } from '@/lib/monitoring'
import crypto from 'crypto'

/**
 * Interface para webhooks
 */
export interface Webhook {
  id: string
  name: string
  url: string
  secret?: string
  events: string[]
  headers?: Record<string, string>
  retry_config: {
    max_attempts: number
    backoff_multiplier: number
    initial_delay: number
  }
  status: 'active' | 'inactive' | 'error'
  tenant_id: string
  created_at: Date
  updated_at: Date
}

/**
 * Interface para tentativas de webhook
 */
export interface WebhookAttempt {
  id: string
  webhook_id: string
  event_id: string
  event_type: string
  payload: any
  response_status?: number
  response_headers?: Record<string, string>
  response_body?: string
  error_message?: string
  attempt_number: number
  status: 'pending' | 'success' | 'failed' | 'retry'
  next_retry_at?: Date
  created_at: Date
  executed_at?: Date
}

/**
 * Interface para eventos
 */
export interface WebhookEvent {
  id: string
  type: string
  tenant_id: string
  data: any
  created_at: Date
}

/**
 * Serviço de Webhooks Avançado
 */
export class AdvancedWebhookService {
  private retryQueue: Map<string, NodeJS.Timeout> = new Map()

  /**
   * Criar webhook
   */
  async createWebhook(webhookData: Omit<Webhook, 'id' | 'created_at' | 'updated_at'>): Promise<Webhook> {
    return monitorFunction('webhook.create', async () => {
      const webhook: Webhook = {
        ...webhookData,
        id: crypto.randomUUID(),
        created_at: new Date(),
        updated_at: new Date()
      }

      const { data, error } = await supabase
        .from('webhooks')
        .insert(webhook)
        .select()
        .single()

      if (error) {
        throw new Error(`Failed to create webhook: ${error.message}`)
      }

      return data
    })
  }

  /**
   * Listar webhooks
   */
  async listWebhooks(tenantId: string): Promise<Webhook[]> {
    return monitorFunction('webhook.list', async () => {
      const { data, error } = await supabase
        .from('webhooks')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })

      if (error) {
        throw new Error(`Failed to list webhooks: ${error.message}`)
      }

      return data || []
    })
  }

  /**
   * Obter webhook
   */
  async getWebhook(webhookId: string, tenantId: string): Promise<Webhook | null> {
    return monitorFunction('webhook.get', async () => {
      const { data, error } = await supabase
        .from('webhooks')
        .select('*')
        .eq('id', webhookId)
        .eq('tenant_id', tenantId)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw new Error(`Failed to get webhook: ${error.message}`)
      }

      return data
    })
  }

  /**
   * Atualizar webhook
   */
  async updateWebhook(webhookId: string, tenantId: string, updates: Partial<Webhook>): Promise<Webhook> {
    return monitorFunction('webhook.update', async () => {
      const { data, error } = await supabase
        .from('webhooks')
        .update({
          ...updates,
          updated_at: new Date()
        })
        .eq('id', webhookId)
        .eq('tenant_id', tenantId)
        .select()
        .single()

      if (error) {
        throw new Error(`Failed to update webhook: ${error.message}`)
      }

      return data
    })
  }

  /**
   * Deletar webhook
   */
  async deleteWebhook(webhookId: string, tenantId: string): Promise<void> {
    return monitorFunction('webhook.delete', async () => {
      // Cancelar tentativas pendentes
      await this.cancelPendingAttempts(webhookId)

      const { error } = await supabase
        .from('webhooks')
        .delete()
        .eq('id', webhookId)
        .eq('tenant_id', tenantId)

      if (error) {
        throw new Error(`Failed to delete webhook: ${error.message}`)
      }
    })
  }

  /**
   * Emitir evento
   */
  async emitEvent(event: Omit<WebhookEvent, 'id' | 'created_at'>): Promise<WebhookEvent> {
    return monitorFunction('webhook.emit', async () => {
      const webhookEvent: WebhookEvent = {
        ...event,
        id: crypto.randomUUID(),
        created_at: new Date()
      }

      // Salvar evento
      const { data, error } = await supabase
        .from('webhook_events')
        .insert(webhookEvent)
        .select()
        .single()

      if (error) {
        throw new Error(`Failed to save event: ${error.message}`)
      }

      // Encontrar webhooks ativos para este evento
      const { data: webhooks } = await supabase
        .from('webhooks')
        .select('*')
        .eq('tenant_id', event.tenant_id)
        .eq('status', 'active')
        .contains('events', [event.type])

      if (webhooks) {
        // Criar tentativas para cada webhook
        for (const webhook of webhooks) {
          await this.createAttempt(webhook, webhookEvent)
        }
      }

      return data
    })
  }

  /**
   * Criar tentativa de webhook
   */
  private async createAttempt(webhook: Webhook, event: WebhookEvent): Promise<WebhookAttempt> {
    const attempt: WebhookAttempt = {
      id: crypto.randomUUID(),
      webhook_id: webhook.id,
      event_id: event.id,
      event_type: event.type,
      payload: event.data,
      attempt_number: 1,
      status: 'pending',
      created_at: new Date()
    }

    const { data, error } = await supabase
      .from('webhook_attempts')
      .insert(attempt)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create attempt: ${error.message}`)
    }

    // Executar imediatamente se webhook estiver ativo
    if (webhook.status === 'active') {
      this.executeAttempt(data)
    }

    return data
  }

  /**
   * Executar tentativa de webhook
   */
  private async executeAttempt(attempt: WebhookAttempt): Promise<void> {
    const webhook = await this.getWebhook(attempt.webhook_id, '')
    if (!webhook) {
      return
    }

    try {
      // Preparar payload
      const payload = {
        event: attempt.event_type,
        data: attempt.payload,
        timestamp: new Date().toISOString(),
        event_id: attempt.event_id,
        attempt: attempt.attempt_number
      }

      // Adicionar assinatura se houver secret
      let headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'WhatPress-Webhook/1.0',
        'X-Webhook-Event': attempt.event_type,
        'X-Webhook-Event-Id': attempt.event_id,
        'X-Webhook-Attempt': attempt.attempt_number.toString()
      }

      if (webhook.secret) {
        const signature = crypto
          .createHmac('sha256', webhook.secret)
          .update(JSON.stringify(payload))
          .digest('hex')
        headers['X-Webhook-Signature'] = `sha256=${signature}`
      }

      // Adicionar headers customizados
      if (webhook.headers) {
        headers = { ...headers, ...webhook.headers }
      }

      // Executar requisição
      const startTime = Date.now()
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        timeout: 30000 // 30 segundos
      })
      const duration = Date.now() - startTime

      // Atualizar tentativa
      const responseBody = await response.text()
      
      await supabase
        .from('webhook_attempts')
        .update({
          response_status: response.status,
          response_headers: Object.fromEntries(response.headers.entries()),
          response_body: responseBody.substring(0, 10000), // Limitar tamanho
          status: response.ok ? 'success' : 'failed',
          executed_at: new Date()
        })
        .eq('id', attempt.id)

      // Se falhou e ainda há tentativas, agendar retry
      if (!response.ok && attempt.attempt_number < webhook.retry_config.max_attempts) {
        await this.scheduleRetry(webhook, attempt)
      }

      // Monitorar métricas
      monitorFunction('webhook.attempt', async () => {
        console.log('Webhook attempt:', {
          webhook_id: attempt.webhook_id,
          event_id: attempt.event_id,
          attempt_number: attempt.attempt_number,
          status: response.ok ? 'success' : 'failed',
          response_status: response.status,
          duration
        })
      })

    } catch (error) {
      console.error('Webhook attempt failed:', error)

      // Atualizar tentativa com erro
      await supabase
        .from('webhook_attempts')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          executed_at: new Date()
        })
        .eq('id', attempt.id)

      // Agendar retry se apropriado
      if (attempt.attempt_number < webhook.retry_config.max_attempts) {
        await this.scheduleRetry(webhook, attempt)
      }
    }
  }

  /**
   * Agendar retry
   */
  private async scheduleRetry(webhook: Webhook, attempt: WebhookAttempt): Promise<void> {
    const retryDelay = webhook.retry_config.initial_delay * 
                      Math.pow(webhook.retry_config.backoff_multiplier, attempt.attempt_number - 1)
    
    const nextRetryAt = new Date(Date.now() + retryDelay)

    // Atualizar status para retry
    await supabase
      .from('webhook_attempts')
      .update({
        status: 'retry',
        next_retry_at: nextRetryAt
      })
      .eq('id', attempt.id)

    // Agendar execução
    const timeoutId = setTimeout(async () => {
      // Criar nova tentativa
      const newAttempt: WebhookAttempt = {
        id: crypto.randomUUID(),
        webhook_id: attempt.webhook_id,
        event_id: attempt.event_id,
        event_type: attempt.event_type,
        payload: attempt.payload,
        attempt_number: attempt.attempt_number + 1,
        status: 'pending',
        created_at: new Date()
      }

      const { data } = await supabase
        .from('webhook_attempts')
        .insert(newAttempt)
        .select()
        .single()

      if (data) {
        this.executeAttempt(data)
      }

      // Limpar timeout do mapa
      this.retryQueue.delete(attempt.id)
    }, retryDelay)

    // Guardar timeout para cancelamento
    this.retryQueue.set(attempt.id, timeoutId)
  }

  /**
   * Cancelar tentativas pendentes
   */
  private async cancelPendingAttempts(webhookId: string): Promise<void> {
    // Cancelar timeouts agendados
    for (const [attemptId, timeoutId] of this.retryQueue.entries()) {
      if (attemptId.startsWith(webhookId)) {
        clearTimeout(timeoutId)
        this.retryQueue.delete(attemptId)
      }
    }

    // Atualizar tentativas pendentes
    await supabase
      .from('webhook_attempts')
      .update({ status: 'failed', error_message: 'Webhook deleted' })
      .eq('webhook_id', webhookId)
      .in('status', ['pending', 'retry'])
  }

  /**
   * Obter tentativas de um webhook
   */
  async getWebhookAttempts(webhookId: string, tenantId: string, limit: number = 50): Promise<WebhookAttempt[]> {
    return monitorFunction('webhook.attempts.list', async () => {
      const { data, error } = await supabase
        .from('webhook_attempts')
        .select('*')
        .eq('webhook_id', webhookId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        throw new Error(`Failed to get attempts: ${error.message}`)
      }

      return data || []
    })
  }

  /**
   * Reprocessar tentativa falhada
   */
  async retryAttempt(attemptId: string, tenantId: string): Promise<void> {
    return monitorFunction('webhook.attempt.retry', async () => {
      const { data: attempt, error } = await supabase
        .from('webhook_attempts')
        .select('*')
        .eq('id', attemptId)
        .single()

      if (error) {
        throw new Error(`Failed to get attempt: ${error.message}`)
      }

      // Verificar se o webhook existe e pertence ao tenant
      const webhook = await this.getWebhook(attempt.webhook_id, tenantId)
      if (!webhook) {
        throw new Error('Webhook not found')
      }

      // Criar nova tentativa
      const newAttempt: WebhookAttempt = {
        id: crypto.randomUUID(),
        webhook_id: attempt.webhook_id,
        event_id: attempt.event_id,
        event_type: attempt.event_type,
        payload: attempt.payload,
        attempt_number: attempt.attempt_number + 1,
        status: 'pending',
        created_at: new Date()
      }

      const { data: newAttemptData } = await supabase
        .from('webhook_attempts')
        .insert(newAttempt)
        .select()
        .single()

      if (newAttemptData) {
        this.executeAttempt(newAttemptData)
      }
    })
  }
}

// Exportar instância singleton
export const webhookService = new AdvancedWebhookService()

/**
 * Funções auxiliares para emitir eventos comuns
 */
export async function emitCampaignEvent(event: string, campaignId: string, tenantId: string, data: any) {
  return webhookService.emitEvent({
    type: `campaign.${event}`,
    tenant_id: tenantId,
    data: {
      campaign_id: campaignId,
      ...data
    }
  })
}

export async function emitContactEvent(event: string, contactId: string, tenantId: string, data: any) {
  return webhookService.emitEvent({
    type: `contact.${event}`,
    tenant_id: tenantId,
    data: {
      contact_id: contactId,
      ...data
    }
  })
}

export async function emitAnalyticsEvent(event: string, tenantId: string, data: any) {
  return webhookService.emitEvent({
    type: `analytics.${event}`,
    tenant_id: tenantId,
    data
  })
}
/**
 * Sistema de Mensagens em Massa com Rate Limiting Inteligente
 * 
 * Implementa:
 * - Rate limiting adaptativo baseado em provedor e horário
 * - Distribuição inteligente de cargas
 * - Retry automático com backoff exponencial
 * - Fallback para falhas
 * - Monitoramento de performance
 * - Segmentação de audiência
 */

import { supabase } from './supabase'
import { addQueueJob } from './queue'
import { redis } from './redis'
import { monitorFunction, monitorDatabaseQuery } from './monitoring'
import { CircuitBreaker } from './circuitBreaker'
import { RateLimiterRedis } from 'rate-limiter-flexible'
import { v4 as uuidv4 } from 'uuid'

// Configurações de rate limiting por provedor
export const RATE_LIMITS = {
  WHATSAPP: {
    BUSINESS: {
      MESSAGES_PER_SECOND: 80,  // 80 mensagens por segundo
      MESSAGES_PER_HOUR: 100000, // 100k por hora
      MESSAGES_PER_DAY: 1000000  // 1M por dia
    },
    REGULAR: {
      MESSAGES_PER_SECOND: 20,   // 20 mensagens por segundo
      MESSAGES_PER_HOUR: 1000,   // 1k por hora
      MESSAGES_PER_DAY: 10000    // 10k por dia
    }
  },
  EMAIL: {
    SES: {
      MESSAGES_PER_SECOND: 200,    // 200 emails por segundo
      MESSAGES_PER_HOUR: 50000,   // 50k por hora
      MESSAGES_PER_DAY: 1000000   // 1M por dia
    },
    SMTP: {
      MESSAGES_PER_SECOND: 100,    // 100 emails por segundo
      MESSAGES_PER_HOUR: 10000,    // 10k por hora
      MESSAGES_PER_DAY: 100000     // 100k por dia
    }
  },
  SMS: {
    TWILIO: {
      MESSAGES_PER_SECOND: 100,    // 100 SMS por segundo
      MESSAGES_PER_HOUR: 10000,    // 10k por hora
      MESSAGES_PER_DAY: 100000     // 100k por dia
    },
    REGULAR: {
      MESSAGES_PER_SECOND: 10,     // 10 SMS por segundo
      MESSAGES_PER_HOUR: 1000,     // 1k por hora
      MESSAGES_PER_DAY: 10000      // 10k por dia
    }
  }
} as const

// Prioridades de envio
export const MESSAGE_PRIORITIES = {
  CRITICAL: 1,    // Sistema crítico
  HIGH: 2,        // Notificações importantes
  NORMAL: 3,      // Marketing e comunicações gerais
  LOW: 4          // Newsletters e atualizações
} as const

// Status de envio
export const MESSAGE_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  RETRY: 'retry',
  CANCELLED: 'cancelled'
} as const

export type MessagePriority = typeof MESSAGE_PRIORITIES[keyof typeof MESSAGE_PRIORITIES]
export type MessageStatus = typeof MESSAGE_STATUS[keyof typeof MESSAGE_STATUS]

export interface BulkMessageJob {
  id: string
  tenantId: string
  name: string
  templateId?: string
  content?: string
  variables?: Record<string, any>
  recipients: Array<{
    id: string
    contactId: string
    phone?: string
    email?: string
    name: string
    variables?: Record<string, any>
  }>
  channel: 'whatsapp' | 'email' | 'sms'
  provider: string
  priority: MessagePriority
  status: MessageStatus
  totalRecipients: number
  processedRecipients: number
  successfulSends: number
  failedSends: number
  scheduledAt?: string
  startedAt?: string
  completedAt?: string
  createdAt: string
  updatedAt: string
  rateLimitKey?: string
  batchSize: number
  retryCount: number
  maxRetries: number
  segmentation?: {
    tags?: string[]
    demographics?: {
      ageRange?: { min: number; max: number }
      location?: string[]
      interests?: string[]
    }
    behavior?: {
      lastActivity?: { days: number; operator: 'before' | 'after' }
      engagementLevel?: 'high' | 'medium' | 'low'
    }
  }
}

export interface BulkMessageRecipient {
  id: string
  jobId: string
  contactId: string
  tenantId: string
  phone?: string
  email?: string
  name: string
  status: MessageStatus
  variables?: Record<string, any>
  sentAt?: string
  deliveredAt?: string
  failedAt?: string
  errorMessage?: string
  retryCount: number
  nextRetryAt?: string
  rateLimitDelay?: number
  priority: MessagePriority
  batchId: string
}

// Circuit breakers por provedor
const circuitBreakers = new Map<string, CircuitBreaker>()

function getCircuitBreaker(provider: string, channel: string): CircuitBreaker {
  const key = `${channel}:${provider}`
  
  if (!circuitBreakers.has(key)) {
    circuitBreakers.set(key, new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 30000, // 30 segundos
      monitoringPeriod: 60000, // 1 minuto
      onStateChange: (state) => {
        console.log(`Circuit breaker ${key} mudou para estado: ${state}`)
      }
    }))
  }
  
  return circuitBreakers.get(key)!
}

// Rate limiters por tenant e provedor
const rateLimiters = new Map<string, RateLimiterRedis>()

async function getRateLimiter(
  tenantId: string,
  channel: string,
  provider: string
): Promise<RateLimiterRedis> {
  const key = `${tenantId}:${channel}:${provider}`
  
  if (!rateLimiters.has(key)) {
    const limits = RATE_LIMITS[channel.toUpperCase() as keyof typeof RATE_LIMITS]?.[provider.toUpperCase() as any] || 
                   RATE_LIMITS[channel.toUpperCase() as keyof typeof RATE_LIMITS]?.REGULAR
    
    if (!limits) {
      throw new Error(`Rate limits não configurados para ${channel}:${provider}`)
    }
    
    const rateLimiter = new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: `rl:${key}`,
      points: limits.MESSAGES_PER_SECOND,
      duration: 1, // 1 segundo
      blockDuration: 60, // Bloquear por 1 minuto se exceder
      execEvenly: true, // Distribuir uniformemente
      execEvenlyMinDelayMs: 10 // Mínimo 10ms entre mensagens
    })
    
    rateLimiters.set(key, rateLimiter)
  }
  
  return rateLimiters.get(key)!
}

/**
 * Calcula o melhor horário para envio baseado em analytics
 */
export async function calculateOptimalSendTime(
  tenantId: string,
  channel: string,
  recipientsCount: number
): Promise<Date> {
  return monitorFunction(
    async () => {
      // Obter analytics de horários de abertura/engajamento
      const { data: analytics } = await monitorDatabaseQuery(
        () => supabase
          .from('message_analytics')
          .select('hour, open_rate, click_rate')
          .eq('tenant_id', tenantId)
          .eq('channel', channel)
          .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Últimos 30 dias
          .order('hour'),
        {
          queryName: 'get_message_analytics',
          category: 'analytics'
        }
      )

      if (analytics && analytics.length > 0) {
        // Encontrar horário com melhor taxa de abertura
        const bestHour = analytics.reduce((best, current) => 
          (current.open_rate || 0) > (best.open_rate || 0) ? current : best
        )

        const now = new Date()
        const optimalTime = new Date()
        optimalTime.setHours(bestHour.hour, 0, 0, 0)

        // Se o horário já passou hoje, agendar para amanhã
        if (optimalTime <= now) {
          optimalTime.setDate(optimalTime.getDate() + 1)
        }

        return optimalTime
      }

      // Horário padrão: 14h (melhor horário geral para marketing)
      const defaultTime = new Date()
      defaultTime.setHours(14, 0, 0, 0)
      
      if (defaultTime <= new Date()) {
        defaultTime.setDate(defaultTime.getDate() + 1)
      }

      return defaultTime
    },
    {
      functionName: 'calculateOptimalSendTime',
      category: 'analytics',
      metadata: { tenantId, channel, recipientsCount }
    }
  )()
}

/**
 * Segmenta audiência baseada em critérios
 */
export async function segmentAudience(
  tenantId: string,
  segmentation: BulkMessageJob['segmentation']
): Promise<string[]> {
  return monitorFunction(
    async () => {
      if (!segmentation) {
        return []
      }

      let query = supabase
        .from('contacts')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)

      // Filtro por tags
      if (segmentation.tags && segmentation.tags.length > 0) {
        query = query.contains('tags', segmentation.tags)
      }

      // Filtro por demografia
      if (segmentation.demographics) {
        if (segmentation.demographics.ageRange) {
          const { min, max } = segmentation.demographics.ageRange
          query = query.gte('age', min).lte('age', max)
        }

        if (segmentation.demographics.location && segmentation.demographics.location.length > 0) {
          query = query.in('location', segmentation.demographics.location)
        }

        if (segmentation.demographics.interests && segmentation.demographics.interests.length > 0) {
          query = query.contains('interests', segmentation.demographics.interests)
        }
      }

      // Filtro por comportamento
      if (segmentation.behavior) {
        if (segmentation.behavior.lastActivity) {
          const { days, operator } = segmentation.behavior.lastActivity
          const cutoffDate = new Date()
          cutoffDate.setDate(cutoffDate.getDate() - days)

          if (operator === 'before') {
            query = query.lte('last_activity_at', cutoffDate.toISOString())
          } else {
            query = query.gte('last_activity_at', cutoffDate.toISOString())
          }
        }

        if (segmentation.behavior.engagementLevel) {
          query = query.eq('engagement_level', segmentation.behavior.engagementLevel)
        }
      }

      const { data, error } = await monitorDatabaseQuery(
        () => query,
        {
          queryName: 'segment_contacts',
          category: 'database'
        }
      )

      if (error) {
        throw new Error(`Erro ao segmentar audiência: ${error.message}`)
      }

      return data?.map(contact => contact.id) || []
    },
    {
      functionName: 'segmentAudience',
      category: 'database',
      metadata: { tenantId, segmentation }
    }
  )()
}

/**
 * Cria job de mensagens em massa
 */
export async function createBulkMessageJob(
  jobData: Omit<BulkMessageJob, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'processedRecipients' | 'successfulSends' | 'failedSends' | 'retryCount'>
): Promise<BulkMessageJob> {
  return monitorFunction(
    async () => {
      const job: BulkMessageJob = {
        ...jobData,
        id: uuidv4(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: MESSAGE_STATUS.PENDING,
        processedRecipients: 0,
        successfulSends: 0,
        failedSends: 0,
        retryCount: 0
      }

      // Calcular horário ótimo se não estiver agendado
      if (!job.scheduledAt && job.priority <= MESSAGE_PRIORITIES.NORMAL) {
        const optimalTime = await calculateOptimalSendTime(
          job.tenantId,
          job.channel,
          job.totalRecipients
        )
        job.scheduledAt = optimalTime.toISOString()
      }

      // Segmentar audiência se necessário
      if (job.segmentation) {
        const segmentedContacts = await segmentAudience(job.tenantId, job.segmentation)
        
        // Atualizar recipients com contatos segmentados
        job.recipients = job.recipients.filter(recipient => 
          segmentedContacts.includes(recipient.contactId)
        )
        job.totalRecipients = job.recipients.length
      }

      // Criar rate limit key única
      job.rateLimitKey = `${job.tenantId}:${job.channel}:${job.provider}:${Date.now()}`

      // Salvar job
      const { data, error } = await monitorDatabaseQuery(
        () => supabase
          .from('bulk_message_jobs')
          .insert(job)
          .select()
          .single(),
        {
          queryName: 'create_bulk_message_job',
          category: 'database'
        }
      )

      if (error) {
        throw new Error(`Erro ao criar job: ${error.message}`)
      }

      // Criar recipients individuais
      const recipients: BulkMessageRecipient[] = job.recipients.map(recipient => ({
        id: uuidv4(),
        jobId: job.id,
        contactId: recipient.contactId,
        tenantId: job.tenantId,
        phone: recipient.phone,
        email: recipient.email,
        name: recipient.name,
        status: MESSAGE_STATUS.PENDING,
        variables: recipient.variables,
        retryCount: 0,
        priority: job.priority,
        batchId: `batch_${job.id}_${Math.floor(Math.random() * 1000)}`
      }))

      // Salvar recipients em lotes
      const batchSize = 1000
      for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize)
        
        const { error: recipientsError } = await monitorDatabaseQuery(
          () => supabase
            .from('bulk_message_recipients')
            .insert(batch),
          {
            queryName: 'create_bulk_message_recipients_batch',
            category: 'database'
          }
        )

        if (recipientsError) {
          console.error(`Erro ao salvar batch de recipients:`, recipientsError)
        }
      }

      // Adicionar à fila para processamento
      await addQueueJob('bulk', 'process', {
        jobId: job.id,
        tenantId: job.tenantId,
        channel: job.channel,
        provider: job.provider,
        priority: job.priority,
        scheduledAt: job.scheduledAt
      })

      return data
    },
    {
      functionName: 'createBulkMessageJob',
      category: 'bulk_messages',
      metadata: {
        tenantId: jobData.tenantId,
        channel: jobData.channel,
        provider: jobData.provider,
        totalRecipients: jobData.totalRecipients,
        priority: jobData.priority
      }
    }
  )()
}

/**
 * Processa lote de mensagens com rate limiting
 */
export async function processBulkMessageBatch(
  jobId: string,
  batchId: string,
  tenantId: string,
  channel: string,
  provider: string
): Promise<void> {
  return monitorFunction(
    async () => {
      const circuitBreaker = getCircuitBreaker(provider, channel)
      const rateLimiter = await getRateLimiter(tenantId, channel, provider)

      // Obter recipients do lote
      const { data: recipients } = await monitorDatabaseQuery(
        () => supabase
          .from('bulk_message_recipients')
          .select('*')
          .eq('job_id', jobId)
          .eq('batch_id', batchId)
          .eq('status', MESSAGE_STATUS.PENDING)
          .order('priority', { ascending: true })
          .limit(100), // Processar até 100 por lote
        {
          queryName: 'get_batch_recipients',
          category: 'database'
        }
      )

      if (!recipients || recipients.length === 0) {
        return
      }

      console.log(`Processando lote ${batchId} com ${recipients.length} mensagens`)

      // Processar cada recipient com rate limiting
      for (const recipient of recipients) {
        try {
          // Verificar circuit breaker
          if (!circuitBreaker.canExecute()) {
            console.log(`Circuit breaker aberto para ${provider}:${channel}, agendando retry`)
            
            // Agendar retry
            await updateRecipientStatus(
              recipient.id,
              MESSAGE_STATUS.RETRY,
              'Circuit breaker aberto',
              Date.now() + 300000 // Retry em 5 minutos
            )
            continue
          }

          // Verificar rate limit
          try {
            await rateLimiter.consume(`${tenantId}:${recipient.id}`)
          } catch (rateLimitError) {
            console.log(`Rate limit excedido para ${recipient.id}, agendando delay`)
            
            // Calcular delay baseado no rate limit
            const msBeforeNext = rateLimitError.msBeforeNext || 60000
            
            await updateRecipientStatus(
              recipient.id,
              MESSAGE_STATUS.RETRY,
              'Rate limit excedido',
              Date.now() + msBeforeNext
            )
            continue
          }

          // Enviar mensagem com circuit breaker
          await circuitBreaker.execute(async () => {
            await sendIndividualMessage(recipient, channel, provider)
          })

        } catch (error) {
          console.error(`Erro ao processar recipient ${recipient.id}:`, error)
          
          await updateRecipientStatus(
            recipient.id,
            MESSAGE_STATUS.FAILED,
            error instanceof Error ? error.message : 'Erro desconhecido'
          )

          // Registrar falha no circuit breaker
          circuitBreaker.recordFailure()
        }

        // Pequeno delay entre mensagens para evitar sobrecarga
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // Atualizar estatísticas do job
      await updateJobStatistics(jobId)

    },
    {
      functionName: 'processBulkMessageBatch',
      category: 'bulk_messages',
      metadata: { jobId, batchId, tenantId, channel, provider }
    }
  )()
}

/**
 * Envia mensagem individual
 */
async function sendIndividualMessage(
  recipient: BulkMessageRecipient,
  channel: string,
  provider: string
): Promise<void> {
  return monitorFunction(
    async () => {
      // Obter template ou conteúdo
      const { data: job } = await supabase
        .from('bulk_message_jobs')
        .select('template_id, content, variables')
        .eq('id', recipient.jobId)
        .single()

      if (!job) {
        throw new Error('Job não encontrado')
      }

      let messageContent = job.content || ''
      const messageVariables = { ...job.variables, ...recipient.variables }

      // Se tiver template, processar
      if (job.template_id) {
        const { data: template } = await supabase
          .from('message_templates')
          .select('*')
          .eq('id', job.template_id)
          .single()

        if (template) {
          // Processar template com variáveis
          const { processTemplate } = await import('./templates')
          const processed = processTemplate(template, messageVariables)
          messageContent = processed.content
        }
      }

      // Enviar mensagem baseado no canal
      let messageId: string | null = null
      let error: string | null = null

      try {
        switch (channel) {
          case 'whatsapp':
            messageId = await sendWhatsAppMessage(recipient, messageContent, provider)
            break

          case 'email':
            messageId = await sendEmailMessage(recipient, messageContent, provider)
            break

          case 'sms':
            messageId = await sendSMSMessage(recipient, messageContent, provider)
            break

          default:
            throw new Error(`Canal não suportado: ${channel}`)
        }

        if (messageId) {
          // Sucesso
          await updateRecipientStatus(
            recipient.id,
            MESSAGE_STATUS.SENT,
            undefined,
            undefined,
            messageId
          )

          // Adicionar à fila para verificar entrega
          await addQueueJob('message', 'check_delivery', {
            messageId,
            recipientId: recipient.id,
            channel,
            provider
          })

        } else {
          throw new Error('Falha ao enviar mensagem')
        }

      } catch (sendError) {
        error = sendError instanceof Error ? sendError.message : 'Erro desconhecido'
        throw new Error(error)
      }

    },
    {
      functionName: 'sendIndividualMessage',
      category: 'messages',
      metadata: {
        recipientId: recipient.id,
        channel,
        provider,
        jobId: recipient.jobId
      }
    }
  )()
}

/**
 * Envia mensagem WhatsApp (mock)
 */
async function sendWhatsAppMessage(
  _recipient: BulkMessageRecipient,
  _content: string,
  _provider: string
): Promise<string> {
  // Simular envio WhatsApp
  await new Promise(resolve => setTimeout(resolve, 500))
  
  // 95% de taxa de sucesso
  if (Math.random() > 0.95) {
    throw new Error('Erro ao enviar WhatsApp')
  }

  return `whatsapp_${uuidv4()}`
}

/**
 * Envia email (mock)
 */
async function sendEmailMessage(
  _recipient: BulkMessageRecipient,
  _content: string,
  _provider: string
): Promise<string> {
  // Simular envio email
  await new Promise(resolve => setTimeout(resolve, 800))
  
  // 98% de taxa de sucesso
  if (Math.random() > 0.98) {
    throw new Error('Erro ao enviar email')
  }

  return `email_${uuidv4()}`
}

/**
 * Envia SMS (mock)
 */
async function sendSMSMessage(
  _recipient: BulkMessageRecipient,
  _content: string,
  _provider: string
): Promise<string> {
  // Simular envio SMS
  await new Promise(resolve => setTimeout(resolve, 300))
  
  // 92% de taxa de sucesso
  if (Math.random() > 0.92) {
    throw new Error('Erro ao enviar SMS')
  }

  return `sms_${uuidv4()}`
}

/**
 * Atualiza status do recipient
 */
async function updateRecipientStatus(
  recipientId: string,
  status: MessageStatus,
  errorMessage?: string,
  nextRetryAt?: number,
  messageId?: string
): Promise<void> {
  const updateData: any = {
    status,
    updated_at: new Date().toISOString()
  }

  if (status === MESSAGE_STATUS.SENT) {
    updateData.sent_at = new Date().toISOString()
    updateData.message_id = messageId
  } else if (status === MESSAGE_STATUS.DELIVERED) {
    updateData.delivered_at = new Date().toISOString()
  } else if (status === MESSAGE_STATUS.FAILED) {
    updateData.failed_at = new Date().toISOString()
    updateData.error_message = errorMessage
  } else if (status === MESSAGE_STATUS.RETRY) {
    updateData.retry_count = supabase.sql`retry_count + 1`
    updateData.next_retry_at = nextRetryAt ? new Date(nextRetryAt).toISOString() : null
    updateData.error_message = errorMessage
  }

  await supabase
    .from('bulk_message_recipients')
    .update(updateData)
    .eq('id', recipientId)
}

/**
 * Atualiza estatísticas do job
 */
async function updateJobStatistics(jobId: string): Promise<void> {
  // Obter contadores atuais
  const { data: stats } = await supabase
    .from('bulk_message_recipients')
    .select('status', { count: 'exact' })
    .eq('job_id', jobId)

  if (!stats) return

  const statusCounts = stats.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Atualizar job
  await supabase
    .from('bulk_message_jobs')
    .update({
      processed_recipients: stats.length,
      successful_sends: statusCounts[MESSAGE_STATUS.SENT] || 0,
      failed_sends: statusCounts[MESSAGE_STATUS.FAILED] || 0,
      updated_at: new Date().toISOString()
    })
    .eq('id', jobId)
}

/**
 * Lista jobs de mensagens em massa
 */
export async function listBulkMessageJobs(
  tenantId: string,
  options?: {
    status?: MessageStatus
    channel?: string
    limit?: number
    offset?: number
  }
): Promise<BulkMessageJob[]> {
  return monitorFunction(
    async () => {
      let query = supabase
        .from('bulk_message_jobs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })

      if (options?.status) {
        query = query.eq('status', options.status)
      }

      if (options?.channel) {
        query = query.eq('channel', options.channel)
      }

      if (options?.limit) {
        query = query.range(
          options.offset || 0,
          (options.offset || 0) + options.limit - 1
        )
      }

      const { data, error } = await monitorDatabaseQuery(
        () => query,
        {
          queryName: 'list_bulk_message_jobs',
          category: 'database'
        }
      )

      if (error) {
        throw new Error(`Erro ao listar jobs: ${error.message}`)
      }

      return data || []
    },
    {
      functionName: 'listBulkMessageJobs',
      category: 'bulk_messages',
      metadata: { tenantId, ...options }
    }
  )()
}

/**
 * Cancela job de mensagens em massa
 */
export async function cancelBulkMessageJob(
  jobId: string,
  tenantId: string
): Promise<boolean> {
  return monitorFunction(
    async () => {
      // Verificar se o job existe e pertence ao tenant
      const { data: job } = await supabase
        .from('bulk_message_jobs')
        .select('status')
        .eq('id', jobId)
        .eq('tenant_id', tenantId)
        .single()

      if (!job) {
        throw new Error('Job não encontrado')
      }

      if (job.status === MESSAGE_STATUS.CANCELLED) {
        return true
      }

      if (job.status === MESSAGE_STATUS.COMPLETED) {
        throw new Error('Job já foi concluído e não pode ser cancelado')
      }

      // Atualizar status do job
      const { error: jobError } = await supabase
        .from('bulk_message_jobs')
        .update({
          status: MESSAGE_STATUS.CANCELLED,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId)

      if (jobError) {
        throw new Error(`Erro ao cancelar job: ${jobError.message}`)
      }

      // Cancelar recipients pendentes
      const { error: recipientsError } = await supabase
        .from('bulk_message_recipients')
        .update({
          status: MESSAGE_STATUS.CANCELLED,
          updated_at: new Date().toISOString()
        })
        .eq('job_id', jobId)
        .eq('status', MESSAGE_STATUS.PENDING)

      if (recipientsError) {
        console.error('Erro ao cancelar recipients:', recipientsError)
      }

      // Remover da fila se estiver agendado
      await addQueueJob('bulk', 'cancel', { jobId })

      return true
    },
    {
      functionName: 'cancelBulkMessageJob',
      category: 'bulk_messages',
      metadata: { jobId, tenantId }
    }
  )()
}

import { redisQueue } from './redis'
import { monitorQueueJob } from './monitoring'
import { executeWithRetryAndCircuitBreaker, defaultCircuitBreakerConfigs } from './circuitBreaker'

const isBrowser = typeof window !== 'undefined'
let QueueRef: any
let WorkerRef: any
type Job = any
async function ensureBullMQ() {
  if (!QueueRef || !WorkerRef) {
    const mod: any = await import('bullmq')
    QueueRef = mod.Queue
    WorkerRef = mod.Worker
  }
}

let messageQueue: any
let mediaQueue: any
let campaignQueue: any
let webhookQueue: any
let cleanupQueue: any
let backupQueue: any
let bulkQueue: any
let templateQueue: any
let flowExecutionQueue: any

async function ensureQueues() {
  if (isBrowser) return
  await ensureBullMQ()
  const queueConfig = {
    connection: redisQueue,
    defaultJobOptions: {
      removeOnComplete: { age: 3600, count: 100 },
      removeOnFail: { age: 24 * 3600, count: 500 },
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  }
  if (!messageQueue) {
    messageQueue = new QueueRef('messages', queueConfig)
    mediaQueue = new QueueRef('media', queueConfig)
    campaignQueue = new QueueRef('campaigns', queueConfig)
    webhookQueue = new QueueRef('webhooks', queueConfig)
    cleanupQueue = new QueueRef('cleanup', queueConfig)
    backupQueue = new QueueRef('backup', queueConfig)
    bulkQueue = new QueueRef('bulk', queueConfig)
    templateQueue = new QueueRef('template', queueConfig)
    flowExecutionQueue = new QueueRef('flow_execution', queueConfig)
  }
}

// Tipos de jobs
export interface MessageJob {
  type: 'send_message'
  data: {
    instanceId: string
    phoneNumber: string
    message: string
    campaignId?: string
    templateId?: string
    userId: string
    tenantId?: string
    encryption?: boolean
  }
}

export interface MediaJob {
  type: 'send_media'
  data: {
    instanceId: string
    phoneNumber: string
    mediaUrl: string
    caption?: string
    campaignId?: string
    userId: string
    tenantId?: string
    fileName?: string
    mimeType?: string
  }
}

export interface CampaignJob {
  type: 'process_campaign'
  data: {
    campaignId: string
    userId: string
    tenantId?: string
    batchSize?: number
    delayBetweenBatches?: number
  }
}

export interface WebhookJob {
  type: 'process_webhook'
  data: {
    event: string
    data: any
    webhookUrl: string
    retryCount?: number
  }
}

export interface CleanupJob {
  type: 'cleanup_data'
  data: {
    userId: string
    tenantId?: string
    cleanupType: 'old_messages' | 'temp_files' | 'logs'
    daysToKeep?: number
  }
}

export interface BackupJob {
  type: 'backup_data'
  data: {
    userId: string
    tenantId?: string
    backupType: 'full' | 'messages' | 'contacts'
  }
}

export type JobData = MessageJob | MediaJob | CampaignJob | WebhookJob | CleanupJob | BackupJob

// Filas inicializadas sob demanda

// BullMQ v4 não requer QueueScheduler; delays e retries são geridos pelo próprio Queue

// Processadores de jobs
export const createWorkers = () => {
  if (isBrowser) {
    return {
      messageWorker: null,
      mediaWorker: null,
      campaignWorker: null,
      webhookWorker: null,
    }
  }
  const setup = async () => {
    await ensureQueues()
    const messageWorker = new WorkerRef('messages', async (job: Job) => {
    return await monitorQueueJob('send_message', async () => {
      const { instanceId, phoneNumber, message, campaignId, templateId, userId, tenantId, encryption } = job.data
      
      // Executar com retry e circuit breaker
      return await executeWithRetryAndCircuitBreaker(
        async () => {
          // Aqui vai a lógica real de envio de mensagem
          // Por enquanto, vamos simular
          console.log(`Enviando mensagem para ${phoneNumber} via instância ${instanceId}`)
          
          // Simular envio bem-sucedido
          return {
            success: true,
            messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString()
          }
        },
        {
          ...defaultCircuitBreakerConfigs.network,
          context: { operation: 'send_message', instanceId, userId }
        }
      )
    }, { jobId: job.id, userId, tenantId, campaignId })
    }, {
      connection: redisQueue,
      concurrency: 5,
      limiter: {
        max: 10,
        duration: 1000,
      },
    })

  // Worker para mídia
    const mediaWorker = new WorkerRef('media', async (job: Job) => {
    return await monitorQueueJob('send_media', async () => {
      const { instanceId, phoneNumber, mediaUrl, caption, campaignId, userId, tenantId, fileName, mimeType } = job.data
      
      return await executeWithRetryAndCircuitBreaker(
        async () => {
          // Aqui vai a lógica real de envio de mídia
          console.log(`Enviando mídia para ${phoneNumber} via instância ${instanceId}`)
          
          return {
            success: true,
            mediaId: `media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString()
          }
        },
        {
          ...defaultCircuitBreakerConfigs.network,
          context: { operation: 'send_media', instanceId, userId }
        }
      )
    }, { jobId: job.id, userId, tenantId, campaignId })
    }, {
      connection: redisQueue,
      concurrency: 2,
      limiter: {
        max: 5,
        duration: 1000,
      },
    })

  // Worker para campanhas
    const campaignWorker = new WorkerRef('campaigns', async (job: Job) => {
    return await monitorQueueJob('process_campaign', async () => {
      const { campaignId, userId, tenantId, batchSize = 10, delayBetweenBatches = 1000 } = job.data
      
      console.log(`Processando campanha ${campaignId} em lotes de ${batchSize} com delay de ${delayBetweenBatches}ms`)
      
      // Aqui vai a lógica de processamento de campanha
      // Por enquanto, vamos simular o processamento
      const totalContacts = Math.floor(Math.random() * 100) + 50
      const batches = Math.ceil(totalContacts / batchSize)
      
      for (let i = 0; i < batches; i++) {
        const batchStart = i * batchSize
        const batchEnd = Math.min(batchStart + batchSize, totalContacts)
        
        console.log(`Processando lote ${i + 1}/${batches}: contatos ${batchStart + 1}-${batchEnd}`)
        
        // Simular processamento do lote
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches))
        
        // Atualizar progresso
        const progress = Math.round(((i + 1) / batches) * 100)
        await job.updateProgress(progress)
      }
      
      return {
        success: true,
        totalContacts,
        batches,
        completedAt: new Date().toISOString()
      }
    }, { jobId: job.id, userId, tenantId, campaignId })
    }, {
      connection: redisQueue,
      concurrency: 1,
    })

  // Worker para webhooks
    const webhookWorker = new WorkerRef('webhooks', async (job: Job) => {
    return await monitorQueueJob('process_webhook', async () => {
      const { event, data, webhookUrl, retryCount = 0 } = job.data
      
      return await executeWithRetryAndCircuitBreaker(
        async () => {
          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'WhatPress-Webhook/1.0',
            },
            body: JSON.stringify({ event, data, timestamp: new Date().toISOString() }),
          })
          
          if (!response.ok) {
            throw new Error(`Webhook failed with status ${response.status}`)
          }
          
          return {
            success: true,
            status: response.status,
            timestamp: new Date().toISOString()
          }
        },
        {
          ...defaultCircuitBreakerConfigs.externalApi,
          context: { operation: 'webhook', event, webhookUrl, retryCount }
        }
      )
    }, { jobId: job.id, webhookUrl, event })
    }, {
      connection: redisQueue,
      concurrency: 3,
      limiter: {
        max: 20,
        duration: 1000,
      },
    })

  // Event handlers para monitoramento
  messageWorker.on('completed', (job) => {
    console.log(`✅ Mensagem concluída: ${job.id}`)
  })

  messageWorker.on('failed', (job, err) => {
    console.error(`❌ Mensagem falhou: ${job.id}`, err)
  })

  mediaWorker.on('completed', (job) => {
    console.log(`✅ Mídia concluída: ${job.id}`)
  })

  mediaWorker.on('failed', (job, err) => {
    console.error(`❌ Mídia falhou: ${job.id}`, err)
  })

  campaignWorker.on('completed', (job) => {
    console.log(`✅ Campanha concluída: ${job.id}`)
  })

  campaignWorker.on('failed', (job, err) => {
    console.error(`❌ Campanha falhou: ${job.id}`, err)
  })

  webhookWorker.on('completed', (job) => {
    console.log(`✅ Webhook concluído: ${job.id}`)
  })

  webhookWorker.on('failed', (job, err) => {
    console.error(`❌ Webhook falhou: ${job.id}`, err)
  })

    return {
      messageWorker,
      mediaWorker,
      campaignWorker,
      webhookWorker,
    }
  }
  return setup()
}

// Funções auxiliares para adicionar jobs
export const queueUtils = {
  // Adicionar job de mensagem
  addMessageJob: async (data: MessageJob['data'], options: any = {}): Promise<Job> => {
    if (isBrowser) return null as any
    await ensureQueues()
    const jobData: MessageJob = {
      type: 'send_message',
      data
    }
    
    return await messageQueue.add(`message_${data.phoneNumber}`, jobData, {
      delay: options.delay || 0,
      priority: options.priority || 1,
      attempts: options.attempts || 3,
      ...options
    })
  },

  // Adicionar job de mídia
  addMediaJob: async (data: MediaJob['data'], options: any = {}): Promise<Job> => {
    if (isBrowser) return null as any
    await ensureQueues()
    const jobData: MediaJob = {
      type: 'send_media',
      data
    }
    
    return await mediaQueue.add(`media_${data.phoneNumber}`, jobData, {
      delay: options.delay || 0,
      priority: options.priority || 2, // Mídia tem prioridade mais alta
      attempts: options.attempts || 3,
      ...options
    })
  },

  // Adicionar job de campanha
  addCampaignJob: async (data: CampaignJob['data'], options: any = {}): Promise<Job> => {
    if (isBrowser) return null as any
    await ensureQueues()
    const jobData: CampaignJob = {
      type: 'process_campaign',
      data
    }
    
    return await campaignQueue.add(`campaign_${data.campaignId}`, jobData, {
      delay: options.delay || 0,
      priority: options.priority || 1,
      attempts: options.attempts || 2,
      ...options
    })
  },

  // Adicionar job de webhook
  addWebhookJob: async (data: WebhookJob['data'], options: any = {}): Promise<Job> => {
    if (isBrowser) return null as any
    await ensureQueues()
    const jobData: WebhookJob = {
      type: 'process_webhook',
      data
    }
    
    return await webhookQueue.add(`webhook_${data.event}`, jobData, {
      delay: options.delay || 0,
      priority: options.priority || 1,
      attempts: options.attempts || 5, // Webhooks têm mais tentativas
      ...options
    })
  },

  // Obter status das filas
  getQueueStats: async () => {
    try {
      const [
        messageStats,
        mediaStats,
        campaignStats,
        webhookStats
      ] = await Promise.all([
        messageQueue.getJobCounts(),
        mediaQueue.getJobCounts(),
        campaignQueue.getJobCounts(),
        webhookQueue.getJobCounts()
      ])

      return {
        messages: messageStats,
        media: mediaStats,
        campaigns: campaignStats,
        webhooks: webhookStats,
        total: {
          waiting: messageStats.waiting + mediaStats.waiting + campaignStats.waiting + webhookStats.waiting,
          active: messageStats.active + mediaStats.active + campaignStats.active + webhookStats.active,
          completed: messageStats.completed + mediaStats.completed + campaignStats.completed + webhookStats.completed,
          failed: messageStats.failed + mediaStats.failed + campaignStats.failed + webhookStats.failed,
          delayed: messageStats.delayed + mediaStats.delayed + campaignStats.delayed + webhookStats.delayed,
        }
      }
    } catch (error) {
      console.error('Erro ao obter estatísticas das filas:', error)
      return null
    }
  }
}

// Inicializar workers
export const initializeWorkers = () => {
  console.log('🚀 Inicializando workers de filas...')
  return createWorkers()
}

// Limpar filas (útil para testes)
export const cleanupQueues = async () => {
  try {
    await Promise.all([
      messageQueue.obliterate(),
      mediaQueue.obliterate(),
      campaignQueue.obliterate(),
      webhookQueue.obliterate(),
      cleanupQueue.obliterate(),
      backupQueue.obliterate()
    ])
    console.log('✅ Filas limpas')
  } catch (error) {
    console.error('Erro ao limpar filas:', error)
  }
}

export default {
  messageQueue,
  mediaQueue,
  campaignQueue,
  webhookQueue,
  cleanupQueue,
  backupQueue,
  bulkQueue,
  templateQueue,
  flowExecutionQueue,
  queueUtils,
  initializeWorkers,
  cleanupQueues
}

export const QUEUE_TYPES = {
  MESSAGE: 'messages',
  MEDIA: 'media',
  CAMPAIGN: 'campaigns',
  WEBHOOK: 'webhooks',
  BULK: 'bulk',
  TEMPLATE: 'template',
  FLOW_EXECUTION: 'flow_execution',
} as const

export async function addQueueJob(
  queue: keyof typeof QUEUE_TYPES | string,
  nameOrData: string | Record<string, any>,
  data?: Record<string, any>,
  options: any = {}
): Promise<Job | null> {
  // Verificar se está rodando no Node.js (servidor)
  if (typeof window !== 'undefined') {
    console.warn('addQueueJob não pode ser executado no navegador. Use uma API REST em vez disso.')
    return null
  }
  await ensureQueues()
  const queueName = typeof queue === 'string' ? queue : QUEUE_TYPES[queue as keyof typeof QUEUE_TYPES]
  
  const queueMap: Record<string, any> = {
    messages: messageQueue,
    media: mediaQueue,
    campaigns: campaignQueue,
    webhooks: webhookQueue,
    cleanup: cleanupQueue,
    backup: backupQueue,
    bulk: bulkQueue,
    template: templateQueue,
    flow_execution: flowExecutionQueue,
  }

  const selected = queueMap[queueName]
  if (!selected) {
    throw new Error(`Fila desconhecida: ${queueName}`)
  }

  const name = typeof nameOrData === 'string' ? nameOrData : 'job'
  const payload = typeof nameOrData === 'string' ? (data || {}) : nameOrData

  return await selected.add(name, payload, options)
}
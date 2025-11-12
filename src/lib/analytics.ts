import { supabase } from './supabase'
import { monitorFunction } from './monitoring'
import { v4 as uuidv4 } from 'uuid'

// Tipos de eventos
export const ANALYTICS_EVENTS = {
  // Autenticação
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  USER_REGISTER: 'user_register',
  
  // Campanhas
  CAMPAIGN_CREATED: 'campaign_created',
  CAMPAIGN_SENT: 'campaign_sent',
  CAMPAIGN_PAUSED: 'campaign_paused',
  CAMPAIGN_RESUMED: 'campaign_resumed',
  CAMPAIGN_DELETED: 'campaign_deleted',
  
  // Mensagens
  MESSAGE_SENT: 'message_sent',
  MESSAGE_DELIVERED: 'message_delivered',
  MESSAGE_FAILED: 'message_failed',
  MESSAGE_OPENED: 'message_opened',
  MESSAGE_CLICKED: 'message_clicked',
  MESSAGE_REPLIED: 'message_replied',
  
  // Contatos
  CONTACT_CREATED: 'contact_created',
  CONTACT_UPDATED: 'contact_updated',
  CONTACT_DELETED: 'contact_deleted',
  CONTACT_TAG_ADDED: 'contact_tag_added',
  CONTACT_TAG_REMOVED: 'contact_tag_removed',
  CONTACT_SEGMENT_ADDED: 'contact_segment_added',
  
  // Fluxos
  FLOW_CREATED: 'flow_created',
  FLOW_STARTED: 'flow_started',
  FLOW_COMPLETED: 'flow_completed',
  FLOW_PAUSED: 'flow_paused',
  FLOW_RESUMED: 'flow_resumed',
  FLOW_NODE_EXECUTED: 'flow_node_executed',
  FLOW_ERROR: 'flow_error',
  
  // Mídia
  MEDIA_UPLOADED: 'media_uploaded',
  MEDIA_DELETED: 'media_deleted',
  MEDIA_DOWNLOADED: 'media_downloaded',
  
  // Templates
  TEMPLATE_CREATED: 'template_created',
  TEMPLATE_USED: 'template_used',
  TEMPLATE_UPDATED: 'template_updated',
  TEMPLATE_DELETED: 'template_deleted',
  
  // Integrações
  INTEGRATION_CONNECTED: 'integration_connected',
  INTEGRATION_DISCONNECTED: 'integration_disconnected',
  INTEGRATION_ERROR: 'integration_error',
  
  // Sistema
  PAGE_VIEWED: 'page_viewed',
  FEATURE_USED: 'feature_used',
  ERROR_OCCURRED: 'error_occurred',
  SETTINGS_UPDATED: 'settings_updated',
  
  // Financeiro
  SUBSCRIPTION_CREATED: 'subscription_created',
  SUBSCRIPTION_UPDATED: 'subscription_updated',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',
  PAYMENT_SUCCEEDED: 'payment_succeeded',
  PAYMENT_FAILED: 'payment_failed',
  PLAN_UPGRADED: 'plan_upgraded',
  PLAN_DOWNGRADED: 'plan_downgraded'
} as const

export type AnalyticsEvent = typeof ANALYTICS_EVENTS[keyof typeof ANALYTICS_EVENTS]

// Interfaces
export interface AnalyticsEventData {
  event: AnalyticsEvent
  userId?: string
  tenantId?: string
  sessionId?: string
  timestamp?: Date
  properties?: Record<string, any>
  context?: {
    ip?: string
    userAgent?: string
    referrer?: string
    page?: string
    device?: string
    os?: string
    browser?: string
    country?: string
    region?: string
    city?: string
  }
}

export interface AnalyticsUser {
  id: string
  tenantId: string
  email: string
  name?: string
  phone?: string
  createdAt: Date
  lastSeenAt: Date
  properties?: Record<string, any>
  segments?: string[]
}

export interface AnalyticsSession {
  id: string
  userId: string
  tenantId: string
  startedAt: Date
  lastActivityAt: Date
  duration?: number
  pageViews: number
  events: number
  properties?: Record<string, any>
}

// Classe principal de Analytics
export class AnalyticsService {
  private sessionId: string | null = null
  private userId: string | null = null
  private tenantId: string | null = null
  private enabled: boolean = String((import.meta as any).env?.VITE_ANALYTICS_ENABLED || '').toLowerCase() !== 'false'

  constructor() {
    this.initializeSession()
    if (typeof window !== 'undefined') {
      try {
        window.addEventListener('tenant:changed', (e: Event) => {
          try {
            const id = (e as CustomEvent<string>).detail
            this.tenantId = id
          } catch {}
        })
      } catch {}
    }
  }

  private initializeSession() {
    this.sessionId = uuidv4()
    
    // Recuperar IDs do localStorage/Supabase
    if (typeof window !== 'undefined') {
      this.userId = localStorage.getItem('userId')
      this.tenantId = localStorage.getItem('selected_tenant_id') || localStorage.getItem('tenantId')
    }
  }

  // Rastrear evento
  async track(event: AnalyticsEvent, properties: Record<string, any> = {}): Promise<void> {
    return monitorFunction('analytics.track', async () => {
      try {
        if (!this.enabled) return
        const eventData: AnalyticsEventData = {
          event,
          userId: this.userId || undefined,
          tenantId: this.tenantId || undefined,
          sessionId: this.sessionId || undefined,
          timestamp: new Date(),
          properties,
          context: await this.getContext()
        }

        // Salvar no Supabase
        await this.saveEvent(eventData)

        // Enviar para WebSocket se disponível
        this.sendToWebSocket(eventData)

        // Salvar no localStorage para cache offline
        this.saveToCache(eventData)

      } catch (error) {
        console.error('Erro ao rastrear evento:', error)
        // Não lançar erro para não quebrar a aplicação
      }
    })
  }

  // Rastrear múltiplos eventos em lote
  async trackBatch(events: Array<{ event: AnalyticsEvent; properties?: Record<string, any> }>): Promise<void> {
    return monitorFunction('analytics.trackBatch', async () => {
      try {
        if (!this.enabled) return
        const eventDataArray = events.map(({ event, properties = {} }) => ({
          event,
          userId: this.userId || undefined,
          tenantId: this.tenantId || undefined,
          sessionId: this.sessionId || undefined,
          timestamp: new Date(),
          properties,
          context: undefined // Será adicionado depois
        }))

        // Adicionar contexto a todos os eventos
        const context = await this.getContext()
        eventDataArray.forEach(eventData => {
          eventData.context = context
        })

        // Salvar em lote no Supabase
        await this.saveEventsBatch(eventDataArray)

        // Enviar para WebSocket
        eventDataArray.forEach(eventData => {
          this.sendToWebSocket(eventData)
          this.saveToCache(eventData)
        })

      } catch (error) {
        console.error('Erro ao rastrear eventos em lote:', error)
      }
    })
  }

  // Identificar usuário
  identify(userId: string, properties: Record<string, any> = {}): void {
    this.userId = userId
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('userId', userId)
    }

    // Rastrear evento de identificação
    this.track('USER_IDENTIFIED', properties)
  }

  // Definir tenant
  setTenant(tenantId: string): void {
    this.tenantId = tenantId
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('selected_tenant_id', tenantId)
      localStorage.setItem('tenantId', tenantId)
      try {
        window.dispatchEvent(new CustomEvent('tenant:changed', { detail: tenantId }))
      } catch {}
    }
  }

  // Rastrear visualização de página
  page(pageName: string, properties: Record<string, any> = {}): void {
    this.track(ANALYTICS_EVENTS.PAGE_VIEWED, {
      page: pageName,
      ...properties
    })
  }

  // Obter contexto do dispositivo
  private async getContext(): Promise<AnalyticsEventData['context']> {
    if (typeof window === 'undefined') {
      return {}
    }

    const context: AnalyticsEventData['context'] = {
      page: window.location.href,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      device: this.getDeviceType(),
      os: this.getOS(),
      browser: this.getBrowser()
    }

    // Obter localização via IP (se disponível)
    try {
      const location = await this.getLocation()
      context.country = location.country
      context.region = location.region
      context.city = location.city
      context.ip = location.ip
    } catch (error) {
      // Silenciosamente falhar - não é crítico
    }

    return context
  }

  // Obter tipo de dispositivo
  private getDeviceType(): string {
    const userAgent = navigator.userAgent.toLowerCase()
    
    if (/mobile|android|iphone|ipad/.test(userAgent)) {
      return 'mobile'
    } else if (/tablet|ipad/.test(userAgent)) {
      return 'tablet'
    } else {
      return 'desktop'
    }
  }

  // Obter sistema operacional
  private getOS(): string {
    const userAgent = navigator.userAgent.toLowerCase()
    
    if (/windows/.test(userAgent)) return 'Windows'
    if (/macintosh|mac os/.test(userAgent)) return 'macOS'
    if (/linux/.test(userAgent)) return 'Linux'
    if (/android/.test(userAgent)) return 'Android'
    if (/iphone|ipad/.test(userAgent)) return 'iOS'
    
    return 'Unknown'
  }

  // Obter navegador
  private getBrowser(): string {
    const userAgent = navigator.userAgent.toLowerCase()
    
    if (/chrome/.test(userAgent) && !/edg/.test(userAgent)) return 'Chrome'
    if (/safari/.test(userAgent) && !/chrome/.test(userAgent)) return 'Safari'
    if (/firefox/.test(userAgent)) return 'Firefox'
    if (/edg/.test(userAgent)) return 'Edge'
    if (/opera/.test(userAgent)) return 'Opera'
    
    return 'Unknown'
  }

  // Obter localização aproximada
  private async getLocation(): Promise<{ country?: string; region?: string; city?: string; ip?: string }> {
    try {
      const response = await fetch('https://ipapi.co/json/')
      const data = await response.json()
      
      return {
        country: data.country_name,
        region: data.region,
        city: data.city,
        ip: data.ip
      }
    } catch (error) {
      return {}
    }
  }

  // Salvar evento no Supabase
  private async saveEvent(eventData: AnalyticsEventData): Promise<void> {
    const { error } = await supabase
      .from('analytics_events')
      .insert({
        event: eventData.event,
        user_id: eventData.userId,
        tenant_id: eventData.tenantId,
        session_id: eventData.sessionId,
        timestamp: eventData.timestamp,
        properties: eventData.properties,
        context: eventData.context
      })

    if (error) {
      throw new Error(`Erro ao salvar evento: ${error.message}`)
    }
  }

  // Salvar múltiplos eventos no Supabase
  private async saveEventsBatch(eventDataArray: AnalyticsEventData[]): Promise<void> {
    const events = eventDataArray.map(eventData => ({
      event: eventData.event,
      user_id: eventData.userId,
      tenant_id: eventData.tenantId,
      session_id: eventData.sessionId,
      timestamp: eventData.timestamp,
      properties: eventData.properties,
      context: eventData.context
    }))

    const { error } = await supabase
      .from('analytics_events')
      .insert(events)

    if (error) {
      throw new Error(`Erro ao salvar eventos em lote: ${error.message}`)
    }
  }

  // Enviar para WebSocket
  private sendToWebSocket(eventData: AnalyticsEventData): void {
    // Implementar WebSocket para métricas em tempo real
    // Por enquanto, apenas armazenar no localStorage para ser processado depois
  }

  // Salvar no cache local
  private saveToCache(eventData: AnalyticsEventData): void {
    if (typeof window === 'undefined') return

    try {
      const cacheKey = `analytics_cache_${Date.now()}`
      const cacheData = {
        ...eventData,
        timestamp: eventData.timestamp?.toISOString()
      }
      
      localStorage.setItem(cacheKey, JSON.stringify(cacheData))
      
      // Limpar cache antigo (mais de 24 horas)
      this.cleanupCache()
    } catch (error) {
      console.warn('Erro ao salvar no cache:', error)
    }
  }

  // Limpar cache antigo
  private cleanupCache(): void {
    if (typeof window === 'undefined') return

    const now = Date.now()
    const maxAge = 24 * 60 * 60 * 1000 // 24 horas

    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('analytics_cache_')) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}')
          const timestamp = new Date(data.timestamp).getTime()
          
          if (now - timestamp > maxAge) {
            localStorage.removeItem(key)
          }
        } catch (error) {
          localStorage.removeItem(key)
        }
      }
    })
  }

  // Obter estatísticas de uso
  async getUsageStats(tenantId?: string, userId?: string, timeRange?: { start: Date; end: Date }): Promise<{
    totalEvents: number
    uniqueUsers: number
    topEvents: Array<{ event: string; count: number }>
    eventsByDay: Array<{ date: string; count: number }>
  }> {
    return monitorFunction('analytics.getUsageStats', async () => {
      try {
        let query = supabase
          .from('analytics_events')
          .select('*', { count: 'exact' })

        if (tenantId) {
          query = query.eq('tenant_id', tenantId)
        }

        if (userId) {
          query = query.eq('user_id', userId)
        }

        if (timeRange) {
          query = query
            .gte('timestamp', timeRange.start.toISOString())
            .lte('timestamp', timeRange.end.toISOString())
        }

        const { data, count, error } = await query

        if (error) {
          throw new Error(`Erro ao obter estatísticas: ${error.message}`)
        }

        // Processar dados
        const totalEvents = count || 0
        const uniqueUsers = new Set(data?.map(event => event.user_id).filter(Boolean)).size
        
        // Top eventos
        const eventCounts = data?.reduce((acc, event) => {
          acc[event.event] = (acc[event.event] || 0) + 1
          return acc
        }, {} as Record<string, number>) || {}

        const topEvents = Object.entries(eventCounts)
          .map(([event, count]) => ({ event, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)

        // Eventos por dia
        const eventsByDay = data?.reduce((acc, event) => {
          const date = new Date(event.timestamp).toISOString().split('T')[0]
          acc[date] = (acc[date] || 0) + 1
          return acc
        }, {} as Record<string, number>) || {}

        const eventsByDayArray = Object.entries(eventsByDay)
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date))

        return {
          totalEvents,
          uniqueUsers,
          topEvents,
          eventsByDay: eventsByDayArray
        }

      } catch (error) {
        console.error('Erro ao obter estatísticas de uso:', error)
        throw error
      }
    })
  }

  // Sincronizar cache offline
  async syncOfflineCache(): Promise<void> {
    return monitorFunction('analytics.syncOfflineCache', async () => {
      if (typeof window === 'undefined') return

      try {
        const cachedEvents: AnalyticsEventData[] = []
        
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('analytics_cache_')) {
            try {
              const data = JSON.parse(localStorage.getItem(key) || '{}')
              if (data.event && data.timestamp) {
                cachedEvents.push({
                  ...data,
                  timestamp: new Date(data.timestamp)
                })
                localStorage.removeItem(key)
              }
            } catch (error) {
              localStorage.removeItem(key)
            }
          }
        })

        if (cachedEvents.length > 0) {
          await this.saveEventsBatch(cachedEvents)
          console.log(`Sincronizados ${cachedEvents.length} eventos do cache offline`)
        }

      } catch (error) {
        console.error('Erro ao sincronizar cache offline:', error)
      }
    })
  }
}

// Instância global
export const analytics = new AnalyticsService()

// Helper functions
export const trackEvent = (event: AnalyticsEvent, properties?: Record<string, any>) => {
  return analytics.track(event, properties)
}

export const trackPage = (pageName: string, properties?: Record<string, any>) => {
  return analytics.page(pageName, properties)
}

export const identifyUser = (userId: string, properties?: Record<string, any>) => {
  analytics.identify(userId, properties)
}

export const setTenant = (tenantId: string) => {
  analytics.setTenant(tenantId)
}

// Auto-tracking de eventos comuns
export const setupAutoTracking = () => {
  if (typeof window === 'undefined') return

  // Track page views
  const originalPushState = history.pushState
  history.pushState = function (...args) {
    originalPushState.apply(this, args)
    trackPage(window.location.pathname)
  }

  window.addEventListener('popstate', () => {
    trackPage(window.location.pathname)
  })

  // Track clicks em elementos importantes
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement
    
    // Botões com data-analytics
    if (target.dataset.analytics) {
      trackEvent(target.dataset.analytics as AnalyticsEvent, {
        element: target.tagName,
        text: target.textContent?.trim(),
        id: target.id,
        className: target.className
      })
    }

    // Links
    if (target.tagName === 'A') {
      const link = target as HTMLAnchorElement
      trackEvent(ANALYTICS_EVENTS.PAGE_VIEWED, {
        href: link.href,
        text: link.textContent?.trim(),
        target: link.target
      })
    }
  })

  // Track formulários
  document.addEventListener('submit', (event) => {
    const form = event.target as HTMLFormElement
    
    trackEvent(ANALYTICS_EVENTS.FEATURE_USED, {
      feature: 'form_submit',
      formId: form.id,
      formAction: form.action,
      formMethod: form.method
    })
  })

  // Track erros
  window.addEventListener('error', (event) => {
    trackEvent(ANALYTICS_EVENTS.ERROR_OCCURRED, {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error?.toString()
    })
  })

  // Track tempo na página
  let pageStartTime = Date.now()
  
  window.addEventListener('beforeunload', () => {
    const timeOnPage = Date.now() - pageStartTime
    
    trackEvent(ANALYTICS_EVENTS.PAGE_VIEWED, {
      page: window.location.pathname,
      timeOnPage,
      event: 'page_exit'
    })
  })

  // Sincronizar cache offline periodicamente
  setInterval(() => {
    analytics.syncOfflineCache()
  }, 5 * 60 * 1000) // A cada 5 minutos
}

// Inicializar auto-tracking quando o módulo for importado
setupAutoTracking()

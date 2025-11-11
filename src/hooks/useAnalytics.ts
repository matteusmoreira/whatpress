import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { monitorFunction } from '@/lib/monitoring'
import { useAuth } from './useAuth'
import { useTenant } from './useTenant'
import { analytics, AnalyticsEvent, ANALYTICS_EVENTS } from '@/lib/analytics'
import { getPredictiveAnalyticsService, PredictionResult } from '@/lib/predictiveAnalytics'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

// Interfaces para métricas
export interface MetricData {
  label: string
  value: number
  change?: number
  trend?: 'up' | 'down' | 'stable'
  color?: string
  icon?: string
}

export interface TimeSeriesData {
  date: string
  value: number
  [key: string]: any
}

export interface CampaignMetrics {
  totalSent: number
  delivered: number
  opened: number
  clicked: number
  replied: number
  failed: number
  conversionRate: number
  engagementRate: number
  costPerMessage: number
  roi: number
}

export interface ContactMetrics {
  totalContacts: number
  activeContacts: number
  newContacts: number
  unsubscribed: number
  segments: Array<{ name: string; count: number }>
  growthRate: number
}

export interface FlowMetrics {
  totalFlows: number
  activeFlows: number
  totalExecutions: number
  successfulExecutions: number
  failedExecutions: number
  averageExecutionTime: number
  topFlows: Array<{ name: string; executions: number; successRate: number }>
}

export interface RevenueMetrics {
  totalRevenue: number
  monthlyRecurringRevenue: number
  newRevenue: number
  churnedRevenue: number
  averageRevenuePerUser: number
  customerLifetimeValue: number
  revenueGrowth: number
}

export interface EngagementMetrics {
  openRate: number
  clickRate: number
  replyRate: number
  unsubscribeRate: number
  bounceRate: number
  spamRate: number
  engagementScore: number
}

export interface ChannelMetrics {
  whatsapp: {
    sent: number
    delivered: number
    read: number
    replied: number
    failed: number
  }
  email: {
    sent: number
    delivered: number
    opened: number
    clicked: number
    bounced: number
    complained: number
  }
  sms: {
    sent: number
    delivered: number
    failed: number
  }
}

// Hook principal para analytics
export function useAnalytics() {
  const { user } = useAuth()
  const { tenant } = useTenant()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Identificar usuário automaticamente
  useEffect(() => {
    if (user?.id) {
      analytics.identify(user.id, {
        email: user.email,
        name: user.name,
        tenantId: tenant?.id
      })
    }

    if (tenant?.id) {
      analytics.setTenant(tenant.id)
    }
  }, [user, tenant])

  // Rastrear evento
  const track = useCallback(async (event: AnalyticsEvent, properties: Record<string, any> = {}) => {
    try {
      await analytics.track(event, properties)
    } catch (error) {
      console.error('Erro ao rastrear evento:', error)
      // Silenciosamente falhar - não quebrar a aplicação
    }
  }, [])

  // Rastrear página
  const trackPage = useCallback(async (pageName: string, properties: Record<string, any> = {}) => {
    try {
      await analytics.page(pageName, properties)
    } catch (error) {
      console.error('Erro ao rastrear página:', error)
    }
  }, [])

  // Obter métricas de campanhas
  const getCampaignMetrics = useCallback(async (
    dateRange?: { start: Date; end: Date },
    campaignIds?: string[]
  ): Promise<CampaignMetrics> => {
    return monitorFunction('analytics.getCampaignMetrics', async () => {
      setIsLoading(true)
      setError(null)

      try {
        let query = supabase
          .from('campaigns')
          .select(`
            *,
            messages!inner(
              status,
              delivered_at,
              opened_at,
              clicked_at,
              replied_at,
              failed_at,
              error
            )
          `)
          .eq('tenant_id', tenant?.id)

        if (dateRange) {
          query = query
            .gte('created_at', dateRange.start.toISOString())
            .lte('created_at', dateRange.end.toISOString())
        }

        if (campaignIds && campaignIds.length > 0) {
          query = query.in('id', campaignIds)
        }

        const { data, error } = await query

        if (error) throw error

        // Calcular métricas
        const totalSent = data?.length || 0
        const messages = data?.flatMap(campaign => campaign.messages) || []
        
        const delivered = messages.filter(msg => msg.delivered_at).length
        const opened = messages.filter(msg => msg.opened_at).length
        const clicked = messages.filter(msg => msg.clicked_at).length
        const replied = messages.filter(msg => msg.replied_at).length
        const failed = messages.filter(msg => msg.failed_at).length

        const conversionRate = totalSent > 0 ? (clicked / totalSent) * 100 : 0
        const engagementRate = totalSent > 0 ? ((opened + clicked + replied) / totalSent) * 100 : 0

        return {
          totalSent,
          delivered,
          opened,
          clicked,
          replied,
          failed,
          conversionRate,
          engagementRate,
          costPerMessage: 0.05, // Mock - integrar com sistema de cobrança
          roi: conversionRate * 10 // Mock - calcular ROI real
        }

      } catch (error) {
        setError(error instanceof Error ? error.message : 'Erro ao obter métricas de campanhas')
        throw error
      } finally {
        setIsLoading(false)
      }
    })
  }, [tenant?.id])

  // Helper para obter número da semana
  const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  }

  // Serviços preditivos
  const getPredictiveService = useCallback(() => {
    return getPredictiveAnalyticsService(analytics)
  }, [])

  const predictEngagement = useCallback(async (campaignData: any): Promise<PredictionResult> => {
    return monitorFunction('analytics.predictEngagement', async () => {
      const service = getPredictiveService()
      return await service.predictEngagement(campaignData)
    })
  }, [getPredictiveService])

  const predictChurn = useCallback(async (userData: any): Promise<PredictionResult> => {
    return monitorFunction('analytics.predictChurn', async () => {
      const service = getPredictiveService()
      return await service.predictChurn(userData)
    })
  }, [getPredictiveService])

  const predictConversion = useCallback(async (campaignData: any): Promise<PredictionResult> => {
    return monitorFunction('analytics.predictConversion', async () => {
      const service = getPredictiveService()
      return await service.predictConversion(campaignData)
    })
  }, [getPredictiveService])

  const findOptimalSendTime = useCallback(async (audienceData: any): Promise<PredictionResult> => {
    return monitorFunction('analytics.findOptimalSendTime', async () => {
      const service = getPredictiveService()
      return await service.findOptimalSendTime(audienceData)
    })
  }, [getPredictiveService])

  const intelligentSegmentation = useCallback(async (users: any[]): Promise<any[]> => {
    return monitorFunction('analytics.intelligentSegmentation', async () => {
      const service = getPredictiveService()
      return await service.intelligentSegmentation(users)
    })
  }, [getPredictiveService])

  const analyzeSentiment = useCallback(async (messages: string[]): Promise<any> => {
    return monitorFunction('analytics.analyzeSentiment', async () => {
      const service = getPredictiveService()
      return await service.analyzeSentiment(messages)
    })
  }, [getPredictiveService])

  // Funções de exportação
  const exportToExcel = useCallback(async (data: any[], filename: string) => {
    try {
      const ws = XLSX.utils.json_to_sheet(data)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Dados')
      XLSX.writeFile(wb, `${filename}.xlsx`)
      toast.success('Exportado para Excel com sucesso')
    } catch (error) {
      toast.error('Erro ao exportar para Excel')
      console.error('Erro ao exportar Excel:', error)
    }
  }, [])

  const exportToCSV = useCallback(async (data: any[], filename: string) => {
    try {
      const ws = XLSX.utils.json_to_sheet(data)
      const csv = XLSX.utils.sheet_to_csv(ws)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `${filename}.csv`
      link.click()
      toast.success('Exportado para CSV com sucesso')
    } catch (error) {
      toast.error('Erro ao exportar para CSV')
      console.error('Erro ao exportar CSV:', error)
    }
  }, [])

  const exportToPDF = useCallback(async (data: any[], headers: string[], filename: string, title?: string) => {
    try {
      const doc = new jsPDF()
      
      if (title) {
        doc.setFontSize(16)
        doc.text(title, 14, 15)
      }
      
      // @ts-ignore
      doc.autoTable({
        head: [headers],
        body: data.map(item => headers.map(header => item[header] || '')),
        startY: title ? 25 : 20,
        theme: 'grid',
        styles: { fontSize: 8 }
      })
      
      doc.save(`${filename}.pdf`)
      toast.success('Exportado para PDF com sucesso')
    } catch (error) {
      toast.error('Erro ao exportar para PDF')
      console.error('Erro ao exportar PDF:', error)
    }
  }, [])

  // WebSocket para métricas em tempo real
  const subscribeToRealTimeMetrics = useCallback((callback: (data: any) => void) => {
    if (!tenant?.id) return

    const channel = supabase
      .channel(`analytics:${tenant.id}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'analytics_events' },
        (payload) => {
          callback(payload.new)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tenant?.id])

  // Alertas automáticos
  const setupMetricAlerts = useCallback((alerts: Array<{
    metric: string
    threshold: number
    operator: 'greater' | 'less' | 'equals'
    message: string
  }>) => {
    // Implementar sistema de alertas
    alerts.forEach(alert => {
      console.log(`Alerta configurado: ${alert.metric} ${alert.operator} ${alert.threshold}`)
    })
  }, [])

  return {
    // Métodos
    track,
    trackPage,
    getCampaignMetrics,
    // Serviços preditivos
    getPredictiveService,
    predictEngagement,
    predictChurn,
    predictConversion,
    findOptimalSendTime,
    intelligentSegmentation,
    analyzeSentiment,
    // Exportação
    exportToExcel,
    exportToCSV,
    exportToPDF,
    // Real-time e alertas
    subscribeToRealTimeMetrics,
    setupMetricAlerts,
    
    // Constantes
    ANALYTICS_EVENTS,
    
    // Estado
    isLoading,
    error
  }
}
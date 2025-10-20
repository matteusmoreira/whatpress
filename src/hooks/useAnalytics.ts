import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'
import { useTenant } from '@/hooks/useTenant'

export interface AnalyticsMetrics {
  totalMessages: number
  messagesChange: number
  deliveryRate: number
  deliveryRateChange: number
  responseRate: number
  responseRateChange: number
  activeContacts: number
  activeContactsChange: number
}

export interface MessageVolumeData {
  date: string
  sent: number
  received: number
}

export interface CampaignPerformanceData {
  name: string
  sent: number
  delivered: number
  opened: number
  clicked: number
  status: 'active' | 'paused' | 'completed'
}

export interface AudienceSegmentData {
  device: Array<{ name: string; value: number }>
  location: Array<{ name: string; value: number }>
}

export interface ResponseTimeData {
  date: string
  averageTime: number
}

export interface RealTimeMetrics {
  messagesLastHour: number
  activeChats: number
  responseTime: string
  onlineAgents: number
}

export interface AnalyticsFilters {
  period: '7d' | '30d' | '90d' | 'custom'
  startDate?: Date
  endDate?: Date
}

export interface ExportOptions {
  format: 'pdf' | 'excel' | 'csv'
  includeCharts: boolean
  includeRawData: boolean
  dateRange: {
    start: Date
    end: Date
  }
}

export function useAnalytics() {
  const { user } = useAuth()
  const { currentTenant } = useTenant()
  const tenantId = currentTenant?.id
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null)
  const [messageVolumeData, setMessageVolumeData] = useState<MessageVolumeData[]>([])
  const [campaignPerformanceData, setCampaignPerformanceData] = useState<CampaignPerformanceData[]>([])
  const [audienceSegmentData, setAudienceSegmentData] = useState<AudienceSegmentData | null>(null)
  const [responseTimeData, setResponseTimeData] = useState<ResponseTimeData[]>([])
  const [filters, setFilters] = useState<AnalyticsFilters>({
    period: '30d'
  })
  const [loading, setLoading] = useState(false)

  // Calculate date range based on period
  const getDateRange = useCallback(() => {
    const end = new Date()
    let start: Date

    switch (filters.period) {
      case '7d':
        start = subDays(end, 7)
        break
      case '30d':
        start = subDays(end, 30)
        break
      case '90d':
        start = subDays(end, 90)
        break
      case 'custom':
        start = filters.startDate || subDays(end, 30)
        break
      default:
        start = subDays(end, 30)
    }

    return { start: startOfDay(start), end: endOfDay(end) }
  }, [filters])

  // Fetch analytics metrics
  const fetchMetrics = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)
      const { start, end } = getDateRange()

      // Fetch current period metrics
      const msgsQuery = supabase
        .from('messages')
        .select('*')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())

      const currentMessagesRes = tenantId
        ? await msgsQuery.eq('tenant_id', tenantId)
        : await msgsQuery.eq('user_id', user.id)
      const { data: currentMessages } = currentMessagesRes

      const contactsQuery = supabase
        .from('contacts')
        .select('*')
        .gte('last_interaction', start.toISOString())

      const currentContactsRes = tenantId
        ? await contactsQuery.eq('tenant_id', tenantId)
        : await contactsQuery.eq('user_id', user.id)
      const { data: currentContacts } = currentContactsRes

      // Calculate previous period for comparison
      const periodDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      const prevStart = subDays(start, periodDays)
      const prevEnd = subDays(end, periodDays)

      const prevMsgsQuery = supabase
        .from('messages')
        .select('*')
        .gte('created_at', prevStart.toISOString())
        .lte('created_at', prevEnd.toISOString())

      const prevMessagesRes = tenantId
        ? await prevMsgsQuery.eq('tenant_id', tenantId)
        : await prevMsgsQuery.eq('user_id', user.id)
      const { data: prevMessages } = prevMessagesRes

      const prevContactsQuery = supabase
        .from('contacts')
        .select('*')
        .gte('last_interaction', prevStart.toISOString())
        .lte('last_interaction', prevEnd.toISOString())

      const prevContactsRes = tenantId
        ? await prevContactsQuery.eq('tenant_id', tenantId)
        : await prevContactsQuery.eq('user_id', user.id)
      const { data: prevContacts } = prevContactsRes

      // Calculate metrics
      const totalMessages = currentMessages?.length || 0
      const prevTotalMessages = prevMessages?.length || 0
      const messagesChange = prevTotalMessages > 0 
        ? ((totalMessages - prevTotalMessages) / prevTotalMessages) * 100 
        : 0

      const deliveredMessages = currentMessages?.filter(m => m.status === 'delivered').length || 0
      const deliveryRate = totalMessages > 0 ? (deliveredMessages / totalMessages) * 100 : 0
      
      const prevDeliveredMessages = prevMessages?.filter(m => m.status === 'delivered').length || 0
      const prevDeliveryRate = prevTotalMessages > 0 ? (prevDeliveredMessages / prevTotalMessages) * 100 : 0
      const deliveryRateChange = prevDeliveryRate > 0 
        ? ((deliveryRate - prevDeliveryRate) / prevDeliveryRate) * 100 
        : 0

      const respondedMessages = currentMessages?.filter(m => m.type === 'received').length || 0
      const responseRate = totalMessages > 0 ? (respondedMessages / totalMessages) * 100 : 0
      
      const prevRespondedMessages = prevMessages?.filter(m => m.type === 'received').length || 0
      const prevResponseRate = prevTotalMessages > 0 ? (prevRespondedMessages / prevTotalMessages) * 100 : 0
      const responseRateChange = prevResponseRate > 0 
        ? ((responseRate - prevResponseRate) / prevResponseRate) * 100 
        : 0

      const activeContacts = currentContacts?.length || 0
      const prevActiveContacts = prevContacts?.length || 0
      const activeContactsChange = prevActiveContacts > 0 
        ? ((activeContacts - prevActiveContacts) / prevActiveContacts) * 100 
        : 0

      setMetrics({
        totalMessages,
        messagesChange,
        deliveryRate: Math.round(deliveryRate),
        deliveryRateChange,
        responseRate: Math.round(responseRate),
        responseRateChange,
        activeContacts,
        activeContactsChange
      })

    } catch (error) {
      console.error('Error fetching analytics metrics:', error)
      toast.error('Erro ao carregar métricas')
    } finally {
      setLoading(false)
    }
  }, [user, getDateRange, tenantId])

  // Fetch message volume data
  const fetchMessageVolumeData = useCallback(async () => {
    if (!user) return

    try {
      const { start, end } = getDateRange()
      
      const msgsQuery = supabase
        .from('messages')
        .select('created_at, type')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at')

      const { data: messages } = tenantId
        ? await msgsQuery.eq('tenant_id', tenantId)
        : await msgsQuery.eq('user_id', user.id)

      // Group messages by date
      const volumeMap = new Map<string, { sent: number; received: number }>()
      
      messages?.forEach(message => {
        const date = format(new Date(message.created_at), 'yyyy-MM-dd')
        const current = volumeMap.get(date) || { sent: 0, received: 0 }
        
        if (message.type === 'sent') {
          current.sent++
        } else if (message.type === 'received') {
          current.received++
        }
        
        volumeMap.set(date, current)
      })

      const volumeData: MessageVolumeData[] = []
      const currentDate = new Date(start)
      
      while (currentDate <= end) {
        const dateStr = format(currentDate, 'yyyy-MM-dd')
        const data = volumeMap.get(dateStr) || { sent: 0, received: 0 }
        
        volumeData.push({
          date: dateStr,
          sent: data.sent,
          received: data.received
        })
        
        currentDate.setDate(currentDate.getDate() + 1)
      }

      setMessageVolumeData(volumeData)

    } catch (error) {
      console.error('Error fetching message volume data:', error)
    }
  }, [user, getDateRange, tenantId])

  // Fetch campaign performance data
  const fetchCampaignPerformanceData = useCallback(async () => {
    if (!user) return

    try {
      const { start, end } = getDateRange()
      
      const campaignsQuery = supabase
        .from('campaigns')
        .select(`
          *,
          messages (
            id,
            status,
            type,
            created_at
          )
        `)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())

      const { data: campaigns } = tenantId
        ? await campaignsQuery.eq('tenant_id', tenantId)
        : await campaignsQuery.eq('user_id', user.id)

      const performanceData: CampaignPerformanceData[] = campaigns?.map(campaign => {
        const messages = campaign.messages || []
        const sent = messages.filter((m: any) => m.type === 'sent').length
        const delivered = messages.filter((m: any) => m.status === 'delivered').length
        const opened = Math.floor(delivered * 0.7) // Simulated open rate
        const clicked = Math.floor(opened * 0.3) // Simulated click rate

        return {
          name: campaign.name,
          sent,
          delivered,
          opened,
          clicked,
          status: campaign.status
        }
      }) || []

      setCampaignPerformanceData(performanceData)

    } catch (error) {
      console.error('Error fetching campaign performance data:', error)
    }
  }, [user, getDateRange, tenantId])

  // Fetch audience segment data
  const fetchAudienceSegmentData = useCallback(async () => {
    if (!user) return

    try {
      const contactsQuery = supabase
        .from('contacts')
        .select('metadata')

      const { data: contacts } = tenantId
        ? await contactsQuery.eq('tenant_id', tenantId)
        : await contactsQuery.eq('user_id', user.id)

      // Simulate device and location segmentation
      const deviceData = [
        { name: 'Mobile', value: Math.floor((contacts?.length || 0) * 0.7) },
        { name: 'Desktop', value: Math.floor((contacts?.length || 0) * 0.2) },
        { name: 'Tablet', value: Math.floor((contacts?.length || 0) * 0.1) }
      ]

      const locationData = [
        { name: 'São Paulo', value: Math.floor((contacts?.length || 0) * 0.4) },
        { name: 'Rio de Janeiro', value: Math.floor((contacts?.length || 0) * 0.25) },
        { name: 'Belo Horizonte', value: Math.floor((contacts?.length || 0) * 0.15) },
        { name: 'Outros', value: Math.floor((contacts?.length || 0) * 0.2) }
      ]

      setAudienceSegmentData({
        device: deviceData,
        location: locationData
      })

    } catch (error) {
      console.error('Error fetching audience segment data:', error)
    }
  }, [user, tenantId])

  // Fetch response time data
  const fetchResponseTimeData = useCallback(async () => {
    if (!user) return

    try {
      const { start, end } = getDateRange()
      
      // Simulate response time data
      const responseData: ResponseTimeData[] = []
      const currentDate = new Date(start)
      
      while (currentDate <= end) {
        const dateStr = format(currentDate, 'yyyy-MM-dd')
        
        responseData.push({
          date: dateStr,
          averageTime: Math.floor(Math.random() * 30) + 5 // 5-35 minutes
        })
        
        currentDate.setDate(currentDate.getDate() + 1)
      }

      setResponseTimeData(responseData)

    } catch (error) {
      console.error('Error fetching response time data:', error)
    }
  }, [user, getDateRange])

  // Get real-time metrics
  const getRealTimeMetrics = useCallback(async (): Promise<RealTimeMetrics> => {
    if (!user) {
      return {
        messagesLastHour: 0,
        activeChats: 0,
        responseTime: '0 min',
        onlineAgents: 0
      }
    }

    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      
      const msgsQuery = supabase
        .from('messages')
        .select('id')
        .gte('created_at', oneHourAgo.toISOString())

      const { data: recentMessages } = tenantId
        ? await msgsQuery.eq('tenant_id', tenantId)
        : await msgsQuery.eq('user_id', user.id)

      const contactsQuery = supabase
        .from('contacts')
        .select('id')
        .gte('last_interaction', oneHourAgo.toISOString())

      const { data: activeChats } = tenantId
        ? await contactsQuery.eq('tenant_id', tenantId)
        : await contactsQuery.eq('user_id', user.id)

      return {
        messagesLastHour: recentMessages?.length || 0,
        activeChats: activeChats?.length || 0,
        responseTime: `${Math.floor(Math.random() * 10) + 2} min`,
        onlineAgents: 1
      }

    } catch (error) {
      console.error('Error fetching real-time metrics:', error)
      return {
        messagesLastHour: 0,
        activeChats: 0,
        responseTime: '0 min',
        onlineAgents: 0
      }
    }
  }, [user, tenantId])

  // Update filters
  const updateFilters = useCallback((newFilters: Partial<AnalyticsFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }, [])

  // Export analytics
  const exportAnalytics = useCallback(async (options: ExportOptions) => {
    try {
      setLoading(true)
      
      // Simulate export process
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const filename = `analytics-${format(new Date(), 'yyyy-MM-dd')}.${options.format}`
      toast.success(`Relatório exportado: ${filename}`)
      
    } catch (error) {
      console.error('Error exporting analytics:', error)
      toast.error('Erro ao exportar relatório')
    } finally {
      setLoading(false)
    }
  }, [])

  // Compare periods
  const comparePeriods = useCallback(async (period1: AnalyticsFilters, period2: AnalyticsFilters) => {
    // Implementation for period comparison
    console.log('Comparing periods:', period1, period2)
  }, [])

  // Refresh all metrics
  const refreshMetrics = useCallback(async () => {
    await Promise.all([
      fetchMetrics(),
      fetchMessageVolumeData(),
      fetchCampaignPerformanceData(),
      fetchAudienceSegmentData(),
      fetchResponseTimeData()
    ])
  }, [fetchMetrics, fetchMessageVolumeData, fetchCampaignPerformanceData, fetchAudienceSegmentData, fetchResponseTimeData])

  // Load data on mount and filter changes
  useEffect(() => {
    refreshMetrics()
  }, [refreshMetrics])

  return {
    metrics,
    messageVolumeData,
    campaignPerformanceData,
    audienceSegmentData,
    responseTimeData,
    filters,
    loading,
    updateFilters,
    exportAnalytics,
    getRealTimeMetrics,
    comparePeriods,
    refreshMetrics
  }
}
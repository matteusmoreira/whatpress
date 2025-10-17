import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

export interface ScheduledCampaign {
  id: string
  name: string
  description: string
  template_id?: string
  template_name?: string
  audience_segment: string
  audience_count: number
  scheduled_date: Date
  status: 'scheduled' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
  type: 'immediate' | 'recurring'
  recurring_pattern?: 'daily' | 'weekly' | 'monthly'
  timezone: string
  created_at: string
  estimated_reach: number
  priority: 'low' | 'medium' | 'high'
  next_execution?: Date
  message_content: string
  media_url?: string
  sent_count?: number
  delivered_count?: number
  failed_count?: number
  user_id: string
}

export interface SchedulingStats {
  total_scheduled: number
  running: number
  completed_today: number
  success_rate: number
  total_reach: number
  pending_executions: number
}

export interface CreateScheduledCampaignData {
  name: string
  description: string
  template_id?: string
  audience_segment: string
  scheduled_date: Date
  type: 'immediate' | 'recurring'
  recurring_pattern?: 'daily' | 'weekly' | 'monthly'
  timezone: string
  priority: 'low' | 'medium' | 'high'
  message_content: string
  media_url?: string
}

export function useScheduling() {
  const { user } = useAuth()
  const [campaigns, setCampaigns] = useState<ScheduledCampaign[]>([])
  const [stats, setStats] = useState<SchedulingStats>({
    total_scheduled: 0,
    running: 0,
    completed_today: 0,
    success_rate: 0,
    total_reach: 0,
    pending_executions: 0
  })
  const [loading, setLoading] = useState(false)

  // Fetch scheduled campaigns
  const fetchCampaigns = async () => {
    if (!user) return

    try {
      setLoading(true)
      
      // Mock data for now - replace with real Supabase query
      const mockCampaigns: ScheduledCampaign[] = [
        {
          id: '1',
          name: 'Promoção Black Friday',
          description: 'Campanha especial para Black Friday com descontos exclusivos',
          template_name: 'Promoção Especial',
          audience_segment: 'Clientes VIP',
          audience_count: 1250,
          scheduled_date: new Date('2024-11-29T09:00:00'),
          status: 'scheduled',
          type: 'immediate',
          timezone: 'America/Sao_Paulo',
          created_at: '2024-01-15',
          estimated_reach: 1200,
          priority: 'high',
          message_content: '🔥 BLACK FRIDAY EXCLUSIVA! Descontos de até 70% em todos os produtos. Aproveite agora!',
          user_id: user.id
        },
        {
          id: '2',
          name: 'Lembrete Consulta Médica',
          description: 'Lembretes automáticos para consultas agendadas',
          template_name: 'Lembrete de Agendamento',
          audience_segment: 'Pacientes Agendados',
          audience_count: 89,
          scheduled_date: new Date('2024-01-20T08:00:00'),
          status: 'running',
          type: 'recurring',
          recurring_pattern: 'daily',
          timezone: 'America/Sao_Paulo',
          created_at: '2024-01-10',
          estimated_reach: 85,
          priority: 'medium',
          next_execution: new Date('2024-01-17T08:00:00'),
          message_content: '📅 Lembrete: Você tem uma consulta agendada para amanhã às {{hora}}. Confirme sua presença.',
          sent_count: 156,
          delivered_count: 148,
          failed_count: 8,
          user_id: user.id
        },
        {
          id: '3',
          name: 'Newsletter Semanal',
          description: 'Envio semanal de novidades e promoções',
          template_name: 'Newsletter',
          audience_segment: 'Todos os Clientes',
          audience_count: 3420,
          scheduled_date: new Date('2024-01-22T10:00:00'),
          status: 'completed',
          type: 'recurring',
          recurring_pattern: 'weekly',
          timezone: 'America/Sao_Paulo',
          created_at: '2024-01-01',
          estimated_reach: 3200,
          priority: 'medium',
          message_content: '📰 Newsletter Semanal - Confira as novidades e ofertas especiais desta semana!',
          sent_count: 3420,
          delivered_count: 3156,
          failed_count: 264,
          user_id: user.id
        }
      ]

      setCampaigns(mockCampaigns)
      
      // Calculate stats
      const totalScheduled = mockCampaigns.filter(c => c.status === 'scheduled').length
      const running = mockCampaigns.filter(c => c.status === 'running').length
      const completedToday = mockCampaigns.filter(c => 
        c.status === 'completed' && 
        new Date(c.scheduled_date).toDateString() === new Date().toDateString()
      ).length
      
      const totalSent = mockCampaigns.reduce((sum, c) => sum + (c.sent_count || 0), 0)
      const totalDelivered = mockCampaigns.reduce((sum, c) => sum + (c.delivered_count || 0), 0)
      const successRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0
      
      const totalReach = mockCampaigns.reduce((sum, c) => sum + c.estimated_reach, 0)
      const pendingExecutions = mockCampaigns.filter(c => 
        c.status === 'scheduled' && new Date(c.scheduled_date) <= new Date()
      ).length

      setStats({
        total_scheduled: totalScheduled,
        running,
        completed_today: completedToday,
        success_rate: successRate,
        total_reach: totalReach,
        pending_executions: pendingExecutions
      })

    } catch (error) {
      console.error('Erro ao buscar campanhas agendadas:', error)
    } finally {
      setLoading(false)
    }
  }

  // Create scheduled campaign
  const createScheduledCampaign = async (data: CreateScheduledCampaignData) => {
    if (!user) throw new Error('Usuário não autenticado')

    try {
      // Mock implementation - replace with real Supabase insert
      const newCampaign: ScheduledCampaign = {
        id: Date.now().toString(),
        ...data,
        status: 'scheduled',
        created_at: new Date().toISOString(),
        estimated_reach: Math.floor(Math.random() * 1000) + 100,
        user_id: user.id,
        audience_count: Math.floor(Math.random() * 500) + 50
      }

      setCampaigns(prev => [newCampaign, ...prev])
      await fetchCampaigns() // Refresh stats
      
      return newCampaign
    } catch (error) {
      console.error('Erro ao criar campanha agendada:', error)
      throw error
    }
  }

  // Update campaign status
  const updateCampaignStatus = async (campaignId: string, status: ScheduledCampaign['status']) => {
    try {
      setCampaigns(prev => 
        prev.map(campaign => 
          campaign.id === campaignId 
            ? { ...campaign, status }
            : campaign
        )
      )
      await fetchCampaigns() // Refresh stats
    } catch (error) {
      console.error('Erro ao atualizar status da campanha:', error)
      throw error
    }
  }

  // Delete campaign
  const deleteCampaign = async (campaignId: string) => {
    try {
      setCampaigns(prev => prev.filter(campaign => campaign.id !== campaignId))
      await fetchCampaigns() // Refresh stats
    } catch (error) {
      console.error('Erro ao deletar campanha:', error)
      throw error
    }
  }

  // Duplicate campaign
  const duplicateCampaign = async (campaignId: string) => {
    try {
      const originalCampaign = campaigns.find(c => c.id === campaignId)
      if (!originalCampaign) throw new Error('Campanha não encontrada')

      const duplicatedCampaign: ScheduledCampaign = {
        ...originalCampaign,
        id: Date.now().toString(),
        name: `${originalCampaign.name} (Cópia)`,
        status: 'scheduled',
        created_at: new Date().toISOString(),
        scheduled_date: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        sent_count: undefined,
        delivered_count: undefined,
        failed_count: undefined
      }

      setCampaigns(prev => [duplicatedCampaign, ...prev])
      await fetchCampaigns() // Refresh stats
      
      return duplicatedCampaign
    } catch (error) {
      console.error('Erro ao duplicar campanha:', error)
      throw error
    }
  }

  // Get campaign execution history
  const getCampaignHistory = async (campaignId: string) => {
    try {
      // Mock implementation - replace with real Supabase query
      return [
        {
          id: '1',
          campaign_id: campaignId,
          executed_at: new Date('2024-01-15T09:00:00'),
          status: 'completed',
          sent_count: 1200,
          delivered_count: 1156,
          failed_count: 44,
          duration_seconds: 180
        }
      ]
    } catch (error) {
      console.error('Erro ao buscar histórico da campanha:', error)
      throw error
    }
  }

  // Get upcoming executions
  const getUpcomingExecutions = async () => {
    try {
      const upcoming = campaigns.filter(campaign => 
        campaign.status === 'scheduled' && 
        new Date(campaign.scheduled_date) > new Date()
      ).sort((a, b) => 
        new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
      )

      return upcoming.slice(0, 5) // Next 5 executions
    } catch (error) {
      console.error('Erro ao buscar próximas execuções:', error)
      throw error
    }
  }

  useEffect(() => {
    fetchCampaigns()
  }, [user])

  return {
    campaigns,
    stats,
    loading,
    fetchCampaigns,
    createScheduledCampaign,
    updateCampaignStatus,
    deleteCampaign,
    duplicateCampaign,
    getCampaignHistory,
    getUpcomingExecutions
  }
}
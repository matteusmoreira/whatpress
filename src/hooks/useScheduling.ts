import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/hooks/useTenant'

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
  const { currentTenant } = useTenant()
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

      let query = supabase
        .from('campaigns')
        .select('id, user_id, name, description, template_id, target_contacts, status, scheduled_at, created_at, priority_level, campaign_type, execution_strategy, tenant_id')
        .order('created_at', { ascending: false })

      if (currentTenant?.id) {
        query = query.eq('tenant_id', currentTenant.id)
      } else if (user?.id) {
        // Compatibilidade com esquemas antigos
        query = query.eq('user_id', user.id)
      }

      const { data: rows, error } = await query

      if (error) throw error

      const templateIds = [...new Set(((rows || []).map((r: any) => r.template_id).filter(Boolean)))] as string[]

      const templateMap = new Map<string, string>()
      if (templateIds.length > 0) {
        const { data: templates, error: tErr } = await supabase
          .from('message_templates')
          .select('id, name, tenant_id')
          .in('id', templateIds)
          .eq('tenant_id', currentTenant?.id || (rows?.[0]?.tenant_id ?? null))
        if (!tErr && templates) {
          (templates as any[]).forEach((t) => templateMap.set(t.id, t.name))
        }
      }

      const campaignIds = (rows || []).map((r: any) => r.id)
      const metricsMap = new Map<string, any>()
      if (campaignIds.length > 0 && currentTenant?.id) {
        const { data: metrics, error: mErr } = await supabase
          .from('campaign_metrics')
          .select('campaign_id, messages_sent, messages_failed, total_messages, messages_pending')
          .in('campaign_id', campaignIds)
          .eq('tenant_id', currentTenant.id)
        if (!mErr && metrics) {
          (metrics as any[]).forEach((m) => metricsMap.set(m.campaign_id, m))
        }
      }

      // Buscar próxima execução (menor scheduled_at pendente) por campanha
      const nextExecMap = new Map<string, Date | undefined>()
      if (campaignIds.length > 0 && currentTenant?.id) {
        const { data: queueRows, error: qErr } = await supabase
          .from('message_queue')
          .select('campaign_id, scheduled_at, status')
          .in('campaign_id', campaignIds)
          .eq('tenant_id', currentTenant.id)
          .eq('status', 'pending')
          .order('scheduled_at', { ascending: true })
          .limit(1000)
        if (!qErr && queueRows) {
          const earliest: Record<string, string> = {}
          for (const row of queueRows as any[]) {
            const cid = row.campaign_id
            const sched = row.scheduled_at
            if (!earliest[cid] || new Date(sched).getTime() < new Date(earliest[cid]).getTime()) {
              earliest[cid] = sched
            }
          }
          Object.entries(earliest).forEach(([cid, sched]) => {
            nextExecMap.set(cid, new Date(sched))
          })
        }
      }

      const mapped: ScheduledCampaign[] = (rows || []).map((row: any) => {
        const strategy = row.execution_strategy || {}
        const audienceCount = Array.isArray(row.target_contacts) ? row.target_contacts.length : 0
        const template_name = row.template_id ? templateMap.get(row.template_id) : undefined
        const metrics = metricsMap.get(row.id) || null
        const priority: ScheduledCampaign['priority'] = row.priority_level >= 3 ? 'high' : row.priority_level === 2 ? 'medium' : 'low'
        const type: ScheduledCampaign['type'] = row.campaign_type === 'recurring' ? 'recurring' : 'immediate'
        const statusMap = ['scheduled','running','paused','completed','cancelled']
        const status = statusMap.includes(row.status) ? row.status : 'scheduled'
        const delivered = metrics ? Math.max(0, (metrics.messages_sent || 0) - (metrics.messages_failed || 0)) : undefined
        const nextExecution = nextExecMap.get(row.id)

        return {
          id: row.id,
          name: row.name,
          description: row.description || '',
          template_id: row.template_id || undefined,
          template_name,
          audience_segment: strategy.audience_segment || 'Personalizado',
          audience_count: audienceCount,
          scheduled_date: row.scheduled_at ? new Date(row.scheduled_at) : new Date(),
          status: status as ScheduledCampaign['status'],
          type,
          recurring_pattern: strategy.recurring_pattern,
          timezone: strategy.timezone || 'America/Sao_Paulo',
          created_at: row.created_at,
          estimated_reach: audienceCount,
          priority,
          next_execution: nextExecution,
          message_content: strategy.message_content || '',
          media_url: strategy.media_url || undefined,
          sent_count: metrics?.messages_sent,
          delivered_count: delivered,
          failed_count: metrics?.messages_failed,
          user_id: row.user_id
        }
      })

      setCampaigns(mapped)

      const totalScheduled = mapped.filter(c => c.status === 'scheduled').length
      const running = mapped.filter(c => c.status === 'running').length
      const completedToday = mapped.filter(c => 
        c.status === 'completed' && 
        new Date(c.scheduled_date).toDateString() === new Date().toDateString()
      ).length
      const totalSent = mapped.reduce((sum, c) => sum + (c.sent_count || 0), 0)
      const totalDelivered = mapped.reduce((sum, c) => sum + (c.delivered_count || 0), 0)
      const successRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0
      const totalReach = mapped.reduce((sum, c) => sum + c.estimated_reach, 0)
      const pendingExecutions = mapped.filter(c => 
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
    if (!currentTenant?.id) throw new Error('Tenant não disponível')

    try {
      const execStrategy = {
        recurring_pattern: data.recurring_pattern || null,
        timezone: data.timezone,
        audience_segment: data.audience_segment,
        message_content: data.message_content,
        media_url: data.media_url || null
      }
      const priority_level = data.priority === 'high' ? 3 : data.priority === 'medium' ? 2 : 1
      const campaign_type = data.type === 'recurring' ? 'recurring' : 'simple'

      const insertPayload: any = {
        tenant_id: currentTenant.id,
        user_id: user.id,
        name: data.name,
        description: data.description,
        template_id: data.template_id ?? null,
        target_contacts: [],
        status: 'scheduled',
        scheduled_at: data.scheduled_date.toISOString(),
        priority_level,
        campaign_type,
        execution_strategy: execStrategy
      }

      const { data: inserted, error } = await supabase
        .from('campaigns')
        .insert(insertPayload)
        .select('id, user_id, name, description, template_id, target_contacts, status, scheduled_at, created_at, priority_level, campaign_type, execution_strategy')
        .single()

      if (error) throw error

      // Resolver contatos alvo com base no segmento
      let contactIds: string[] = []
      try {
        let contactsQuery = supabase
          .from('contacts')
          .select('id, is_group, tags')
          .eq('tenant_id', currentTenant.id)
        if (data.audience_segment?.toLowerCase() === 'todos') {
          contactsQuery = contactsQuery.eq('is_group', false)
        } else if (data.audience_segment?.toLowerCase().startsWith('tag:')) {
          const tag = data.audience_segment.split(':')[1]?.trim()
          if (tag) {
            contactsQuery = contactsQuery.contains('tags', [tag])
          }
        }
        const { data: contactsRows, error: cErr } = await contactsQuery
        if (!cErr && contactsRows) {
          contactIds = (contactsRows as any[]).filter(r => !r.is_group).map(r => r.id)
        }
      } catch (e) {
        console.warn('Segmento não pôde ser resolvido, mantendo target_contacts vazio:', e)
      }

      // Atualizar campanha com target_contacts
      if (contactIds.length > 0) {
        await supabase
          .from('campaigns')
          .update({ target_contacts: contactIds })
          .eq('id', inserted.id)
          .eq('tenant_id', currentTenant.id)
      }

      // Obter conteúdo da mensagem
      let messageText = execStrategy.message_content || ''
      if (!messageText && inserted.template_id) {
        const { data: tpl } = await supabase
          .from('message_templates')
          .select('content')
          .eq('id', inserted.template_id)
          .eq('tenant_id', currentTenant.id)
          .limit(1)
          .single()
        messageText = tpl?.content || ''
      }

      // Inserir itens na fila de mensagens
      if (contactIds.length > 0 && messageText) {
        const priorityNum = priority_level >= 3 ? 3 : priority_level === 2 ? 2 : 1
        const queueItems = contactIds.map(cid => ({
          campaign_id: inserted.id,
          tenant_id: currentTenant.id,
          contact_id: cid,
          whatsapp_instance_id: null,
          message_content: messageText,
          status: 'pending',
          priority: priorityNum,
          scheduled_at: data.scheduled_date.toISOString(),
          retry_count: 0,
          randomization_applied: null
        }))
        const { error: qInsErr } = await supabase
          .from('message_queue')
          .insert(queueItems)
        if (qInsErr) console.error('Erro ao inserir na fila de mensagens:', qInsErr)
      }

      // Inserir métricas iniciais
      const { error: mInsErr } = await supabase
        .from('campaign_metrics')
        .insert({
          tenant_id: currentTenant.id,
          campaign_id: inserted.id,
          total_messages: contactIds.length,
          messages_pending: contactIds.length,
          messages_sent: 0,
          messages_failed: 0,
          success_rate: 0,
          active_instances: 0,
          avg_response_time: 0,
          updated_at: new Date().toISOString()
        })
      if (mInsErr) console.error('Erro ao inserir métricas iniciais:', mInsErr)

      // Log de evento scheduled
      await supabase
        .from('campaign_execution_logs')
        .insert({
          tenant_id: currentTenant.id,
          campaign_id: inserted.id,
          event_type: 'scheduled',
          event_data: { scheduled_at: data.scheduled_date.toISOString(), audience_count: contactIds.length },
        })

      const audienceCount = Array.isArray(inserted.target_contacts) ? inserted.target_contacts.length : contactIds.length
      const priority: ScheduledCampaign['priority'] = priority_level >= 3 ? 'high' : priority_level === 2 ? 'medium' : 'low'
      const type: ScheduledCampaign['type'] = campaign_type === 'recurring' ? 'recurring' : 'immediate'

      const newCampaign: ScheduledCampaign = {
        id: inserted.id,
        name: inserted.name,
        description: inserted.description || '',
        template_id: inserted.template_id || undefined,
        template_name: undefined,
        audience_segment: execStrategy.audience_segment || 'Personalizado',
        audience_count: audienceCount,
        scheduled_date: new Date(inserted.scheduled_at),
        status: 'scheduled',
        type,
        recurring_pattern: execStrategy.recurring_pattern || undefined,
        timezone: execStrategy.timezone || 'America/Sao_Paulo',
        created_at: inserted.created_at,
        estimated_reach: audienceCount,
        priority,
        next_execution: data.scheduled_date,
        message_content: execStrategy.message_content || messageText,
        media_url: execStrategy.media_url || undefined,
        sent_count: 0,
        delivered_count: 0,
        failed_count: 0,
        user_id: inserted.user_id
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
      if (!currentTenant?.id) throw new Error('Tenant não disponível')

      const { error } = await supabase
        .from('campaigns')
        .update({ status })
        .eq('id', campaignId)
        .eq('tenant_id', currentTenant.id)
      if (error) throw error

      // Ajustes na fila conforme status
      if (status === 'completed' || status === 'cancelled') {
        await supabase
          .from('message_queue')
          .update({ status: 'cancelled' })
          .eq('tenant_id', currentTenant.id)
          .eq('campaign_id', campaignId)
          .eq('status', 'pending')
      }

      const eventType = status === 'running' ? 'started' : status === 'paused' ? 'paused' : status === 'completed' ? 'completed' : status === 'failed' ? 'failed' : 'resumed'
      await supabase.from('campaign_execution_logs').insert({
        tenant_id: currentTenant.id,
        campaign_id: campaignId,
        event_type: eventType,
        event_data: { source: 'ui' }
      })

      await fetchCampaigns() // Refresh stats
    } catch (error) {
      console.error('Erro ao atualizar status da campanha:', error)
      throw error
    }
  }

  // Delete campaign
  const deleteCampaign = async (campaignId: string) => {
    try {
      if (!currentTenant?.id) throw new Error('Tenant não disponível')
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', campaignId)
        .eq('tenant_id', currentTenant.id)
      if (error) throw error
      await fetchCampaigns() // Refresh stats
    } catch (error) {
      console.error('Erro ao deletar campanha:', error)
      throw error
    }
  }

  // Duplicate campaign
  const duplicateCampaign = async (campaignId: string) => {
    try {
      if (!currentTenant?.id) throw new Error('Tenant não disponível')

      const { data: original, error: getErr } = await supabase
        .from('campaigns')
        .select('id, user_id, name, description, template_id, target_contacts, status, scheduled_at, priority_level, campaign_type, execution_strategy')
        .eq('id', campaignId)
        .eq('tenant_id', currentTenant.id)
        .single()
      if (getErr || !original) throw getErr || new Error('Campanha não encontrada')

      const nowPlus1Day = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

      const { error: insErr } = await supabase
        .from('campaigns')
        .insert({
          tenant_id: currentTenant.id,
          user_id: user?.id || original.user_id,
          name: `${original.name} (Cópia)`,
          description: original.description,
          template_id: original.template_id,
          target_contacts: original.target_contacts || [],
          status: 'scheduled',
          scheduled_at: nowPlus1Day,
          priority_level: original.priority_level,
          campaign_type: original.campaign_type,
          execution_strategy: original.execution_strategy
        })
      if (insErr) throw insErr

      await fetchCampaigns() // Refresh stats
    } catch (error) {
      console.error('Erro ao duplicar campanha:', error)
      throw error
    }
  }

  // Get campaign execution history
  const getCampaignHistory = async (campaignId: string) => {
    try {
      if (!currentTenant?.id) throw new Error('Tenant não disponível')
      const { data, error } = await supabase
        .from('campaign_execution_logs')
        .select('id, campaign_id, event_type, event_data, timestamp')
        .eq('tenant_id', currentTenant.id)
        .eq('campaign_id', campaignId)
        .order('timestamp', { ascending: false })
      if (error) throw error

      return (data || []).map((row: any) => ({
        id: row.id,
        campaign_id: row.campaign_id,
        executed_at: new Date(row.timestamp),
        status: row.event_type,
        sent_count: row.event_data?.sent_count,
        delivered_count: row.event_data?.delivered_count,
        failed_count: row.event_data?.failed_count,
        duration_seconds: row.event_data?.duration_seconds
      }))
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
  }, [user, currentTenant?.id])

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
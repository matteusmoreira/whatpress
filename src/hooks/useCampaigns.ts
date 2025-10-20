import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { useCampaignEngine } from '@/hooks/useCampaignEngine'
import { useTenant } from '@/hooks/useTenant'

export interface Campaign {
  id: string
  user_id: string
  instance_id: string
  name: string
  description: string | null
  template_id: string | null
  target_contacts: string[]
  status: 'draft' | 'scheduled' | 'running' | 'completed' | 'paused' | 'cancelled'
  scheduled_at: string | null
  created_at: string
  completed_at: string | null
  // Campos calculados
  sent?: number
  delivered?: number
  read?: number
  replied?: number
  total_contacts?: number
  progress?: number
}

export interface CampaignStats {
  total_campaigns: number
  active_campaigns: number
  total_messages_sent: number
  delivery_rate: number
  response_rate: number
}

export function useCampaigns() {
  const { user } = useAuth()
  const { currentTenant } = useTenant()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [stats, setStats] = useState<CampaignStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Engine actions from useCampaignEngine
  const { startCampaign: engineStartCampaign, pauseCampaign: enginePauseCampaign, stopCampaign: engineStopCampaign } = useCampaignEngine()
  
  // Buscar campanhas do usuário/tenant com filtro compatível
  const fetchCampaigns = async () => {
    if (!user) return

    try {
      setLoading(true)
      setError(null)

      let query = supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false })

      if (currentTenant?.id) {
        query = query.eq('tenant_id', currentTenant.id)
      } else if (user?.id) {
        // Compatibilidade com esquemas antigos
        query = query.eq('user_id', user.id)
      }

      const { data, error } = await query

      if (error) throw error

      // Calcular estatísticas para cada campanha
      const campaignsWithStats = await Promise.all(
        (data || []).map(async (campaign) => {
          const stats = await getCampaignStats(campaign.id)
          return {
            ...campaign,
            ...stats,
            total_contacts: campaign.target_contacts?.length || 0
          }
        })
      )

      setCampaigns(campaignsWithStats)
    } catch (err: any) {
      console.error('Erro ao buscar campanhas:', err)
      setError(err.message)
      toast.error('Erro ao carregar campanhas')
    } finally {
      setLoading(false)
    }
  }

  // Buscar estatísticas de uma campanha específica
  const getCampaignStats = async (campaignId: string) => {
    try {
      // Buscar mensagens relacionadas à campanha
      const { data: messages, error } = await supabase
        .from('messages')
        .select('status')
        .eq('metadata->>campaign_id', campaignId)

      if (error) throw error

      const sent = messages?.length || 0
      const delivered = messages?.filter(m => ['delivered', 'read'].includes(m.status)).length || 0
      const read = messages?.filter(m => m.status === 'read').length || 0
      const replied = messages?.filter(m => m.status === 'replied').length || 0

      return {
        sent,
        delivered,
        read,
        replied,
        progress: sent > 0 ? Math.round((delivered / sent) * 100) : 0
      }
    } catch (err) {
      console.error('Erro ao buscar estatísticas da campanha:', err)
      return { sent: 0, delivered: 0, read: 0, replied: 0, progress: 0 }
    }
  }

  // Buscar estatísticas gerais
  const fetchStats = async () => {
    if (!user) return

    try {
      // Total de campanhas
      let totalQuery = supabase
        .from('campaigns')
        .select('*', { count: 'exact', head: true })

      // Campanhas ativas
      let activeQuery = supabase
        .from('campaigns')
        .select('*', { count: 'exact', head: true })
        .in('status', ['running', 'scheduled'])

      if (currentTenant?.id) {
        totalQuery = totalQuery.eq('tenant_id', currentTenant.id)
        activeQuery = activeQuery.eq('tenant_id', currentTenant.id)
      } else if (user?.id) {
        // Compatibilidade com esquemas antigos
        totalQuery = totalQuery.eq('user_id', user.id)
        activeQuery = activeQuery.eq('user_id', user.id)
      }

      const { count: totalCampaigns } = await totalQuery
      const { count: activeCampaigns } = await activeQuery

      // Total de mensagens enviadas
      let instancesQuery = supabase
        .from('whatsapp_instances')
        .select('id')

      if (currentTenant?.id) {
        instancesQuery = instancesQuery.eq('tenant_id', currentTenant.id)
      } else if (user?.id) {
        instancesQuery = instancesQuery.eq('user_id', user.id)
      }

      const { data: instances } = await instancesQuery
      const instanceIds = instances?.map(i => i.id) || []
      
      let totalMessagesSent = 0
      let totalDelivered = 0
      let totalReplied = 0

      if (instanceIds.length > 0) {
        const { count: messagesSent } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .in('instance_id', instanceIds)
          .eq('is_from_me', true)

        const { count: messagesDelivered } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .in('instance_id', instanceIds)
          .eq('is_from_me', true)
          .in('status', ['delivered', 'read'])

        const { count: messagesReplied } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .in('instance_id', instanceIds)
          .eq('is_from_me', false)

        totalMessagesSent = messagesSent || 0
        totalDelivered = messagesDelivered || 0
        totalReplied = messagesReplied || 0
      }

      const deliveryRate = totalMessagesSent > 0 ? (totalDelivered / totalMessagesSent) * 100 : 0
      const responseRate = totalMessagesSent > 0 ? (totalReplied / totalMessagesSent) * 100 : 0

      setStats({
        total_campaigns: totalCampaigns || 0,
        active_campaigns: activeCampaigns || 0,
        total_messages_sent: totalMessagesSent,
        delivery_rate: Math.round(deliveryRate * 10) / 10,
        response_rate: Math.round(responseRate * 10) / 10
      })
    } catch (err: any) {
      console.error('Erro ao buscar estatísticas:', err)
    }
  }

  // Criar nova campanha
  const createCampaign = async (campaignData: Partial<Campaign>) => {
    if (!user) throw new Error('Usuário não autenticado')

    try {
      const payload: any = {
        ...campaignData,
        user_id: user.id,
        status: 'draft'
      }
      if (currentTenant?.id) {
        payload.tenant_id = currentTenant.id
      }

      const { data, error } = await supabase
        .from('campaigns')
        .insert([payload])
        .select()
        .single()

      if (error) throw error

      toast.success('Campanha criada com sucesso!')
      await fetchCampaigns()
      return data
    } catch (err: any) {
      console.error('Erro ao criar campanha:', err)
      toast.error('Erro ao criar campanha')
      throw err
    }
  }

  // Atualizar campanha
  const updateCampaign = async (id: string, updates: Partial<Campaign>) => {
    try {
      let query = supabase
        .from('campaigns')
        .update(updates)
        .eq('id', id)

      if (currentTenant?.id) {
        query = query.eq('tenant_id', currentTenant.id)
      } else if (user?.id) {
        query = query.eq('user_id', user?.id)
      }

      const { error } = await query

      if (error) throw error

      toast.success('Campanha atualizada com sucesso!')
      await fetchCampaigns()
    } catch (err: any) {
      console.error('Erro ao atualizar campanha:', err)
      toast.error('Erro ao atualizar campanha')
      throw err
    }
  }

  // Deletar campanha
  const deleteCampaign = async (id: string) => {
    try {
      let query = supabase
        .from('campaigns')
        .delete()
        .eq('id', id)

      if (currentTenant?.id) {
        query = query.eq('tenant_id', currentTenant.id)
      } else if (user?.id) {
        query = query.eq('user_id', user?.id)
      }

      const { error } = await query

      if (error) throw error

      toast.success('Campanha excluída com sucesso!')
      await fetchCampaigns()
    } catch (err: any) {
      console.error('Erro ao excluir campanha:', err)
      toast.error('Erro ao excluir campanha')
      throw err
    }
  }

  // Iniciar campanha
  const startCampaign = async (id: string) => {
    try {
      const success = await engineStartCampaign(id)
      if (success) {
        await fetchCampaigns()
      }
      return success
    } catch (err: any) {
      console.error('Erro ao iniciar campanha:', err)
      throw err
    }
  }

  // Pausar campanha
  const pauseCampaign = async (id: string) => {
    try {
      const success = await enginePauseCampaign(id)
      if (success) {
        await fetchCampaigns()
      }
      return success
    } catch (err: any) {
      console.error('Erro ao pausar campanha:', err)
      throw err
    }
  }

  // Parar campanha
  const stopCampaign = async (id: string) => {
    try {
      const success = await engineStopCampaign(id)
      if (success) {
        await fetchCampaigns()
      }
      return success
    } catch (err: any) {
      console.error('Erro ao parar campanha:', err)
      throw err
    }
  }

  // Duplicar campanha
  const duplicateCampaign = async (campaign: Campaign) => {
    try {
      const newCampaign = {
        name: `${campaign.name} (Cópia)`,
        description: campaign.description,
        template_id: campaign.template_id,
        target_contacts: campaign.target_contacts,
        instance_id: campaign.instance_id
      }
      
      await createCampaign(newCampaign)
      toast.success('Campanha duplicada com sucesso!')
    } catch (err: any) {
      toast.error('Erro ao duplicar campanha')
      throw err
    }
  }

  useEffect(() => {
    if (user) {
      fetchCampaigns()
      fetchStats()
    }
  }, [user, currentTenant?.id])

  return {
    campaigns,
    stats,
    loading,
    error,
    fetchCampaigns,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    startCampaign,
    pauseCampaign,
    stopCampaign,
    duplicateCampaign,
    getCampaignStats
  }
}
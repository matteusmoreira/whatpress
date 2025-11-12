import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { useCampaignEngine } from '@/hooks/useCampaignEngine'
import { useTenant } from '@/hooks/useTenant'
import { useCache } from './useCache'
import { monitorDatabaseQuery, monitorFunction } from '@/lib/monitoring'

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
  execution_strategy?: any
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
  
  // Cache para campanhas
  const { data: cachedCampaigns, mutate: mutateCampaigns } = useCache(
    user ? `campaigns:${currentTenant?.id ?? user.id}` : '',
    async () => {
      if (!user) return []
      
      return monitorDatabaseQuery(
        async () => {
          let query = supabase
            .from('campaigns')
            .select('*')
            .order('created_at', { ascending: false })

          if (currentTenant?.id) {
            query = query.eq('tenant_id', currentTenant.id)
          } else if (user?.id) {
            query = query.eq('user_id', user.id)
          }

          const { data, error } = await query
          if (error) throw error
          
          return data || []
        },
        {
          query: 'SELECT * FROM campaigns ORDER BY created_at DESC',
          table: 'campaigns',
          operation: 'select',
        }
      )
    },
    {
      ttl: 300, // 5 minutos
      enabled: !!user,
    }
  )
  
  // Cache para estatísticas
  const { data: cachedStats, mutate: mutateStats } = useCache(
    user ? `campaigns:stats:${currentTenant?.id ?? user.id}` : '',
    async () => {
      if (!user) return null
      
      return await fetchStatsWithMonitoring()
    },
    {
      ttl: 600, // 10 minutos
      enabled: !!user,
    }
  )
  
  // Engine actions from useCampaignEngine
  const { startCampaign: engineStartCampaign, pauseCampaign: enginePauseCampaign, stopCampaign: engineStopCampaign } = useCampaignEngine()
  
  // Buscar campanhas do usuário/tenant com monitoring
  const fetchCampaigns = async () => {
    if (!user) return

    try {
      setLoading(true)
      setError(null)

      if (cachedCampaigns) {
        // Calcular estatísticas para cada campanha do cache
        const campaignsWithStats = await Promise.all(
          (cachedCampaigns || []).map(async (campaign) => {
            const stats = await getCampaignStats(campaign.id)
            return {
              ...campaign,
              ...stats,
              total_contacts: campaign.target_contacts?.length || 0
            }
          })
        )
        setCampaigns(campaignsWithStats)
      }
    } catch (err: any) {
      console.error('Erro ao buscar campanhas:', err)
      setError(err.message)
      toast.error('Erro ao carregar campanhas')
    } finally {
      setLoading(false)
    }
  }
  
  // Função com monitoring para estatísticas
  const fetchStatsWithMonitoring = async () => {
    return monitorFunction(
      async () => {
        if (!user) return null

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

          return {
            total_campaigns: totalCampaigns || 0,
            active_campaigns: activeCampaigns || 0,
            total_messages_sent: totalMessagesSent,
            delivery_rate: deliveryRate,
            response_rate: responseRate
          }
        } catch (err) {
          console.error('Erro ao buscar estatísticas:', err)
          return null
        }
      },
      {
        functionName: 'fetchStatsWithMonitoring',
        category: 'campaigns',
        metadata: { userId: user?.id, tenantId: currentTenant?.id }
      }
    )
  }

  // Buscar estatísticas de uma campanha específica com monitoring
  const getCampaignStats = async (campaignId: string) => {
    return monitorFunction(
      async () => {
        try {
          // Buscar mensagens relacionadas à campanha
          const { data: messages, error } = await monitorDatabaseQuery(
            async () => {
              const result = await supabase
                .from('messages')
                .select('status')
                .eq('metadata->>campaign_id', campaignId)
              return result
            },
            {
              query: 'SELECT status FROM messages WHERE metadata->>campaign_id = $1',
              table: 'messages',
              operation: 'select',
            }
          )

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
      },
      {
        functionName: 'getCampaignStats',
        category: 'campaigns',
        metadata: { campaignId }
      }
    )
  }

  // Buscar estatísticas gerais (substituído por cache)
  const fetchStats = async () => {
    if (cachedStats) {
      setStats(cachedStats)
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

  // Iniciar campanha com monitoring
  const startCampaign = async (campaignId: string) => {
    return monitorFunction(
      async () => {
        try {
          await engineStartCampaign(campaignId)
          await mutateCampaigns() // Invalidar cache e recarregar
          toast.success('Campanha iniciada com sucesso')
        } catch (err: any) {
          console.error('Erro ao iniciar campanha:', err)
          toast.error('Erro ao iniciar campanha')
          throw err
        }
      },
      {
        functionName: 'startCampaign',
        category: 'campaigns',
        metadata: { campaignId }
      }
    )
  }

  // Pausar campanha com monitoring
  const pauseCampaign = async (campaignId: string) => {
    return monitorFunction(
      async () => {
        try {
          await enginePauseCampaign(campaignId)
          await mutateCampaigns() // Invalidar cache e recarregar
          toast.success('Campanha pausada com sucesso')
        } catch (err: any) {
          console.error('Erro ao pausar campanha:', err)
          toast.error('Erro ao pausar campanha')
          throw err
        }
      },
      {
        functionName: 'pauseCampaign',
        category: 'campaigns',
        metadata: { campaignId }
      }
    )
  }

  // Parar campanha com monitoring
  const stopCampaign = async (campaignId: string) => {
    return monitorFunction(
      async () => {
        try {
          await engineStopCampaign(campaignId)
          await mutateCampaigns() // Invalidar cache e recarregar
          toast.success('Campanha parada com sucesso')
        } catch (err: any) {
          console.error('Erro ao parar campanha:', err)
          toast.error('Erro ao parar campanha')
          throw err
        }
      },
      {
        functionName: 'stopCampaign',
        category: 'campaigns',
        metadata: { campaignId }
      }
    )
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

  // Atualizar campanhas quando o cache mudar
  useEffect(() => {
    if (cachedCampaigns) {
      const processCampaigns = async () => {
        const campaignsWithStats = await Promise.all(
          (cachedCampaigns || []).map(async (campaign) => {
            const stats = await getCampaignStats(campaign.id)
            return {
              ...campaign,
              ...stats,
              total_contacts: campaign.target_contacts?.length || 0
            }
          })
        )
        setCampaigns(campaignsWithStats)
      }
      
      processCampaigns()
    }
  }, [cachedCampaigns])
  
  // Atualizar estatísticas quando o cache mudar
  useEffect(() => {
    if (cachedStats) {
      setStats(cachedStats)
    }
  }, [cachedStats])
  
  // Sincronizar loading com estado do cache
  useEffect(() => {
    setLoading(!cachedCampaigns && !!user)
  }, [cachedCampaigns, user])
  
  // Buscar dados iniciais
  useEffect(() => {
    if (user) {
      mutateCampaigns()
      mutateStats()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, currentTenant?.id])

  return {
    campaigns,
    stats,
    loading,
    error,
    startCampaign,
    pauseCampaign,
    stopCampaign,
    refresh: () => {
      mutateCampaigns()
      mutateStats()
    },
    // Cache e monitoring
    cachedCampaigns,
    cachedStats,
    isLoadingCampaigns: !cachedCampaigns && !!user,
    isLoadingStats: !cachedStats && !!user
  }
}
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useTenant } from '@/hooks/useTenant'

// Interface usada no frontend. Mantém compatibilidade com CreateCampaign.tsx
export interface Contact {
  id: string
  user_id?: string
  instance_id?: string
  name: string
  phone: string // mapeado de phone_number
  profile_pic_url?: string | null
  is_group?: boolean
  tags?: string[]
  created_at: string
  // Campos opcionais usados em filtros/segmentação da UI
  location?: string
  last_message_at?: string | null
}

interface UseContactsResult {
  contacts: Contact[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useContacts(): UseContactsResult {
  const { user } = useAuth()
  const { currentTenant } = useTenant()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchContacts = async () => {
    if (!user) {
      setContacts([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Buscar contatos do tenant quando disponível; fallback para user_id em schema legado
      let resultData: any[] = []

      // Tentativa preferencial: filtrando por tenant_id
      if (currentTenant?.id) {
        const { data, error } = await supabase
          .from('contacts')
          .select('*')
          .eq('tenant_id', currentTenant.id)
          .order('created_at', { ascending: false })

        if (error) {
          // Fallback seguro para esquemas sem coluna tenant_id
          const fallback = await supabase
            .from('contacts')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
          if (fallback.error) throw fallback.error
          resultData = fallback.data || []
        } else {
          resultData = data || []
        }
      } else {
        // Sem tenant ativo, usar filtro por usuário
        const { data, error } = await supabase
          .from('contacts')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
        if (error) throw error
        resultData = data || []
      }

      const mapped: Contact[] = resultData.map((c: any) => ({
        id: c.id,
        user_id: c.user_id,
        instance_id: c.instance_id,
        name: c.name || c.phone_number,
        phone: c.phone_number,
        profile_pic_url: c.profile_pic_url ?? null,
        is_group: Boolean(c.is_group),
        tags: Array.isArray(c.tags) ? c.tags : [],
        created_at: c.created_at,
        // location e last_message_at não existem no schema padrão;
        // deixamos como undefined/null para compatibilidade com UI
        location: undefined,
        last_message_at: null,
      }))

      setContacts(mapped)
    } catch (err: any) {
      console.error('Erro ao carregar contatos:', err)
      setError(err.message || 'Erro ao carregar contatos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchContacts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, currentTenant?.id])

  return { contacts, loading, error, refresh: fetchContacts }
}
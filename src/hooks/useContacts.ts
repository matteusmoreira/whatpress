import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useTenant } from '@/hooks/useTenant'
import { useConsent } from '@/hooks/useConsent'
import { useEncryption } from '@/hooks/useEncryption'
import { useCache } from './useCache'
import { monitorDatabaseQuery, monitorFunction } from '@/lib/monitoring'
import { executeWithRetryAndCircuitBreaker, defaultCircuitBreakerConfigs } from '@/lib/circuitBreaker'

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
  has_consent?: boolean // Adiciona campo de consentimento
  is_encrypted?: boolean
}

interface UseContactsResult {
  contacts: Contact[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  checkContactConsent: (contactId: string) => Promise<boolean>
  recordContactConsent: (contactId: string, consentGiven: boolean, method?: 'whatsapp_opt_in' | 'manual_entry' | 'import') => Promise<boolean>
}

export function useContacts(): UseContactsResult {
  const { user } = useAuth()
  const { currentTenant } = useTenant()
  const { hasValidConsent, recordConsent } = useConsent()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const { encryptContactData, decryptContactData, isEncryptionAvailable } = useEncryption();
  const encryptionEnabled = isEncryptionAvailable;

  // Cache para contatos
  const { data: cachedContacts, mutate: mutateContacts } = useCache(
    user ? `contacts:${currentTenant?.id ?? user.id}` : '',
    async () => {
      if (!user) return []
      
      return monitorDatabaseQuery(
        async () => {
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
              return fallback.data || []
            } else {
              return data || []
            }
          } else {
            // Sem tenant ativo, usar filtro por usuário
            const { data, error } = await supabase
              .from('contacts')
              .select('*')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
            if (error) throw error
            return data || []
          }
        },
        {
          query: 'SELECT * FROM contacts ORDER BY created_at DESC',
          table: 'contacts',
          operation: 'select',
        }
      )
    },
    {
      ttl: 600, // 10 minutos
      enabled: !!user,
    }
  )

  /**
   * Verifica se um contato tem consentimento válido para mensagens WhatsApp
   */
  const checkContactConsent = async (contactId: string): Promise<boolean> => {
    if (!user) return false;
    
    return monitorFunction(
      async () => {
        try {
          const hasConsent = await hasValidConsent(contactId, 'whatsapp_messages');
          
          // Atualizar contato no estado com informação de consentimento
          setContacts(prev => prev.map(contact => 
            contact.id === contactId 
              ? { ...contact, has_consent: hasConsent }
              : contact
          ));
          
          return hasConsent;
        } catch (error) {
          console.error('Erro ao verificar consentimento do contato:', error);
          return false;
        }
      },
      {
        functionName: 'checkContactConsent',
        category: 'consent',
        metadata: { contactId }
      }
    )
  }

  /**
   * Registra consentimento de um contato
   */
  const recordContactConsent = async (
    contactId: string, 
    consentGiven: boolean, 
    method: 'whatsapp_opt_in' | 'manual_entry' | 'import' = 'manual_entry'
  ): Promise<boolean> => {
    if (!user) return false;
    
    return monitorFunction(
      async () => {
        try {
          const success = await recordConsent(contactId, 'whatsapp_messages', consentGiven, method);
          
          if (success) {
            // Atualizar contato no estado
            setContacts(prev => prev.map(contact => 
              contact.id === contactId 
                ? { ...contact, has_consent: consentGiven }
                : contact
            ));
          }
          
          return success;
        } catch (error) {
          console.error('Erro ao registrar consentimento do contato:', error);
          return false;
        }
      },
      {
        functionName: 'recordContactConsent',
        category: 'consent',
        metadata: { contactId, consentGiven, method }
      }
    )
  }

  // Atualizar contatos quando o cache mudar
  useEffect(() => {
    if (cachedContacts) {
      const processContacts = async () => {
        const mapped: Contact[] = await Promise.all(cachedContacts.map(async (c: any) => {
          // Descriptografa dados sensíveis se estiverem criptografados
          let contactData = c;
          if (c.is_encrypted && encryptionEnabled) {
            try {
              contactData = await decryptContactData(c);
            } catch (error) {
              console.error('Erro ao descriptografar contato:', error);
              // Mantém dados criptografados em caso de erro
            }
          }

          return {
            id: contactData.id,
            user_id: contactData.user_id,
            instance_id: contactData.instance_id,
            name: contactData.name || contactData.phone_number,
            phone: contactData.phone_number,
            profile_pic_url: contactData.profile_pic_url ?? null,
            is_group: Boolean(contactData.is_group),
            tags: Array.isArray(contactData.tags) ? contactData.tags : [],
            created_at: contactData.created_at,
            location: undefined,
            last_message_at: null,
            has_consent: undefined, // Será preenchido posteriormente
            is_encrypted: contactData.is_encrypted || false,
          };
        }))
        setContacts(mapped)
      }
      
      processContacts()
    }
  }, [cachedContacts, encryptionEnabled, decryptContactData])

  // Sincronizar loading com estado do cache
  useEffect(() => {
    setLoading(!cachedContacts && !!user)
  }, [cachedContacts, user])

  useEffect(() => {
    mutateContacts()
  }, [user?.id, currentTenant?.id])

  return {
    contacts,
    loading,
    error,
    refresh: () => mutateContacts(),
    checkContactConsent,
    recordContactConsent,
  }
}

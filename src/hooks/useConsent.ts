import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useSecurityAudit } from '@/services/securityAuditService';

export interface ConsentRecord {
  id?: string;
  contact_id: string;
  user_id?: string;
  tenant_id?: string;
  consent_type: 'whatsapp_messages' | 'marketing' | 'data_processing' | 'third_party_sharing';
  consent_given: boolean;
  consent_method: 'website_form' | 'whatsapp_opt_in' | 'manual_entry' | 'import';
  consent_timestamp: Date;
  ip_address?: string;
  user_agent?: string;
  withdrawal_timestamp?: Date | null;
  withdrawal_method?: string | null;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ConsentSettings {
  require_consent_for_messages: boolean;
  require_consent_for_marketing: boolean;
  consent_expiration_days: number;
  allow_import_without_consent: boolean;
  show_consent_banner: boolean;
}

export const useConsent = () => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { logEvent, logSuspiciousActivity } = useSecurityAudit();
  const [consentSettings, setConsentSettings] = useState<ConsentSettings | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * Carrega as configurações de consentimento do tenant
   */
  const loadConsentSettings = useCallback(async (): Promise<ConsentSettings | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('consent_settings')
        .select('*')
        .eq('tenant_id', currentTenant?.id)
        .single();

      if (error) {
        // Se não existir, criar configurações padrão
        const defaultSettings: ConsentSettings = {
          require_consent_for_messages: true,
          require_consent_for_marketing: true,
          consent_expiration_days: 365,
          allow_import_without_consent: false,
          show_consent_banner: true
        };

        await saveConsentSettings(defaultSettings);
        return defaultSettings;
      }

      return data as ConsentSettings;
    } catch (error) {
      console.error('Erro ao carregar configurações de consentimento:', error);
      return null;
    }
  }, [user, currentTenant?.id]);

  /**
   * Salva as configurações de consentimento
   */
  const saveConsentSettings = useCallback(async (settings: ConsentSettings): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('consent_settings')
        .upsert({
          tenant_id: currentTenant?.id,
          ...settings,
          updated_at: new Date().toISOString()
        });

      if (error) {
        const msg = String(error.message || '')
        if (msg.includes('Could not find the table')) {
          setConsentSettings(settings)
          return true
        }
        throw error;
      }

      setConsentSettings(settings);
      
      await logEvent({
        action: 'consent_settings_updated',
        resource_type: 'consent_settings',
        status: 'success',
        metadata: settings
      });

      return true;
    } catch (error) {
      console.error('Erro ao salvar configurações de consentimento:', error);
      return false;
    }
  }, [user, currentTenant?.id, logEvent]);

  /**
   * Registra consentimento de um contato
   */
  const recordConsent = useCallback(async (
    contactId: string,
    consentType: ConsentRecord['consent_type'],
    consentGiven: boolean,
    method: ConsentRecord['consent_method'],
    notes?: string
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const consentRecord: Omit<ConsentRecord, 'id' | 'created_at' | 'updated_at'> = {
        contact_id: contactId,
        user_id: user.id,
        tenant_id: currentTenant?.id,
        consent_type: consentType,
        consent_given: consentGiven,
        consent_method: method,
        consent_timestamp: new Date(),
        ip_address: undefined,
        user_agent: navigator.userAgent,
        withdrawal_timestamp: null,
        withdrawal_method: null,
        notes
      };

      const { error } = await supabase
        .from('contact_consents')
        .insert([consentRecord]);

      if (error) throw error;

      await logEvent({
        action: consentGiven ? 'consent_given' : 'consent_refused',
        resource_type: 'contact_consent',
        resource_id: contactId,
        status: 'success',
        metadata: {
          consent_type: consentType,
          method: method,
          notes
        }
      });

      return true;
    } catch (error) {
      console.error('Erro ao registrar consentimento:', error);
      return false;
    }
  }, [user, currentTenant?.id, logEvent]);

  /**
   * Revoga consentimento de um contato
   */
  const revokeConsent = useCallback(async (
    contactId: string,
    consentType: ConsentRecord['consent_type'],
    method: string = 'manual_withdrawal'
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      // Atualizar consentimento existente
      const { error } = await supabase
        .from('contact_consents')
        .update({
          consent_given: false,
          withdrawal_timestamp: new Date().toISOString(),
          withdrawal_method: method,
          updated_at: new Date().toISOString()
        })
        .eq('contact_id', contactId)
        .eq('consent_type', consentType)
        .eq('consent_given', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      await logEvent({
        action: 'consent_withdrawn',
        resource_type: 'contact_consent',
        resource_id: contactId,
        status: 'success',
        metadata: {
          consent_type: consentType,
          method: method
        }
      });

      return true;
    } catch (error) {
      console.error('Erro ao revogar consentimento:', error);
      return false;
    }
  }, [user, logEvent]);

  /**
   * Verifica se um contato tem consentimento válido
   */
  const hasValidConsent = useCallback(async (
    contactId: string,
    consentType: ConsentRecord['consent_type']
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      // Primeiro, verificar configurações do tenant
      const settings = await loadConsentSettings();
      if (!settings?.require_consent_for_messages && consentType === 'whatsapp_messages') {
        return true; // Consentimento não é obrigatório
      }

      if (!settings?.require_consent_for_marketing && consentType === 'marketing') {
        return true; // Consentimento não é obrigatório
      }

      // Buscar consentimento mais recente
      const { data, error } = await supabase
        .from('contact_consents')
        .select('*')
        .eq('contact_id', contactId)
        .eq('consent_type', consentType)
        .order('consent_timestamp', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) return false;

      const consent = data as ConsentRecord;

      // Verificar se foi revogado
      if (consent.withdrawal_timestamp) {
        return false;
      }

      // Verificar expiração
      if (settings?.consent_expiration_days) {
        const expirationDate = new Date(consent.consent_timestamp);
        expirationDate.setDate(expirationDate.getDate() + settings.consent_expiration_days);
        
        if (expirationDate < new Date()) {
          return false; // Consentimento expirado
        }
      }

      return consent.consent_given;
    } catch (error) {
      console.error('Erro ao verificar consentimento:', error);
      return false;
    }
  }, [user, loadConsentSettings]);

  /**
   * Busca histórico de consentimentos de um contato
   */
  const getContactConsentHistory = useCallback(async (
    contactId: string
  ): Promise<ConsentRecord[]> => {
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('contact_consents')
        .select('*')
        .eq('contact_id', contactId)
        .order('consent_timestamp', { ascending: false });

      if (error) throw error;

      return (data || []).map(record => ({
        ...record,
        consent_timestamp: new Date(record.consent_timestamp),
        withdrawal_timestamp: record.withdrawal_timestamp ? new Date(record.withdrawal_timestamp) : null
      }));
    } catch (error) {
      console.error('Erro ao buscar histórico de consentimentos:', error);
      return [];
    }
  }, [user]);

  /**
   * Processa importação de contatos com consentimento
   */
  const processBulkImportWithConsent = useCallback(async (
    contacts: Array<{
      phone: string;
      name?: string;
      email?: string;
      consent_given?: boolean;
      consent_method?: ConsentRecord['consent_method'];
    }>
  ): Promise<{
    imported: number;
    withConsent: number;
    withoutConsent: number;
    errors: string[];
  }> => {
    if (!user) return { imported: 0, withConsent: 0, withoutConsent: 0, errors: [] };

    setLoading(true);
    const result = {
      imported: 0,
      withConsent: 0,
      withoutConsent: 0,
      errors: [] as string[]
    };

    try {
      const settings = await loadConsentSettings();
      
      for (const contact of contacts) {
        try {
          // Criar contato
          const { data: contactData, error: contactError } = await supabase
            .from('contacts')
            .insert([{
              phone_number: contact.phone,
              name: contact.name,
              email: contact.email,
              user_id: user.id,
              tenant_id: currentTenant?.id
            }])
            .select()
            .single();

          if (contactError) throw contactError;

          result.imported++;

          // Registrar consentimento se fornecido
          if (contact.consent_given && contact.consent_method) {
            await recordConsent(
              contactData.id,
              'whatsapp_messages',
              true,
              contact.consent_method,
              'Consentimento fornecido durante importação'
            );
            result.withConsent++;
          } else if (settings?.require_consent_for_messages && !settings?.allow_import_without_consent) {
            result.withoutConsent++;
            result.errors.push(`Contato ${contact.phone} importado sem consentimento obrigatório`);
          }

        } catch (error) {
          result.errors.push(`Erro ao importar ${contact.phone}: ${error}`);
        }
      }

      await logEvent({
        action: 'bulk_contact_import',
        resource_type: 'contact',
        status: 'success',
        metadata: {
          total_imported: result.imported,
          with_consent: result.withConsent,
          without_consent: result.withoutConsent,
          errors_count: result.errors.length
        }
      });

    } catch (error) {
      console.error('Erro ao processar importação em massa:', error);
      result.errors.push('Erro geral no processamento');
    } finally {
      setLoading(false);
    }

    return result;
  }, [user, currentTenant?.id, loadConsentSettings, recordConsent, logEvent]);

  /**
   * Gera relatório de compliance
   */
  const generateComplianceReport = useCallback(async (
    startDate: Date,
    endDate: Date
  ): Promise<{
    total_contacts: number;
    with_consent: number;
    without_consent: number;
    expired_consent: number;
    consent_by_type: Record<string, number>;
  }> => {
    if (!user) return {
      total_contacts: 0,
      with_consent: 0,
      without_consent: 0,
      expired_consent: 0,
      consent_by_type: {}
    };

    try {
      // Buscar estatísticas de consentimento
      const { data, error } = await supabase
        .rpc('get_consent_statistics', {
          p_tenant_id: currentTenant?.id,
          p_start_date: startDate.toISOString(),
          p_end_date: endDate.toISOString()
        });

      if (error) throw error;

      return data || {
        total_contacts: 0,
        with_consent: 0,
        without_consent: 0,
        expired_consent: 0,
        consent_by_type: {}
      };
    } catch (error) {
      console.error('Erro ao gerar relatório de compliance:', error);
      return {
        total_contacts: 0,
        with_consent: 0,
        without_consent: 0,
        expired_consent: 0,
        consent_by_type: {}
      };
    }
  }, [user, currentTenant?.id]);

  // Carregar configurações ao montar
  useEffect(() => {
    if (user) {
      loadConsentSettings().then(setConsentSettings);
    }
  }, [user, loadConsentSettings]);

  // Função auxiliar para obter IP do cliente
  const getClientIP = async (): Promise<string> => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return 'unknown';
    }
  };

  return {
    consentSettings,
    loading,
    recordConsent,
    revokeConsent,
    hasValidConsent,
    getContactConsentHistory,
    processBulkImportWithConsent,
    generateComplianceReport,
    saveConsentSettings,
    loadConsentSettings
  };
};

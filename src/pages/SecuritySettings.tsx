import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Lock, Eye, Download, RefreshCw, Save, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useConsent } from '@/hooks/useConsent';
import { useSecurityAudit } from '@/services/securityAuditService';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface SecuritySettings {
  encryption_enabled: boolean;
  rate_limit_enabled: boolean;
  security_audit_enabled: boolean;
  max_login_attempts: number;
  session_timeout_minutes: number;
  password_min_length: number;
  require_special_chars: boolean;
  require_numbers: boolean;
  require_uppercase: boolean;
  two_factor_enabled: boolean;
  backup_frequency: string;
  retention_days: number;
}

interface ConsentSettings {
  show_consent_banner: boolean;
  require_consent_for_messages: boolean;
  require_consent_for_marketing: boolean;
  consent_banner_text: string;
  privacy_policy_url: string;
  terms_of_service_url: string;
}

export default function SecuritySettingsPage() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { consentSettings, saveConsentSettings } = useConsent();
  const { logEvent } = useSecurityAudit();
  
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>({
    encryption_enabled: true,
    rate_limit_enabled: true,
    security_audit_enabled: true,
    max_login_attempts: 5,
    session_timeout_minutes: 30,
    password_min_length: 8,
    require_special_chars: true,
    require_numbers: true,
    require_uppercase: true,
    two_factor_enabled: false,
    backup_frequency: 'daily',
    retention_days: 90
  });

  const [consentConfig, setConsentConfig] = useState<ConsentSettings>({
    show_consent_banner: true,
    require_consent_for_messages: true,
    require_consent_for_marketing: true,
    consent_banner_text: 'Respeitamos sua privacidade em conformidade com a LGPD.',
    privacy_policy_url: '',
    terms_of_service_url: ''
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (consentSettings) {
      setConsentConfig({
        show_consent_banner: consentSettings.show_consent_banner || false,
        require_consent_for_messages: consentSettings.require_consent_for_messages || false,
        require_consent_for_marketing: consentSettings.require_consent_for_marketing || false,
        consent_banner_text: consentSettings.consent_banner_text || '',
        privacy_policy_url: consentSettings.privacy_policy_url || '',
        terms_of_service_url: consentSettings.terms_of_service_url || ''
      });
    }
  }, [consentSettings]);

  const loadSecuritySettings = async () => {
    if (!currentTenant?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tenant_settings')
        .select('security_settings')
        .eq('tenant_id', currentTenant.id)
        .single();

      if (error) throw error;

      if (data?.security_settings) {
        setSecuritySettings(data.security_settings);
      }

      await logEvent({
        action: 'security_settings_loaded',
        resource_type: 'tenant_settings',
        resource_id: currentTenant.id,
        status: 'success'
      });

    } catch (error) {
      console.error('Erro ao carregar configurações de segurança:', error);
      toast.error('Erro ao carregar configurações de segurança');

      await logEvent({
        action: 'security_settings_load_failed',
        resource_type: 'tenant_settings',
        resource_id: currentTenant.id,
        status: 'error',
        error_message: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSecuritySettings = async () => {
    if (!currentTenant?.id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('tenant_settings')
        .upsert({
          tenant_id: currentTenant.id,
          security_settings: securitySettings,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      toast.success('Configurações de segurança salvas com sucesso');

      await logEvent({
        action: 'security_settings_updated',
        resource_type: 'tenant_settings',
        resource_id: currentTenant.id,
        status: 'success',
        metadata: securitySettings
      });

    } catch (error) {
      console.error('Erro ao salvar configurações de segurança:', error);
      toast.error('Erro ao salvar configurações de segurança');

      await logEvent({
        action: 'security_settings_update_failed',
        resource_type: 'tenant_settings',
        resource_id: currentTenant.id,
        status: 'error',
        error_message: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    } finally {
      setSaving(false);
    }
  };

  const saveConsentSettings = async () => {
    if (!currentTenant?.id) return;

    setSaving(true);
    try {
      await saveConsentSettings({
        tenant_id: currentTenant.id,
        ...consentConfig
      });

      toast.success('Configurações de consentimento salvas com sucesso');

      await logEvent({
        action: 'consent_settings_updated',
        resource_type: 'consent_settings',
        resource_id: currentTenant.id,
        status: 'success',
        metadata: consentConfig
      });

    } catch (error) {
      console.error('Erro ao salvar configurações de consentimento:', error);
      toast.error('Erro ao salvar configurações de consentimento');

      await logEvent({
        action: 'consent_settings_update_failed',
        resource_type: 'consent_settings',
        resource_id: currentTenant.id,
        status: 'error',
        error_message: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    } finally {
      setSaving(false);
    }
  };

  const exportSecurityAudit = async () => {
    if (!currentTenant?.id) return;

    try {
      const { data, error } = await supabase
        .from('security_audit_logs')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false })
        .limit(10000);

      if (error) throw error;

      const csvContent = [
        'Data,Ação,Usuário,Recurso,Status,IP,Erro',
        ...data.map(log => [
          log.created_at,
          log.action,
          log.user_id,
          `${log.resource_type}:${log.resource_id}`,
          log.status,
          log.ip_address,
          log.error_message || ''
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `security_audit_${currentTenant.id}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Relatório de auditoria exportado com sucesso');

      await logEvent({
        action: 'security_audit_exported',
        resource_type: 'security_audit_logs',
        resource_id: currentTenant.id,
        status: 'success'
      });

    } catch (error) {
      console.error('Erro ao exportar auditoria:', error);
      toast.error('Erro ao exportar relatório de auditoria');

      await logEvent({
        action: 'security_audit_export_failed',
        resource_type: 'security_audit_logs',
        resource_id: currentTenant.id,
        status: 'error',
        error_message: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  };

  useEffect(() => {
    loadSecuritySettings();
  }, [currentTenant?.id]);

  if (!user || !currentTenant) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-8 w-8 text-blue-600" />
          Segurança e Privacidade
        </h1>
        <Button
          onClick={() => {
            saveSecuritySettings();
            saveConsentSettings();
          }}
          disabled={saving}
          className="flex items-center gap-2"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar Todas'}
        </Button>
      </div>

      {/* Configurações de Segurança */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Configurações de Segurança
          </CardTitle>
          <CardDescription>
            Configure as políticas de segurança do seu tenant
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="encryption_enabled">Criptografia de Dados</Label>
                <Switch
                  id="encryption_enabled"
                  checked={securitySettings.encryption_enabled}
                  onCheckedChange={(checked) => 
                    setSecuritySettings(prev => ({ ...prev, encryption_enabled: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="rate_limit_enabled">Rate Limiting</Label>
                <Switch
                  id="rate_limit_enabled"
                  checked={securitySettings.rate_limit_enabled}
                  onCheckedChange={(checked) => 
                    setSecuritySettings(prev => ({ ...prev, rate_limit_enabled: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="security_audit_enabled">Auditoria de Segurança</Label>
                <Switch
                  id="security_audit_enabled"
                  checked={securitySettings.security_audit_enabled}
                  onCheckedChange={(checked) => 
                    setSecuritySettings(prev => ({ ...prev, security_audit_enabled: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="two_factor_enabled">Autenticação de Dois Fatores</Label>
                <Switch
                  id="two_factor_enabled"
                  checked={securitySettings.two_factor_enabled}
                  onCheckedChange={(checked) => 
                    setSecuritySettings(prev => ({ ...prev, two_factor_enabled: checked }))
                  }
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="max_login_attempts">Máximo de Tentativas de Login</Label>
                <Input
                  id="max_login_attempts"
                  type="number"
                  min="1"
                  max="10"
                  value={securitySettings.max_login_attempts}
                  onChange={(e) => 
                    setSecuritySettings(prev => ({ ...prev, max_login_attempts: parseInt(e.target.value) }))
                  }
                />
              </div>

              <div>
                <Label htmlFor="session_timeout_minutes">Timeout de Sessão (minutos)</Label>
                <Input
                  id="session_timeout_minutes"
                  type="number"
                  min="5"
                  max="480"
                  value={securitySettings.session_timeout_minutes}
                  onChange={(e) => 
                    setSecuritySettings(prev => ({ ...prev, session_timeout_minutes: parseInt(e.target.value) }))
                  }
                />
              </div>

              <div>
                <Label htmlFor="retention_days">Retenção de Logs (dias)</Label>
                <Input
                  id="retention_days"
                  type="number"
                  min="7"
                  max="365"
                  value={securitySettings.retention_days}
                  onChange={(e) => 
                    setSecuritySettings(prev => ({ ...prev, retention_days: parseInt(e.target.value) }))
                  }
                />
              </div>

              <div>
                <Label htmlFor="backup_frequency">Frequência de Backup</Label>
                <Select
                  value={securitySettings.backup_frequency}
                  onValueChange={(value) => 
                    setSecuritySettings(prev => ({ ...prev, backup_frequency: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">A cada hora</SelectItem>
                    <SelectItem value="daily">Diário</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">Requisitos de Senha</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="require_special_chars">Caracteres Especiais</Label>
                <Switch
                  id="require_special_chars"
                  checked={securitySettings.require_special_chars}
                  onCheckedChange={(checked) => 
                    setSecuritySettings(prev => ({ ...prev, require_special_chars: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="require_numbers">Números</Label>
                <Switch
                  id="require_numbers"
                  checked={securitySettings.require_numbers}
                  onCheckedChange={(checked) => 
                    setSecuritySettings(prev => ({ ...prev, require_numbers: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="require_uppercase">Maiúsculas</Label>
                <Switch
                  id="require_uppercase"
                  checked={securitySettings.require_uppercase}
                  onCheckedChange={(checked) => 
                    setSecuritySettings(prev => ({ ...prev, require_uppercase: checked }))
                  }
                />
              </div>
            </div>

            <div className="mt-3">
              <Label htmlFor="password_min_length">Comprimento Mínimo da Senha</Label>
              <Input
                id="password_min_length"
                type="number"
                min="4"
                max="32"
                value={securitySettings.password_min_length}
                onChange={(e) => 
                  setSecuritySettings(prev => ({ ...prev, password_min_length: parseInt(e.target.value) }))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configurações de Consentimento LGPD */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Configurações de Consentimento LGPD
          </CardTitle>
          <CardDescription>
            Configure o banner de consentimento e políticas de privacidade
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="show_consent_banner">Mostrar Banner de Consentimento</Label>
                <Switch
                  id="show_consent_banner"
                  checked={consentConfig.show_consent_banner}
                  onCheckedChange={(checked) => 
                    setConsentConfig(prev => ({ ...prev, show_consent_banner: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="require_consent_for_messages">Exigir Consentimento para Mensagens</Label>
                <Switch
                  id="require_consent_for_messages"
                  checked={consentConfig.require_consent_for_messages}
                  onCheckedChange={(checked) => 
                    setConsentConfig(prev => ({ ...prev, require_consent_for_messages: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="require_consent_for_marketing">Exigir Consentimento para Marketing</Label>
                <Switch
                  id="require_consent_for_marketing"
                  checked={consentConfig.require_consent_for_marketing}
                  onCheckedChange={(checked) => 
                    setConsentConfig(prev => ({ ...prev, require_consent_for_marketing: checked }))
                  }
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="privacy_policy_url">URL da Política de Privacidade</Label>
                <Input
                  id="privacy_policy_url"
                  type="url"
                  placeholder="https://seusite.com/privacidade"
                  value={consentConfig.privacy_policy_url}
                  onChange={(e) => 
                    setConsentConfig(prev => ({ ...prev, privacy_policy_url: e.target.value }))
                  }
                />
              </div>

              <div>
                <Label htmlFor="terms_of_service_url">URL dos Termos de Serviço</Label>
                <Input
                  id="terms_of_service_url"
                  type="url"
                  placeholder="https://seusite.com/termos"
                  value={consentConfig.terms_of_service_url}
                  onChange={(e) => 
                    setConsentConfig(prev => ({ ...prev, terms_of_service_url: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="consent_banner_text">Texto do Banner de Consentimento</Label>
            <Textarea
              id="consent_banner_text"
              rows={3}
              placeholder="Digite o texto que será exibido no banner de consentimento..."
              value={consentConfig.consent_banner_text}
              onChange={(e) => 
                setConsentConfig(prev => ({ ...prev, consent_banner_text: e.target.value }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Ações de Segurança */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Ações de Segurança
          </CardTitle>
          <CardDescription>
            Ferramentas administrativas de segurança
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <Button
              onClick={exportSecurityAudit}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Exportar Auditoria
            </Button>

            <Button
              onClick={() => {
                // Implementar rotação de chaves de criptografia
                toast.info('Rotação de chaves não implementada ainda');
              }}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Rotacionar Chaves
            </Button>

            <Button
              onClick={() => {
                // Implementar limpeza de logs antigos
                toast.info('Limpeza de logs não implementada ainda');
              }}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Limpar Logs Antigos
            </Button>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-800">Aviso de Segurança</h4>
                <p className="text-sm text-yellow-700 mt-1">
                  Certifique-se de manter suas configurações de segurança atualizadas e realizar backups 
                  regulares dos seus dados. A criptografia e auditoria ajudam a proteger informações 
                  sensíveis em conformidade com a LGPD.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
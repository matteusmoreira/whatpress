import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { 
  Settings, 
  Users, 
  MessageSquare, 
  Zap, 
  Smartphone,
  Save,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  Shield,
  Bell,
  History,
  Crown,
  CheckCircle
} from 'lucide-react';
import { useQuotas } from '@/hooks/useQuotas';
import { useTenant } from '@/hooks/useTenant';
import { AdminOnly } from '@/components/RoleGuard';
import { QuotaProgressGrid } from '@/components/ui/quota-progress';
import { QuotaAlertList, QuotaCriticalBanner } from '@/components/ui/quota-alert';
import { toast } from 'sonner';
import { useRoleContext } from '@/contexts/RoleContext';
import { QuotaAlertsManager } from '@/components/QuotaAlertsManager';

interface QuotaLimitsForm {
  max_users: number;
  max_contacts: number;
  max_campaigns: number;
  max_connections: number;
  alert_85_enabled: boolean;
  alert_100_enabled: boolean;
}

const QuotaManagement: React.FC = () => {
  const { currentTenant } = useTenant();
  const { 
    quota, 
    alerts, 
    loading, 
    error, 
    updateQuotaLimits, 
    acknowledgeAlert,
    refreshQuota 
  } = useQuotas();
  const { logAction } = useRoleContext();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [formData, setFormData] = useState<QuotaLimitsForm>({
    max_users: quota?.max_users || 5,
    max_contacts: quota?.max_contacts || 1000,
    max_campaigns: quota?.max_campaigns || 10,
    max_connections: quota?.max_connections || 1,
    alert_85_enabled: quota?.alert_85_enabled || true,
    alert_100_enabled: quota?.alert_100_enabled || true,
  });

  // Atualizar form quando quota carrega
  React.useEffect(() => {
    if (quota) {
      setFormData({
        max_users: quota.max_users,
        max_contacts: quota.max_contacts,
        max_campaigns: quota.max_campaigns,
        max_connections: quota.max_connections,
        alert_85_enabled: quota.alert_85_enabled,
        alert_100_enabled: quota.alert_100_enabled,
      });
    }
  }, [quota]);

  const handleSave = async () => {
    if (!quota) return;

    try {
      setSaving(true);
      await updateQuotaLimits(formData);
      setIsEditing(false);
      toast.success('Limites de quota atualizados com sucesso!');
      // Auditoria cliente
      logAction('update_quota_limits', 'quotas', { tenantId: currentTenant?.id, ...formData, result: 'success' }).catch(() => {});
    } catch (error: any) {
      console.error('Erro ao atualizar quotas:', error);
      toast.error('Erro ao atualizar limites de quota');
      // Auditoria cliente (erro)
      logAction('update_quota_limits', 'quotas', { tenantId: currentTenant?.id, ...formData, result: 'error', error: String(error?.message || error) }).catch(() => {});
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (quota) {
      setFormData({
        max_users: quota.max_users,
        max_contacts: quota.max_contacts,
        max_campaigns: quota.max_campaigns,
        max_connections: quota.max_connections,
        alert_85_enabled: quota.alert_85_enabled,
        alert_100_enabled: quota.alert_100_enabled,
      });
    }
    setIsEditing(false);
    // Auditoria cliente
    logAction('cancel_quota_edit', 'quotas', { tenantId: currentTenant?.id }).catch(() => {});
  };

  const handleRefresh = async () => {
    try {
      await refreshQuota();
      toast.success('Dados de quota atualizados!');
      // Auditoria cliente
      logAction('refresh_quota', 'quotas', { tenantId: currentTenant?.id, result: 'success' }).catch(() => {});
    } catch (error: any) {
      toast.error('Erro ao atualizar dados');
      // Auditoria cliente (erro)
      logAction('refresh_quota', 'quotas', { tenantId: currentTenant?.id, result: 'error', error: String(error?.message || error) }).catch(() => {});
    }
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await acknowledgeAlert(alertId);
      toast.success('Alerta reconhecido');
      // Auditoria cliente
      logAction('acknowledge_quota_alert', 'quotas', { tenantId: currentTenant?.id, alertId, result: 'success' }).catch(() => {});
    } catch (error: any) {
      toast.error('Erro ao reconhecer alerta');
      // Auditoria cliente (erro)
      logAction('acknowledge_quota_alert', 'quotas', { tenantId: currentTenant?.id, alertId, result: 'error', error: String(error?.message || error) }).catch(() => {});
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Erro ao carregar dados de quota: {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!quota) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Nenhuma quota encontrada para este tenant.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const criticalAlerts = alerts.filter(alert => alert.alert_type === '100_percent');
  const warningAlerts = alerts.filter(alert => alert.alert_type === '85_percent');

  return (
    <AdminOnly>
      <div className="container mx-auto p-6 space-y-6">
      <QuotaAlertsManager autoAcknowledge={false} />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gerenciamento de Quotas</h1>
          <p className="text-muted-foreground">
            Monitore e configure os limites de uso do seu plano
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          
          {currentTenant?.plan && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Crown className="h-3 w-3" />
              Plano {currentTenant.plan}
            </Badge>
          )}
        </div>
      </div>

      {/* Alertas Críticos */}
      {criticalAlerts.length > 0 && (
        <QuotaCriticalBanner
          alerts={criticalAlerts}
          onAcknowledge={handleAcknowledgeAlert}
        />
      )}

      {/* Visão Geral das Quotas */}
      <QuotaProgressGrid quota={quota} />

      {/* Tabs de Gerenciamento */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="limits" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Limites
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Alertas ({alerts.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        {/* Tab: Visão Geral */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Status Geral */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Status do Sistema
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status Geral</span>
                  <Badge 
                    variant={criticalAlerts.length > 0 ? "destructive" : 
                            warningAlerts.length > 0 ? "secondary" : "default"}
                  >
                    {criticalAlerts.length > 0 ? "Crítico" :
                     warningAlerts.length > 0 ? "Atenção" : "Normal"}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Alertas Ativos</span>
                  <span className="text-sm text-muted-foreground">
                    {alerts.length}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Recursos Bloqueados</span>
                  <span className="text-sm text-muted-foreground">
                    {quota.blocked_features?.length || 0}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Última Atualização</span>
                  <span className="text-sm text-muted-foreground">
                    {new Date(quota.updated_at).toLocaleString('pt-BR')}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Resumo de Uso */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Resumo de Uso
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">Usuários</span>
                    </div>
                    <span className="text-sm font-medium">
                      {quota.current_users}/{quota.max_users}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Contatos</span>
                    </div>
                    <span className="text-sm font-medium">
                      {quota.current_contacts}/{quota.max_contacts}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-purple-500" />
                      <span className="text-sm">Campanhas</span>
                    </div>
                    <span className="text-sm font-medium">
                      {quota.current_campaigns}/{quota.max_campaigns}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-orange-500" />
                      <span className="text-sm">Conexões</span>
                    </div>
                    <span className="text-sm font-medium">
                      {quota.current_connections}/{quota.max_connections}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Configuração de Limites */}
        <TabsContent value="limits" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Configuração de Limites</CardTitle>
                  <CardDescription>
                    Defina os limites máximos para cada recurso
                  </CardDescription>
                </div>
                
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancel}
                        disabled={isSaving}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Salvar
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => setIsEditing(true)}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Editar Limites
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Limites de Recursos */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Limites de Recursos</h3>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="max_users">Máximo de Usuários</Label>
                      <Input
                        id="max_users"
                        type="number"
                        min="1"
                        value={formData.max_users}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          max_users: parseInt(e.target.value) || 1
                        }))}
                        disabled={!isEditing}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="max_contacts">Máximo de Contatos</Label>
                      <Input
                        id="max_contacts"
                        type="number"
                        min="1"
                        value={formData.max_contacts}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          max_contacts: parseInt(e.target.value) || 1
                        }))}
                        disabled={!isEditing}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="max_campaigns">Máximo de Campanhas</Label>
                      <Input
                        id="max_campaigns"
                        type="number"
                        min="1"
                        value={formData.max_campaigns}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          max_campaigns: parseInt(e.target.value) || 1
                        }))}
                        disabled={!isEditing}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="max_connections">Máximo de Conexões</Label>
                      <Input
                        id="max_connections"
                        type="number"
                        min="1"
                        value={formData.max_connections}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          max_connections: parseInt(e.target.value) || 1
                        }))}
                        disabled={!isEditing}
                      />
                    </div>
                  </div>
                </div>

                {/* Configurações de Alertas */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Configurações de Alertas</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Alerta aos 85%</Label>
                        <p className="text-sm text-muted-foreground">
                          Receber alertas quando atingir 85% do limite
                        </p>
                      </div>
                      <Switch
                        checked={formData.alert_85_enabled}
                        onCheckedChange={(checked) => setFormData(prev => ({
                          ...prev,
                          alert_85_enabled: checked
                        }))}
                        disabled={!isEditing}
                      />
                    </div>
                    
                    <Separator />
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Alerta aos 100%</Label>
                        <p className="text-sm text-muted-foreground">
                          Receber alertas quando atingir 100% do limite
                        </p>
                      </div>
                      <Switch
                        checked={formData.alert_100_enabled}
                        onCheckedChange={(checked) => setFormData(prev => ({
                          ...prev,
                          alert_100_enabled: checked
                        }))}
                        disabled={!isEditing}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Alertas */}
        <TabsContent value="alerts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Alertas Ativos
              </CardTitle>
              <CardDescription>
                Gerencie os alertas de quota do seu sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <QuotaAlertList
                alerts={alerts}
                onAcknowledge={handleAcknowledgeAlert}
                showEmpty={true}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Histórico */}
        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Histórico de Alertas
              </CardTitle>
              <CardDescription>
                Visualize o histórico de alertas e mudanças de quota
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Em Desenvolvimento</h3>
                <p className="text-sm text-muted-foreground">
                  O histórico detalhado de alertas estará disponível em breve.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </AdminOnly>
  );
};

export default QuotaManagement;
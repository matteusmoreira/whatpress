import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { 
  Gauge, 
  Clock, 
  Zap, 
  Shield, 
  Settings,
  Plus,
  Trash2,
  Save,
  Play,
  Pause,
  AlertTriangle,
  CheckCircle,
  Timer,
  BarChart3,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { useRateLimit, RateLimitConfig } from '@/hooks/useRateLimit';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RateLimitConfigProps {
  instanceId?: string;
  onConfigSelect?: (config: RateLimitConfig) => void;
}

export const RateLimitConfigComponent: React.FC<RateLimitConfigProps> = ({
  instanceId,
  onConfigSelect
}) => {
  const { toast } = useToast();
  const {
    configs,
    activeConfigs,
    rateLimitStatuses,
    isLoading,
    createConfig,
    updateConfig,
    deleteConfig,
    activateConfig,
    deactivateConfig,
    canSendMessage,
    getRemainingQuota,
    getNextAllowedTime,
    getStatus,
    refreshData
  } = useRateLimit();

  const [selectedConfig, setSelectedConfig] = useState<RateLimitConfig | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingConfig, setEditingConfig] = useState<Partial<RateLimitConfig> | null>(null);
  const [testInstanceId, setTestInstanceId] = useState<string>('');

  const defaultConfig: Partial<RateLimitConfig> = {
    name: '',
    description: '',
    messages_per_minute: 2,
    messages_per_hour: 100,
    messages_per_day: 1000,
    burst_limit: 5,
    burst_window_seconds: 60,
    cooldown_after_burst_minutes: 5,
    time_window_start: '09:00',
    time_window_end: '18:00',
    allowed_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    adaptive_rate_enabled: true,
    adaptive_rate_factor: 0.8,
    adaptive_rate_recovery_minutes: 30,
    priority_multiplier: 1.0,
    is_active: true
  };

  useEffect(() => {
    if (instanceId) {
      setTestInstanceId(instanceId);
    }
  }, [instanceId]);

  const handleCreateConfig = async () => {
    if (!editingConfig) return;

    try {
      const success = await createConfig(editingConfig as Omit<RateLimitConfig, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>);
      
      if (success) {
        setEditingConfig(null);
        setShowCreateForm(false);
        toast({
          title: "Sucesso",
          description: "Configuração de rate limit criada com sucesso"
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao criar configuração de rate limit",
        variant: "destructive"
      });
    }
  };

  const handleUpdateConfig = async (config: RateLimitConfig) => {
    try {
      const success = await updateConfig(config.id, config);
      
      if (success) {
        toast({
          title: "Sucesso",
          description: "Configuração atualizada com sucesso"
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao atualizar configuração",
        variant: "destructive"
      });
    }
  };

  const handleDeleteConfig = async (configId: string) => {
    try {
      const success = await deleteConfig(configId);
      
      if (success) {
        toast({
          title: "Sucesso",
          description: "Configuração removida com sucesso"
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao remover configuração",
        variant: "destructive"
      });
    }
  };

  const handleToggleConfig = async (config: RateLimitConfig) => {
    try {
      const isActive = activeConfigs.some(ac => ac.id === config.id);
      let success = false;
      
      if (isActive) {
        success = await deactivateConfig(config.id);
      } else {
        success = await activateConfig(config.id);
      }
      
      if (success) {
        toast({
          title: "Sucesso",
          description: `Configuração ${isActive ? 'desativada' : 'ativada'} com sucesso`
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao alterar status da configuração",
        variant: "destructive"
      });
    }
  };

  const updateEditingConfig = (updates: Partial<RateLimitConfig>) => {
    setEditingConfig(prev => ({ ...prev, ...updates }));
  };

  const getConfigStatus = (config: RateLimitConfig) => {
    const isActive = activeConfigs.some(ac => ac.id === config.id);
    const status = rateLimitStatuses.find(s => s.config_id === config.id);
    const scopeKey = config.scope;
    const targetKey = testInstanceId || config.target_id;
    
    return {
      isActive,
      status,
      canSend: canSendMessage(scopeKey, targetKey),
      remaining: getRemainingQuota(scopeKey, targetKey),
      nextAllowed: getNextAllowedTime(scopeKey, targetKey)
    };
  };

  const calculateUsagePercentage = (
    status: { messages_sent_hour: number; messages_sent_day: number }, 
    config: RateLimitConfig
  ): number => {
    const hourlyUsage = (status.messages_sent_hour / Math.max(config.messages_per_hour || 1, 1)) * 100;
    const dailyUsage = (status.messages_sent_day / Math.max(config.messages_per_day || 1, 1)) * 100;
    return Math.max(hourlyUsage, dailyUsage);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Gauge className="h-5 w-5" />
                Configuração de Rate Limiting
              </CardTitle>
              <CardDescription>
                Controle inteligente de velocidade de envio de mensagens
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => {
                setEditingConfig(defaultConfig);
                setShowCreateForm(true);
              }} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Nova Configuração
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="configs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="configs">Configurações</TabsTrigger>
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoramento</TabsTrigger>
        </TabsList>

        <TabsContent value="configs" className="space-y-4">
          {configs.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-64">
                <Gauge className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma configuração encontrada</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Crie sua primeira configuração de rate limiting
                </p>
                <Button onClick={() => {
                  setEditingConfig(defaultConfig);
                  setShowCreateForm(true);
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Configuração
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {configs.map((config) => {
                const configStatus = getConfigStatus(config);
                const usage = configStatus.status ? calculateUsagePercentage(configStatus.status, config) : 0;
                
                return (
                  <Card key={config.id} className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => {
                          setSelectedConfig(config);
                          onConfigSelect?.(config);
                        }}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${configStatus.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                          <div>
                            <CardTitle className="text-lg">{config.name}</CardTitle>
                            <CardDescription>{config.description}</CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={configStatus.isActive ? 'default' : 'secondary'}>
                            {configStatus.isActive ? (
                              <>
                                <Play className="h-3 w-3 mr-1" />
                                Ativa
                              </>
                            ) : (
                              <>
                                <Pause className="h-3 w-3 mr-1" />
                                Inativa
                              </>
                            )}
                          </Badge>
                          {editingConfig?.adaptive_rate_enabled && (
                            <Badge variant="outline">
                              <TrendingUp className="h-3 w-3 mr-1" />
                              Adaptativa
                            </Badge>
                          )}
                          {!configStatus.canSend && (
                            <Badge variant="destructive">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Bloqueado
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Limites Principais */}
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <div className="text-lg font-bold text-primary">
                              {config.messages_per_minute}
                            </div>
                            <div className="text-xs text-muted-foreground">Por Minuto</div>
                          </div>
                          <div>
                            <div className="text-lg font-bold text-green-600">
                              {config.messages_per_hour}
                            </div>
                            <div className="text-xs text-muted-foreground">Por Hora</div>
                          </div>
                          <div>
                            <div className="text-lg font-bold text-blue-600">
                              {config.messages_per_day}
                            </div>
                            <div className="text-xs text-muted-foreground">Por Dia</div>
                          </div>
                        </div>

                        {/* Uso Atual */}
                        {configStatus.status && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Uso Atual</span>
                              <span>{Math.round(usage)}%</span>
                            </div>
                            <Progress value={usage} className="h-2" />
                            <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                              <div>Hoje: {configStatus.status.messages_sent_day}</div>
                              <div>Hora: {configStatus.status.messages_sent_hour}</div>
                              <div>Min: {configStatus.status.messages_sent_minute}</div>
                            </div>
                          </div>
                        )}

                        {/* Configurações de Burst */}
                        <div className="flex items-center justify-between text-sm">
                          <span>Burst Limit:</span>
                          <span>{config.burst_limit} msgs em {config.burst_window_seconds}s</span>
                        </div>

                        {/* Status de Quota */}
                        {configStatus.remaining && (
                          <div className="p-3 bg-muted rounded-lg">
                            <div className="text-sm font-medium mb-1">Quota Restante:</div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div>Min: {configStatus.remaining.minute}</div>
                              <div>Hora: {configStatus.remaining.hour}</div>
                              <div>Dia: {configStatus.remaining.day}</div>
                            </div>
                          </div>
                        )}

                        {/* Próximo Envio Permitido */}
                        {configStatus.nextAllowed && (
                          <div className="flex items-center gap-2 text-sm text-yellow-600">
                            <Timer className="h-4 w-4" />
                            <span>
                              Próximo envio: {formatDistanceToNow(configStatus.nextAllowed, { 
                                addSuffix: true, 
                                locale: ptBR 
                              })}
                            </span>
                          </div>
                        )}

                        {/* Ações */}
                        <div className="flex items-center justify-between pt-2 border-t">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>
                              Horário: {editingConfig?.time_window_start || '09:00'} - {editingConfig?.time_window_end || '18:00'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingConfig(config);
                                setShowCreateForm(true);
                              }}
                            >
                              <Settings className="h-4 w-4 mr-1" />
                              Editar
                            </Button>
                            <Button 
                              size="sm" 
                              variant={configStatus.isActive ? "secondary" : "default"}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleConfig(config);
                              }}
                            >
                              {configStatus.isActive ? (
                                <>
                                  <Pause className="h-4 w-4 mr-1" />
                                  Desativar
                                </>
                              ) : (
                                <>
                                  <Play className="h-4 w-4 mr-1" />
                                  Ativar
                                </>
                              )}
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteConfig(config.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="editor" className="space-y-4">
          {(showCreateForm || editingConfig) ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingConfig?.id ? 'Editar Configuração' : 'Nova Configuração de Rate Limit'}
                </CardTitle>
                <CardDescription>
                  Configure os limites de velocidade para controle inteligente de envios
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Informações Básicas */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Informações Básicas</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Nome da Configuração</Label>
                      <Input
                        id="name"
                        value={editingConfig?.name || ''}
                        onChange={(e) => updateEditingConfig({ name: e.target.value })}
                        placeholder="Ex: Configuração Conservadora"
                      />
                    </div>
                    <div>
                      <Label htmlFor="description">Descrição</Label>
                      <Input
                        id="description"
                        value={editingConfig?.description || ''}
                        onChange={(e) => updateEditingConfig({ description: e.target.value })}
                        placeholder="Descrição da configuração"
                      />
                    </div>
                  </div>
                </div>

                {/* Limites de Mensagens */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Limites de Mensagens</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="per_minute">Mensagens por Minuto</Label>
                      <Input
                        id="per_minute"
                        type="number"
                        min="1"
                        max="60"
                        value={editingConfig?.messages_per_minute || 2}
                        onChange={(e) => updateEditingConfig({ messages_per_minute: parseInt(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="per_hour">Mensagens por Hora</Label>
                      <Input
                        id="per_hour"
                        type="number"
                        min="1"
                        max="3600"
                        value={editingConfig?.messages_per_hour || 100}
                        onChange={(e) => updateEditingConfig({ messages_per_hour: parseInt(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="per_day">Mensagens por Dia</Label>
                      <Input
                        id="per_day"
                        type="number"
                        min="1"
                        max="86400"
                        value={editingConfig?.messages_per_day || 1000}
                        onChange={(e) => updateEditingConfig({ messages_per_day: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>

                {/* Controle de Burst */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Controle de Burst</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="burst_limit">Limite de Burst</Label>
                      <Input
                        id="burst_limit"
                        type="number"
                        min="1"
                        max="50"
                        value={editingConfig?.burst_limit || 5}
                        onChange={(e) => updateEditingConfig({ burst_limit: parseInt(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="burst_window">Janela de Burst (segundos)</Label>
                      <Input
                        id="burst_window"
                        type="number"
                        min="10"
                        max="300"
                        value={editingConfig?.burst_window_seconds || 60}
                        onChange={(e) => updateEditingConfig({ burst_window_seconds: parseInt(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="cooldown">Cooldown (minutos)</Label>
                      <Input
                        id="cooldown"
                        type="number"
                        min="1"
                        max="60"
                        value={editingConfig?.cooldown_after_burst_minutes || 5}
                        onChange={(e) => updateEditingConfig({ cooldown_after_burst_minutes: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>

                {/* Janela de Tempo */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Janela de Tempo Permitida</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="start_time">Horário de Início</Label>
                      <Input
                        id="start_time"
                        type="time"
                        value={editingConfig?.time_window_start || '09:00'}
                        onChange={(e) => updateEditingConfig({ time_window_start: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="end_time">Horário de Fim</Label>
                      <Input
                        id="end_time"
                        type="time"
                        value={editingConfig?.time_window_end || '18:00'}
                        onChange={(e) => updateEditingConfig({ time_window_end: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Rate Adaptativo */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Rate Adaptativo</h3>
                    <Switch
                      checked={editingConfig?.adaptive_rate_enabled || false}
                      onCheckedChange={(checked) => updateEditingConfig({ adaptive_rate_enabled: checked })}
                    />
                  </div>
                  
                  {editingConfig?.adaptive_rate_enabled && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="adaptive_factor">Fator de Redução</Label>
                        <div className="space-y-2">
                          <Slider
                            value={[editingConfig?.adaptive_rate_factor || 0.8]}
                            onValueChange={(value) => updateEditingConfig({ adaptive_rate_factor: value[0] })}
                            max={1}
                            min={0.1}
                            step={0.1}
                          />
                          <div className="text-sm text-muted-foreground text-center">
                            {Math.round((editingConfig?.adaptive_rate_factor || 0.8) * 100)}%
                          </div>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="recovery_time">Tempo de Recuperação (minutos)</Label>
                        <Input
                          id="recovery_time"
                          type="number"
                          min="5"
                          max="120"
                          value={editingConfig?.adaptive_rate_recovery_minutes || 30}
                          onChange={(e) => updateEditingConfig({ adaptive_rate_recovery_minutes: parseInt(e.target.value) })}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Multiplicador de Prioridade */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Multiplicador de Prioridade</h3>
                  <div>
                    <Label htmlFor="priority_multiplier">Multiplicador</Label>
                    <div className="space-y-2">
                      <Slider
                        value={[editingConfig?.priority_multiplier || 1.0]}
                        onValueChange={(value) => updateEditingConfig({ priority_multiplier: value[0] })}
                        max={3}
                        min={0.1}
                        step={0.1}
                      />
                      <div className="text-sm text-muted-foreground text-center">
                        {editingConfig?.priority_multiplier?.toFixed(1)}x
                      </div>
                    </div>
                  </div>
                </div>

                {/* Instância de Teste */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Teste de Configuração</h3>
                  <div>
                    <Label htmlFor="test_instance">ID da Instância para Teste</Label>
                    <Input
                      id="test_instance"
                      value={testInstanceId}
                      onChange={(e) => setTestInstanceId(e.target.value)}
                      placeholder="ID da instância WhatsApp"
                    />
                  </div>
                </div>

                {/* Ações */}
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => {
                    setEditingConfig(null);
                    setShowCreateForm(false);
                  }}>
                    Cancelar
                  </Button>
                  <Button onClick={editingConfig?.id ? 
                    () => handleUpdateConfig(editingConfig as RateLimitConfig) : 
                    handleCreateConfig
                  }>
                    <Save className="h-4 w-4 mr-2" />
                    {editingConfig?.id ? 'Atualizar' : 'Criar'} Configuração
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-64">
                <Settings className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Selecione uma configuração para editar</h3>
                <p className="text-muted-foreground text-center">
                  Escolha uma configuração existente ou crie uma nova
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Configurações Ativas</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {activeConfigs.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  de {configs.length} configurações
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Mensagens Hoje</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {rateLimitStatuses.reduce((acc, s) => acc + s.messages_sent_day, 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total enviado hoje
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Taxa de Bloqueio</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round((rateLimitStatuses.filter(s => s.is_blocked).length / Math.max(rateLimitStatuses.length, 1)) * 100)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Instâncias bloqueadas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Uso Médio</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round(rateLimitStatuses.reduce((acc, s) => {
                    const config = configs.find(c => c.id === s.config_id);
                    return acc + (config ? calculateUsagePercentage(s, config) : 0);
                  }, 0) / Math.max(rateLimitStatuses.length, 1))}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Utilização média
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Status das Configurações */}
          <Card>
            <CardHeader>
              <CardTitle>Status das Configurações</CardTitle>
              <CardDescription>
                Monitoramento em tempo real do uso de rate limiting
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rateLimitStatuses.length === 0 ? (
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhum status de rate limit disponível</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {rateLimitStatuses.map((status) => {
                    const config = configs.find(c => c.id === status.config_id);
                    if (!config) return null;
                    
                    const usage = calculateUsagePercentage(status, config);
                    
                    return (
                      <div key={status.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${status.is_blocked ? 'bg-red-500' : 'bg-green-500'}`} />
                            <div>
                              <div className="font-medium">{config.name}</div>
                              <div className="text-sm text-muted-foreground">
                                Instância: {status.instance_id}
                              </div>
                            </div>
                          </div>
                          <Badge variant={status.is_blocked ? 'destructive' : 'default'}>
                            {status.is_blocked ? 'Bloqueado' : 'Ativo'}
                          </Badge>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Uso Atual</span>
                            <span>{Math.round(usage)}%</span>
                          </div>
                          <Progress value={usage} className="h-2" />
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div className="text-center">
                              <div className="font-medium">{status.messages_sent_minute}</div>
                              <div className="text-xs text-muted-foreground">Último minuto</div>
                            </div>
                            <div className="text-center">
                              <div className="font-medium">{status.messages_sent_hour}</div>
                              <div className="text-xs text-muted-foreground">Última hora</div>
                            </div>
                            <div className="text-center">
                              <div className="font-medium">{status.messages_sent_day}</div>
                              <div className="text-xs text-muted-foreground">Hoje</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
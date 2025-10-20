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
import { 
  Smartphone, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Settings,
  Plus,
  Trash2,
  RefreshCw,
  Wifi,
  WifiOff,
  BarChart3,
  Clock,
  Users,
  Zap
} from 'lucide-react';
import { useMultiSession, WhatsAppInstance, LoadBalancingConfig } from '@/hooks/useMultiSession';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MultiSessionManagerProps {
  onInstanceSelect?: (instance: WhatsAppInstance) => void;
}

export const MultiSessionManager: React.FC<MultiSessionManagerProps> = ({
  onInstanceSelect
}) => {
  const { toast } = useToast();
  const {
    instances,
    healthLogs,
    loadBalancingConfig,
    isLoading,
    addInstance,
    updateInstance,
    removeInstance,
    checkInstanceHealth,
    checkAllInstancesHealth,
    selectBestInstance,
    updateLoadBalancingConfig,
    handleInstanceFailure,
    refreshData
  } = useMultiSession();

  const [selectedInstance, setSelectedInstance] = useState<WhatsAppInstance | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newInstance, setNewInstance] = useState({
    name: '',
    phone_number: '',
    priority: 1,
    max_concurrent_messages: 10
  });

  // Auto-refresh health checks
  useEffect(() => {
    const interval = setInterval(() => {
      checkAllInstancesHealth();
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [checkAllInstancesHealth]);

  const handleAddInstance = async () => {
    try {
      const success = await addInstance({
        name: newInstance.name,
        phone_number: newInstance.phone_number,
        priority: newInstance.priority,
        max_concurrent_messages: newInstance.max_concurrent_messages,
        is_active: true,
        health_status: 'offline'
      });

      if (success) {
        setNewInstance({
          name: '',
          phone_number: '',
          priority: 1,
          max_concurrent_messages: 10
        });
        setShowAddForm(false);
        toast({
          title: "Sucesso",
          description: "Instância adicionada com sucesso"
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao adicionar instância",
        variant: "destructive"
      });
    }
  };

  const handleRemoveInstance = async (instanceId: string) => {
    try {
      const success = await removeInstance(instanceId);
      if (success) {
        toast({
          title: "Sucesso",
          description: "Instância removida com sucesso"
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao remover instância",
        variant: "destructive"
      });
    }
  };

  const handleToggleInstance = async (instance: WhatsAppInstance) => {
    try {
      const success = await updateInstance(instance.id, {
        is_active: !instance.is_active
      });
      
      if (success) {
        toast({
          title: "Sucesso",
          description: `Instância ${instance.is_active ? 'desativada' : 'ativada'} com sucesso`
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao atualizar instância",
        variant: "destructive"
      });
    }
  };

  const handleHealthCheck = async (instanceId: string) => {
    try {
      await checkInstanceHealth(instanceId);
      toast({
        title: "Health Check",
        description: "Verificação de saúde executada"
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha na verificação de saúde",
        variant: "destructive"
      });
    }
  };

  const handleUpdateLoadBalancing = async (config: Partial<LoadBalancingConfig>) => {
    try {
      const success = await updateLoadBalancingConfig(config);
      if (success) {
        toast({
          title: "Sucesso",
          description: "Configuração de balanceamento atualizada"
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

  const getHealthStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'critical': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'offline': return <WifiOff className="h-4 w-4 text-gray-500" />;
      default: return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'critical': return 'bg-red-500';
      case 'offline': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const calculateInstanceLoad = (instance: WhatsAppInstance): number => {
    return (instance.current_load || 0) / instance.max_concurrent_messages * 100;
  };

  const getOverallHealth = () => {
    const healthyCount = instances.filter(i => i.health_status === 'healthy').length;
    const totalCount = instances.length;
    
    if (totalCount === 0) return { status: 'warning', percentage: 0 };
    
    const percentage = (healthyCount / totalCount) * 100;
    
    if (percentage === 100) return { status: 'healthy', percentage };
    if (percentage >= 50) return { status: 'warning', percentage };
    return { status: 'critical', percentage };
  };

  const overallHealth = getOverallHealth();

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
      {/* Header com Status Geral */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Gerenciador Multi-Sessão
              </CardTitle>
              <CardDescription>
                Controle e monitoramento de instâncias WhatsApp
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Saúde Geral</div>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`w-3 h-3 rounded-full ${getHealthStatusColor(overallHealth.status)}`} />
                  <span className="font-medium">{Math.round(overallHealth.percentage)}%</span>
                </div>
              </div>
              <Button onClick={() => setShowAddForm(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
              <Button onClick={refreshData} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="instances" className="space-y-4">
        <TabsList>
          <TabsTrigger value="instances">Instâncias</TabsTrigger>
          <TabsTrigger value="health">Monitoramento</TabsTrigger>
          <TabsTrigger value="balancing">Balanceamento</TabsTrigger>
        </TabsList>

        <TabsContent value="instances" className="space-y-4">
          {/* Form para adicionar nova instância */}
          {showAddForm && (
            <Card>
              <CardHeader>
                <CardTitle>Nova Instância WhatsApp</CardTitle>
                <CardDescription>
                  Adicione uma nova instância para balanceamento de carga
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Nome da Instância</Label>
                    <Input
                      id="name"
                      value={newInstance.name}
                      onChange={(e) => setNewInstance(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: WhatsApp Principal"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Número do Telefone</Label>
                    <Input
                      id="phone"
                      value={newInstance.phone_number}
                      onChange={(e) => setNewInstance(prev => ({ ...prev, phone_number: e.target.value }))}
                      placeholder="Ex: +5511999999999"
                    />
                  </div>
                  <div>
                    <Label htmlFor="priority">Prioridade</Label>
                    <Input
                      id="priority"
                      type="number"
                      min="1"
                      max="10"
                      value={newInstance.priority}
                      onChange={(e) => setNewInstance(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="concurrent">Mensagens Simultâneas</Label>
                    <Input
                      id="concurrent"
                      type="number"
                      min="1"
                      max="100"
                      value={newInstance.max_concurrent_messages}
                      onChange={(e) => setNewInstance(prev => ({ ...prev, max_concurrent_messages: parseInt(e.target.value) }))}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowAddForm(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleAddInstance}>
                    Adicionar Instância
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Lista de Instâncias */}
          {instances.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-64">
                <Smartphone className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma instância configurada</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Adicione sua primeira instância WhatsApp para começar
                </p>
                <Button onClick={() => setShowAddForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Instância
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {instances.map((instance) => {
                const load = calculateInstanceLoad(instance);
                
                return (
                  <Card key={instance.id} className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => {
                          setSelectedInstance(instance);
                          onInstanceSelect?.(instance);
                        }}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${getHealthStatusColor(instance.health_status)}`} />
                          <div>
                            <CardTitle className="text-lg">{instance.name}</CardTitle>
                            <CardDescription>{instance.phone_number}</CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={instance.is_active ? 'default' : 'secondary'}>
                            {instance.is_active ? (
                              <>
                                <Wifi className="h-3 w-3 mr-1" />
                                Ativa
                              </>
                            ) : (
                              <>
                                <WifiOff className="h-3 w-3 mr-1" />
                                Inativa
                              </>
                            )}
                          </Badge>
                          <Badge variant="outline">
                            {getHealthStatusIcon(instance.health_status)}
                            <span className="ml-1 capitalize">{instance.health_status}</span>
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Carga da Instância */}
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Carga Atual</span>
                            <span>{Math.round(load)}%</span>
                          </div>
                          <Progress value={load} className="h-2" />
                          <div className="text-xs text-muted-foreground">
                            {instance.current_load || 0} de {instance.max_concurrent_messages} mensagens
                          </div>
                        </div>

                        {/* Estatísticas */}
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <div className="text-lg font-bold text-primary">
                              {instance.priority}
                            </div>
                            <div className="text-xs text-muted-foreground">Prioridade</div>
                          </div>
                          <div>
                            <div className="text-lg font-bold text-green-600">
                              {instance.messages_sent_today || 0}
                            </div>
                            <div className="text-xs text-muted-foreground">Hoje</div>
                          </div>
                          <div>
                            <div className="text-lg font-bold text-blue-600">
                              {instance.avg_response_time || 0}ms
                            </div>
                            <div className="text-xs text-muted-foreground">Resposta</div>
                          </div>
                        </div>

                        {/* Ações */}
                        <div className="flex items-center justify-between pt-2 border-t">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            {instance.last_seen_at && (
                              <span>
                                Visto {formatDistanceToNow(new Date(instance.last_seen_at), { 
                                  addSuffix: true, 
                                  locale: ptBR 
                                })}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleHealthCheck(instance.id);
                              }}
                            >
                              <Activity className="h-4 w-4 mr-1" />
                              Check
                            </Button>
                            <Button 
                              size="sm" 
                              variant={instance.is_active ? "secondary" : "default"}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleInstance(instance);
                              }}
                            >
                              {instance.is_active ? (
                                <>
                                  <WifiOff className="h-4 w-4 mr-1" />
                                  Desativar
                                </>
                              ) : (
                                <>
                                  <Wifi className="h-4 w-4 mr-1" />
                                  Ativar
                                </>
                              )}
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveInstance(instance.id);
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

        <TabsContent value="health" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Instâncias Saudáveis</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {instances.filter(i => i.health_status === 'healthy').length}
                </div>
                <p className="text-xs text-muted-foreground">
                  de {instances.length} instâncias
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Carga Média</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round(instances.reduce((acc, i) => acc + calculateInstanceLoad(i), 0) / instances.length || 0)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Utilização das instâncias
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
                  {instances.reduce((acc, i) => acc + (i.messages_sent_today || 0), 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total enviado hoje
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tempo Resposta</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round(instances.reduce((acc, i) => acc + (i.avg_response_time || 0), 0) / instances.length || 0)}ms
                </div>
                <p className="text-xs text-muted-foreground">
                  Tempo médio
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Logs de Saúde Recentes */}
          <Card>
            <CardHeader>
              <CardTitle>Logs de Saúde Recentes</CardTitle>
              <CardDescription>
                Histórico de verificações de saúde das instâncias
              </CardDescription>
            </CardHeader>
            <CardContent>
              {healthLogs.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhum log de saúde disponível</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {healthLogs.slice(0, 10).map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getHealthStatusIcon(log.health_status)}
                        <div>
                          <div className="font-medium">
                            {instances.find(i => i.id === log.whatsapp_instance_id)?.name || 'Instância Desconhecida'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {typeof log.response_time === 'number' ? `Tempo de resposta: ${log.response_time}ms` : (log.error_message || 'Verificação realizada')}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(log.timestamp), { 
                          addSuffix: true, 
                          locale: ptBR 
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balancing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuração de Balanceamento</CardTitle>
              <CardDescription>
                Configure como as mensagens são distribuídas entre as instâncias
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="strategy">Estratégia de Balanceamento</Label>
                    <Select 
                      value={loadBalancingConfig?.strategy || 'least_loaded'}
                      onValueChange={(value) => handleUpdateLoadBalancing({ strategy: value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="least_loaded">Menos Carregada</SelectItem>
                        <SelectItem value="priority_based">Baseada em Prioridade</SelectItem>
                        <SelectItem value="round_robin">Round Robin</SelectItem>
                        <SelectItem value="random">Aleatória</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="max_retries">Máximo de Tentativas</Label>
                    <Input
                      id="max_retries"
                      type="number"
                      min="1"
                      max="10"
                      value={loadBalancingConfig?.max_retries || 3}
                      onChange={(e) => handleUpdateLoadBalancing({ max_retries: parseInt(e.target.value) })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="health_check_interval">Intervalo de Health Check (segundos)</Label>
                    <Input
                      id="health_check_interval"
                      type="number"
                      min="10"
                      max="300"
                      value={loadBalancingConfig?.health_check_interval || 30}
                      onChange={(e) => handleUpdateLoadBalancing({ health_check_interval: parseInt(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="failover_enabled">Failover Automático</Label>
                    <Switch
                      id="failover_enabled"
                      checked={loadBalancingConfig?.failover_enabled || false}
                      onCheckedChange={(checked) => handleUpdateLoadBalancing({ failover_enabled: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="auto_scaling">Auto Scaling</Label>
                    <Switch
                      id="auto_scaling"
                      checked={loadBalancingConfig?.auto_scaling_enabled || false}
                      onCheckedChange={(checked) => handleUpdateLoadBalancing({ auto_scaling_enabled: checked })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="load_threshold">Limite de Carga (%)</Label>
                    <Input
                      id="load_threshold"
                      type="number"
                      min="50"
                      max="100"
                      value={loadBalancingConfig?.load_threshold || 80}
                      onChange={(e) => handleUpdateLoadBalancing({ load_threshold: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <Button onClick={checkAllInstancesHealth} className="mr-2">
                  <Activity className="h-4 w-4 mr-2" />
                  Verificar Todas as Instâncias
                </Button>
                <Button variant="outline" onClick={refreshData}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Atualizar Dados
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
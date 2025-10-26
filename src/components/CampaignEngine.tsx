import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Play, 
  Pause, 
  Square, 
  RotateCcw, 
  Settings, 
  Activity,
  Clock,
  Users,
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useCampaignEngine, Campaign, CampaignMetrics } from '@/hooks/useCampaignEngine';
import { useMultiSession } from '@/hooks/useMultiSession';
import { useRandomization } from '@/hooks/useRandomization';
import { useRateLimit } from '@/hooks/useRateLimit';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuotas } from '@/hooks/useQuotas';

interface CampaignEngineProps {
  campaignId?: string;
  onCampaignSelect?: (campaign: Campaign) => void;
}

export const CampaignEngine: React.FC<CampaignEngineProps> = ({
  campaignId,
  onCampaignSelect
}) => {
  const { toast } = useToast();
  const {
    campaigns,
    metrics,
    messageQueue,
    isLoading,
    startCampaign,
    pauseCampaign,
    resumeCampaign,
    stopCampaign,
    retryFailedMessages,
    subscribeToMetrics,
    refreshData
  } = useCampaignEngine();

  const { instances, selectBestInstance } = useMultiSession();
  const { activeProfile } = useRandomization();
  // Include getNextAllowedTime to show the next allowed send time
  const { canSendMessage, getStatus, getNextAllowedTime } = useRateLimit();
  // Use quotas to detect feature blocking
  const { isFeatureBlocked } = useQuotas();

  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [realTimeMetrics, setRealTimeMetrics] = useState<CampaignMetrics | null>(null);

  // Gating flags (messages feature + global rate limit)
  const messagesFeatureBlocked = isFeatureBlocked('messages');
  const rateStatusGlobal = getStatus('global');
  const canSendGlobal = canSendMessage('global');
  const rateLimitedNow = !canSendGlobal;
  const nextAllowedTime = getNextAllowedTime('global');
  const canStartActions = !messagesFeatureBlocked && canSendGlobal;

  // Auto-start scheduled campaigns when their time arrives
  useEffect(() => {
    let cancelled = false;
    const checkAndStart = async () => {
      try {
        await refreshData();
        const now = new Date();
        const toStart = campaigns.filter(c => c.status === 'scheduled' && c.scheduled_at && new Date(c.scheduled_at) <= now);
        for (const c of toStart) {
          if (cancelled) break;
          await startCampaign(c.id);
        }
      } catch (e) {
        console.warn('Auto-start check falhou:', e);
      }
    };

    // Initial check
    checkAndStart();
    // Poll every 30s
    const interval = setInterval(checkAndStart, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [campaigns, refreshData, startCampaign]);

  // Select campaign
  useEffect(() => {
    if (campaignId) {
      const campaign = campaigns.find(c => c.id === campaignId);
      if (campaign) {
        setSelectedCampaign(campaign);
        onCampaignSelect?.(campaign);
      }
    }
  }, [campaignId, campaigns, onCampaignSelect]);

  // Subscribe to real-time metrics
  useEffect(() => {
    if (selectedCampaign) {
      const unsubscribe = subscribeToMetrics(selectedCampaign.id);
      return unsubscribe;
    }
  }, [selectedCampaign, subscribeToMetrics]);

  // Update real-time metrics
  useEffect(() => {
    if (selectedCampaign && metrics[selectedCampaign.id]) {
      setRealTimeMetrics(metrics[selectedCampaign.id]);
    }
  }, [selectedCampaign, metrics]);

  const handleCampaignAction = async (action: string, campaign: Campaign) => {
    try {
      // Apply gating for actions that trigger sending (start, resume, retry)
      if (action === 'start' || action === 'resume' || action === 'retry') {
        if (messagesFeatureBlocked) {
          toast({
            title: 'Envio bloqueado pelo plano',
            description: 'Seu plano atual bloqueia o envio de mensagens. Atualize seu plano para iniciar ou retomar campanhas.',
            variant: 'destructive',
          });
          return;
        }
        if (!canSendGlobal) {
          toast({
            title: 'Rate limit ativo',
            description: nextAllowedTime
              ? `Próximo envio permitido ${nextAllowedTime.toLocaleString('pt-BR')}`
              : 'Envio temporariamente bloqueado. Tente novamente em breve.',
            variant: 'destructive',
          });
          return;
        }
      }

      let success = false;
      
      switch (action) {
        case 'start':
          success = await startCampaign(campaign.id);
          break;
        case 'pause':
          success = await pauseCampaign(campaign.id);
          break;
        case 'resume':
          success = await resumeCampaign(campaign.id);
          break;
        case 'stop':
          success = await stopCampaign(campaign.id);
          break;
        case 'retry':
          success = await retryFailedMessages(campaign.id);
          break;
      }

      if (success) {
        await refreshData();
        toast({
          title: 'Sucesso',
          description: `Ação "${action}" executada com sucesso`,
        });
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: `Falha ao executar ação "${action}"`,
        variant: 'destructive',
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-500';
      case 'paused': return 'bg-yellow-500';
      case 'completed': return 'bg-blue-500';
      case 'cancelled': return 'bg-red-500';
      case 'scheduled': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Play className="h-4 w-4" />;
      case 'paused': return <Pause className="h-4 w-4" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'cancelled': return <XCircle className="h-4 w-4" />;
      case 'scheduled': return <Clock className="h-4 w-4" />;
      default: return <Square className="h-4 w-4" />;
    }
  };

  const calculateProgress = (campaign: Campaign): number => {
    const metric = metrics[campaign.id];
    if (!metric || metric.total_messages === 0) return 0;
    return (metric.messages_sent / metric.total_messages) * 100;
  };

  const getHealthStatus = () => {
    const healthyInstances = instances.filter(i => i.health_status === 'healthy').length;
    const totalInstances = instances.length;
    
    if (totalInstances === 0) return { status: 'warning', text: 'Nenhuma instância configurada' };
    if (healthyInstances === 0) return { status: 'error', text: 'Todas as instâncias offline' };
    if (healthyInstances < totalInstances) return { status: 'warning', text: `${healthyInstances}/${totalInstances} instâncias ativas` };
    return { status: 'success', text: `${healthyInstances} instâncias ativas` };
  };

  const healthStatus = getHealthStatus();

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
                <Activity className="h-5 w-5" />
                Motor de Campanhas
              </CardTitle>
              <CardDescription>
                Gerenciamento inteligente de campanhas multi-sessão
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Status do Sistema</div>
                <Badge 
                  variant={healthStatus.status === 'success' ? 'default' : 
                          healthStatus.status === 'warning' ? 'secondary' : 'destructive'}
                  className="mt-1"
                >
                  {healthStatus.text}
                </Badge>
              </div>
              <Button onClick={refreshData} variant="outline" size="sm">
                <RotateCcw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Gating Banner for Engine-level actions */}
      {(messagesFeatureBlocked || rateLimitedNow) && (
        <div className={`p-4 rounded-md border ${messagesFeatureBlocked ? 'bg-yellow-50 border-yellow-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-start gap-3">
            <AlertTriangle className={`h-5 w-5 ${messagesFeatureBlocked ? 'text-yellow-600' : 'text-amber-600'}`} />
            <div className="text-sm">
              {messagesFeatureBlocked ? (
                <>
                  <p className="font-medium">Envio de mensagens bloqueado</p>
                  <p>Seu plano atual bloqueia o envio de mensagens. Atualize seu plano para iniciar campanhas.</p>
                </>
              ) : (
                <>
                  <p className="font-medium">Rate limit ativo</p>
                  <p>Próximo envio permitido {nextAllowedTime ? nextAllowedTime.toLocaleString('pt-BR') : 'em breve'}.</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="campaigns" className="space-y-4">
        <TabsList>
          <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
          <TabsTrigger value="queue">Fila de Mensagens</TabsTrigger>
          <TabsTrigger value="metrics">Métricas</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-4">
          {campaigns.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-64">
                <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma campanha encontrada</h3>
                <p className="text-muted-foreground text-center">
                  Crie sua primeira campanha inteligente para começar
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {campaigns.map((campaign) => {
                const metric = metrics[campaign.id];
                const progress = calculateProgress(campaign);
                const queueCount = messageQueue.filter(m => m.campaign_id === campaign.id).length;

                return (
                  <Card key={campaign.id} className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => setSelectedCampaign(campaign)}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${getStatusColor(campaign.status)}`} />
                          <div>
                            <CardTitle className="text-lg">{campaign.name}</CardTitle>
                            <CardDescription>{campaign.description}</CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {getStatusIcon(campaign.status)}
                            <span className="ml-1 capitalize">{campaign.status}</span>
                          </Badge>
                          {campaign.multi_session_enabled && (
                            <Badge variant="secondary">Multi-Sessão</Badge>
                          )}
                          {campaign.randomization_enabled && (
                            <Badge variant="secondary">Randomização</Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Progress Bar */}
                        {metric && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Progresso</span>
                              <span>{Math.round(progress)}%</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                          </div>
                        )}

                        {/* Métricas Rápidas */}
                        <div className="grid grid-cols-4 gap-4 text-center">
                          <div>
                            <div className="text-2xl font-bold text-primary">
                              {metric?.total_messages || 0}
                            </div>
                            <div className="text-xs text-muted-foreground">Total</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-green-600">
                              {metric?.messages_sent || 0}
                            </div>
                            <div className="text-xs text-muted-foreground">Enviadas</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-red-600">
                              {metric?.messages_failed || 0}
                            </div>
                            <div className="text-xs text-muted-foreground">Falharam</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-yellow-600">
                              {queueCount}
                            </div>
                            <div className="text-xs text-muted-foreground">Na Fila</div>
                          </div>
                        </div>

                        {/* Ações */}
                        <div className="flex items-center justify-between pt-2 border-t">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            {campaign.created_at && (
                              <span>
                                Criada {formatDistanceToNow(new Date(campaign.created_at), { 
                                  addSuffix: true, 
                                  locale: ptBR 
                                })}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {campaign.status === 'draft' && (
                              <Button 
                                size="sm"
                                disabled={!canStartActions}
                                title={!canStartActions ? (messagesFeatureBlocked ? 'Envio de mensagens bloqueado pelo plano' : 'Rate limit ativo, aguarde para iniciar') : undefined}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCampaignAction('start', campaign);
                                }}
                              >
                                <Play className="h-4 w-4 mr-1" />
                                Iniciar
                              </Button>
                            )}
                            {campaign.status === 'running' && (
                              <>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCampaignAction('pause', campaign);
                                  }}
                                >
                                  <Pause className="h-4 w-4 mr-1" />
                                  Pausar
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCampaignAction('stop', campaign);
                                  }}
                                >
                                  <Square className="h-4 w-4 mr-1" />
                                  Parar
                                </Button>
                              </>
                            )}
                            {campaign.status === 'paused' && (
                              <>
                                <Button 
                                  size="sm"
                                  disabled={!canStartActions}
                                  title={!canStartActions ? (messagesFeatureBlocked ? 'Envio de mensagens bloqueado pelo plano' : 'Rate limit ativo, aguarde para retomar') : undefined}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCampaignAction('resume', campaign);
                                  }}
                                >
                                  <Play className="h-4 w-4 mr-1" />
                                  Retomar
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCampaignAction('stop', campaign);
                                  }}
                                >
                                  <Square className="h-4 w-4 mr-1" />
                                  Parar
                                </Button>
                              </>
                            )}
                            {metric && metric.messages_failed > 0 && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                disabled={!canStartActions}
                                title={!canStartActions ? (messagesFeatureBlocked ? 'Envio de mensagens bloqueado pelo plano' : 'Rate limit ativo, aguarde para reenviar') : undefined}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCampaignAction('retry', campaign);
                                }}
                              >
                                <RotateCcw className="h-4 w-4 mr-1" />
                                Reenviar
                              </Button>
                            )}
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

        <TabsContent value="queue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Fila de Mensagens</CardTitle>
              <CardDescription>
                Mensagens pendentes e em processamento
              </CardDescription>
            </CardHeader>
            <CardContent>
              {messageQueue.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhuma mensagem na fila</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {messageQueue.slice(0, 10).map((message) => (
                    <div key={message.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge 
                          variant={
                            message.status === 'sent' ? 'default' :
                            message.status === 'failed' ? 'destructive' :
                            message.status === 'processing' ? 'secondary' : 'outline'
                          }
                        >
                          {message.status}
                        </Badge>
                        <div>
                          <div className="font-medium">Contato: {message.contact_id}</div>
                          <div className="text-sm text-muted-foreground">
                            Prioridade: {message.priority} | Tentativas: {message.retry_count}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(message.scheduled_at), { 
                          addSuffix: true, 
                          locale: ptBR 
                        })}
                      </div>
                    </div>
                  ))}
                  {messageQueue.length > 10 && (
                    <div className="text-center text-sm text-muted-foreground pt-2">
                      E mais {messageQueue.length - 10} mensagens...
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          {selectedCampaign && realTimeMetrics ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {realTimeMetrics.success_rate.toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {realTimeMetrics.messages_sent} de {realTimeMetrics.total_messages} enviadas
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Instâncias Ativas</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {realTimeMetrics.active_instances}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Instâncias processando mensagens
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Tempo de Resposta</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {realTimeMetrics.avg_response_time}ms
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tempo médio de processamento
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Mensagens Pendentes</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {realTimeMetrics.messages_pending}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Aguardando processamento
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-64">
                <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Selecione uma campanha</h3>
                <p className="text-muted-foreground text-center">
                  Escolha uma campanha para visualizar métricas detalhadas
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
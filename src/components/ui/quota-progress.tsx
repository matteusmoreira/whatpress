import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, TrendingUp, Users, MessageSquare, Smartphone, FileText, Zap, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuotaProgressProps {
  title: string;
  used: number;
  max: number;
  percentage: number;
  type: 'users' | 'contacts' | 'campaigns' | 'messages' | 'connections' | 'templates' | 'automations';
  showUpgradeButton?: boolean;
  onUpgrade?: () => void;
  className?: string;
}

const quotaIcons = {
  users: Users,
  contacts: Database,
  campaigns: TrendingUp,
  messages: MessageSquare,
  connections: Smartphone,
  templates: FileText,
  automations: Zap
};

const quotaColors = {
  users: 'text-blue-600',
  contacts: 'text-green-600',
  campaigns: 'text-purple-600',
  messages: 'text-orange-600',
  connections: 'text-cyan-600',
  templates: 'text-pink-600',
  automations: 'text-yellow-600'
};

export const QuotaProgress: React.FC<QuotaProgressProps> = ({
  title,
  used,
  max,
  percentage,
  type,
  showUpgradeButton = false,
  onUpgrade,
  className
}) => {
  const Icon = quotaIcons[type];
  const iconColor = quotaColors[type];

  // Determinar cor da barra baseado no percentual
  const getProgressColor = (percent: number) => {
    if (percent >= 100) return 'bg-red-500';
    if (percent >= 85) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  // Determinar status
  const getStatus = (percent: number) => {
    if (percent >= 100) return { label: 'Limite Atingido', variant: 'destructive' as const };
    if (percent >= 85) return { label: 'Atenção', variant: 'secondary' as const };
    return { label: 'Normal', variant: 'default' as const };
  };

  const status = getStatus(percentage);
  const progressColor = getProgressColor(percentage);

  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Icon className={cn('h-4 w-4', iconColor)} />
          {title}
        </CardTitle>
        <Badge variant={status.variant} className="text-xs">
          {status.label}
        </Badge>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-3">
          {/* Números principais */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-2xl font-bold">
                {used.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">
                de {max.toLocaleString()} disponíveis
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold">
                {percentage}%
              </p>
              <p className="text-xs text-muted-foreground">
                utilizado
              </p>
            </div>
          </div>

          {/* Barra de progresso */}
          <div className="space-y-2">
            <Progress 
              value={Math.min(percentage, 100)} 
              className="h-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0</span>
              <span>{max.toLocaleString()}</span>
            </div>
          </div>

          {/* Alertas e ações */}
          {percentage >= 85 && (
            <div className={cn(
              'flex items-start gap-2 p-3 rounded-lg border',
              percentage >= 100 
                ? 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800' 
                : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800'
            )}>
              <AlertTriangle className={cn(
                'h-4 w-4 mt-0.5 flex-shrink-0',
                percentage >= 100 ? 'text-red-600' : 'text-yellow-600'
              )} />
              <div className="space-y-2 flex-1">
                <p className={cn(
                  'text-sm font-medium',
                  percentage >= 100 ? 'text-red-800 dark:text-red-200' : 'text-yellow-800 dark:text-yellow-200'
                )}>
                  {percentage >= 100 
                    ? 'Limite atingido!' 
                    : 'Você está próximo do limite'
                  }
                </p>
                <p className={cn(
                  'text-xs',
                  percentage >= 100 ? 'text-red-700 dark:text-red-300' : 'text-yellow-700 dark:text-yellow-300'
                )}>
                  {percentage >= 100 
                    ? 'Funcionalidades podem estar bloqueadas. Faça upgrade do seu plano para continuar.'
                    : 'Considere fazer upgrade do seu plano para evitar interrupções.'
                  }
                </p>
                
                {showUpgradeButton && onUpgrade && (
                  <Button 
                    size="sm" 
                    variant={percentage >= 100 ? 'destructive' : 'secondary'}
                    onClick={onUpgrade}
                    className="mt-2"
                  >
                    Fazer Upgrade
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Informações adicionais para quotas específicas */}
          {type === 'messages' && (
            <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
              <p>💡 As mensagens são resetadas mensalmente</p>
            </div>
          )}
          
          {type === 'connections' && percentage >= 80 && (
            <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
              <p>💡 Múltiplas conexões permitem envios mais rápidos</p>
            </div>
          )}
        </div>
      </CardContent>

      {/* Indicador visual de status na lateral */}
      <div className={cn(
        'absolute left-0 top-0 bottom-0 w-1',
        percentage >= 100 ? 'bg-red-500' : percentage >= 85 ? 'bg-yellow-500' : 'bg-green-500'
      )} />
    </Card>
  );
};

// Componente para múltiplas quotas em grid
interface QuotaGridProps {
  quotas: {
    max_users: number;
    max_contacts: number;
    max_whatsapp_connections: number;
    max_message_templates: number;
    max_automations: number;
    max_monthly_messages: number;
    current_users?: number;
    current_contacts?: number;
    current_whatsapp_connections?: number;
    current_message_templates?: number;
    current_automations?: number;
    current_monthly_messages?: number;
  };
  onUpgrade?: () => void;
  className?: string;
}

export const QuotaGrid: React.FC<QuotaGridProps> = ({ 
  quotas, 
  onUpgrade, 
  className 
}) => {
  const quotaItems = [
    {
      title: 'Usuários',
      used: quotas.current_users || 0,
      max: quotas.max_users,
      type: 'users' as const,
    },
    {
      title: 'Contatos',
      used: quotas.current_contacts || 0,
      max: quotas.max_contacts,
      type: 'contacts' as const,
    },
    {
      title: 'Conexões WhatsApp',
      used: quotas.current_whatsapp_connections || 0,
      max: quotas.max_whatsapp_connections,
      type: 'connections' as const,
    },
    {
      title: 'Templates de Mensagem',
      used: quotas.current_message_templates || 0,
      max: quotas.max_message_templates,
      type: 'templates' as const,
    },
    {
      title: 'Automações',
      used: quotas.current_automations || 0,
      max: quotas.max_automations,
      type: 'automations' as const,
    },
    {
      title: 'Mensagens Mensais',
      used: quotas.current_monthly_messages || 0,
      max: quotas.max_monthly_messages,
      type: 'messages' as const,
    },
  ];

  return (
    <div className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4', className)}>
      {quotaItems.map((quota) => {
        const percentage = quota.max > 0 ? Math.round((quota.used / quota.max) * 100) : 0;
        
        return (
          <QuotaProgress
            key={quota.type}
            title={quota.title}
            used={quota.used}
            max={quota.max}
            percentage={percentage}
            type={quota.type}
            showUpgradeButton={percentage >= 85}
            onUpgrade={onUpgrade}
          />
        );
      })}
    </div>
  );
};

// Componente compacto para dashboard
interface QuotaCompactProps {
  quotas: {
    max_users: number;
    max_contacts: number;
    max_whatsapp_connections: number;
    max_message_templates: number;
    max_automations: number;
    max_monthly_messages: number;
    current_users?: number;
    current_contacts?: number;
    current_whatsapp_connections?: number;
    current_message_templates?: number;
    current_automations?: number;
    current_monthly_messages?: number;
  };
  className?: string;
}

export const QuotaCompact: React.FC<QuotaCompactProps> = ({
  quotas,
  className
}) => {
  const quotaItems = [
    {
      title: 'Usuários',
      used: quotas.current_users || 0,
      max: quotas.max_users,
      type: 'users' as const,
    },
    {
      title: 'Contatos',
      used: quotas.current_contacts || 0,
      max: quotas.max_contacts,
      type: 'contacts' as const,
    },
    {
      title: 'Conexões',
      used: quotas.current_whatsapp_connections || 0,
      max: quotas.max_whatsapp_connections,
      type: 'connections' as const,
    },
    {
      title: 'Mensagens',
      used: quotas.current_monthly_messages || 0,
      max: quotas.max_monthly_messages,
      type: 'messages' as const,
    },
  ];

  return (
    <div className={cn('space-y-3', className)}>
      {quotaItems.map((item) => {
        const percentage = item.max > 0 ? Math.round((item.used / item.max) * 100) : 0;
        const Icon = quotaIcons[item.type];
        const iconColor = quotaColors[item.type];

        return (
          <div key={item.type} className="flex items-center space-x-3 p-3 rounded-lg border bg-card">
            <Icon className={cn('h-5 w-5 flex-shrink-0', iconColor)} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{item.title}</p>
              <div className="flex items-center space-x-2 mt-1">
                <Progress value={Math.min(percentage, 100)} className="h-1.5 flex-1" />
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {item.used}/{item.max}
                </span>
              </div>
            </div>
            {percentage >= 85 && (
              <AlertTriangle className={cn(
                'h-4 w-4 flex-shrink-0',
                percentage >= 100 ? 'text-red-500' : 'text-yellow-500'
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
};
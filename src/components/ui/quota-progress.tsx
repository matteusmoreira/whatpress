import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle, XCircle, Users, MessageSquare, Zap, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QuotaUsage } from '@/hooks/useQuotas';

interface QuotaProgressProps {
  usage: QuotaUsage;
  showDetails?: boolean;
  className?: string;
}

interface QuotaProgressCardProps {
  title: string;
  usage: QuotaUsage;
  icon?: React.ReactNode;
  className?: string;
}

// Mapeamento de ícones por tipo de recurso
const resourceIcons = {
  users: <Users className="h-4 w-4" />,
  contacts: <MessageSquare className="h-4 w-4" />,
  campaigns: <Zap className="h-4 w-4" />,
  connections: <Smartphone className="h-4 w-4" />
};

// Mapeamento de títulos por tipo de recurso
const resourceTitles = {
  users: 'Usuários',
  contacts: 'Contatos',
  campaigns: 'Campanhas',
  connections: 'Conexões WhatsApp'
};

// Componente de progresso simples
export const QuotaProgress: React.FC<QuotaProgressProps> = ({
  usage,
  showDetails = true,
  className
}) => {
  const getStatusColor = (status: QuotaUsage['status']) => {
    switch (status) {
      case 'safe':
        return 'text-green-600 dark:text-green-400';
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'critical':
        return 'text-orange-600 dark:text-orange-400';
      case 'blocked':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getProgressColor = (status: QuotaUsage['status']) => {
    switch (status) {
      case 'safe':
        return 'bg-green-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'critical':
        return 'bg-orange-500';
      case 'blocked':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: QuotaUsage['status']) => {
    switch (status) {
      case 'safe':
        return <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case 'warning':
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
      case 'blocked':
        return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: QuotaUsage['status']) => {
    switch (status) {
      case 'safe':
        return 'Normal';
      case 'warning':
        return 'Atenção';
      case 'critical':
        return 'Crítico';
      case 'blocked':
        return 'Bloqueado';
      default:
        return 'Desconhecido';
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {resourceIcons[usage.resource]}
          <span className="text-sm font-medium">
            {resourceTitles[usage.resource]}
          </span>
        </div>
        
        {showDetails && (
          <div className="flex items-center gap-2">
            {getStatusIcon(usage.status)}
            <Badge 
              variant="outline" 
              className={cn('text-xs', getStatusColor(usage.status))}
            >
              {getStatusText(usage.status)}
            </Badge>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <Progress 
          value={usage.percentage} 
          className="h-2"
          indicatorClassName={getProgressColor(usage.status)}
        />
        
        {showDetails && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{usage.current} de {usage.max} utilizados</span>
            <span className={getStatusColor(usage.status)}>
              {usage.percentage}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// Componente de card com progresso
export const QuotaProgressCard: React.FC<QuotaProgressCardProps> = ({
  title,
  usage,
  icon,
  className
}) => {
  const getStatusBorderColor = (status: QuotaUsage['status']) => {
    switch (status) {
      case 'safe':
        return 'border-green-200 dark:border-green-800';
      case 'warning':
        return 'border-yellow-200 dark:border-yellow-800';
      case 'critical':
        return 'border-orange-200 dark:border-orange-800';
      case 'blocked':
        return 'border-red-200 dark:border-red-800';
      default:
        return 'border-border';
    }
  };

  return (
    <Card className={cn('transition-all duration-200', getStatusBorderColor(usage.status), className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            {icon || resourceIcons[usage.resource]}
            <span>{title}</span>
          </div>
          
          <div className="flex items-center gap-1">
            <span className="text-lg font-bold">{usage.current}</span>
            <span className="text-xs text-muted-foreground">/ {usage.max}</span>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="pt-0">
        <QuotaProgress usage={usage} showDetails={true} />
        
        {usage.status === 'blocked' && (
          <div className="mt-3 p-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md">
            <div className="flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
              <XCircle className="h-3 w-3" />
              <span>Limite atingido. Funcionalidade bloqueada.</span>
            </div>
          </div>
        )}
        
        {usage.status === 'critical' && (
          <div className="mt-3 p-2 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-md">
            <div className="flex items-center gap-2 text-xs text-orange-700 dark:text-orange-300">
              <AlertTriangle className="h-3 w-3" />
              <span>Próximo do limite. Considere fazer upgrade.</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Componente compacto para uso em headers/sidebars
export const QuotaProgressCompact: React.FC<{
  usage: QuotaUsage;
  className?: string;
}> = ({ usage, className }) => {
  const getStatusColor = (status: QuotaUsage['status']) => {
    switch (status) {
      case 'safe':
        return 'bg-green-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'critical':
        return 'bg-orange-200 dark:border-orange-800';
      case 'blocked':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex items-center gap-1">
        {resourceIcons[usage.resource]}
        <span className="text-xs font-medium">
          {usage.current}/{usage.max}
        </span>
      </div>
      
      <div className="flex-1 min-w-[40px]">
        <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div 
            className={cn('h-full transition-all duration-300', getStatusColor(usage.status))}
            style={{ width: `${Math.min(usage.percentage, 100)}%` }}
          />
        </div>
      </div>
      
      <span className="text-xs text-muted-foreground min-w-[30px] text-right">
        {usage.percentage}%
      </span>
    </div>
  );
};

// Componente de grid para múltiplas quotas
export const QuotaProgressGrid: React.FC<{
  quota: any; // Aceita um objeto quota único
  className?: string;
}> = ({ quota, className }) => {
  if (!quota) return null;

  // Converter quota única em array de QuotaUsage
  const quotaUsages: QuotaUsage[] = [
    {
      resource: 'users',
      current: quota.current_users,
      max: quota.max_users,
      percentage: (quota.current_users / quota.max_users) * 100,
      status: quota.current_users >= quota.max_users ? 'blocked' :
              quota.current_users >= quota.max_users * 0.85 ? 'critical' :
              quota.current_users >= quota.max_users * 0.7 ? 'warning' : 'safe'
    },
    {
      resource: 'contacts',
      current: quota.current_contacts,
      max: quota.max_contacts,
      percentage: (quota.current_contacts / quota.max_contacts) * 100,
      status: quota.current_contacts >= quota.max_contacts ? 'blocked' :
              quota.current_contacts >= quota.max_contacts * 0.85 ? 'critical' :
              quota.current_contacts >= quota.max_contacts * 0.7 ? 'warning' : 'safe'
    },
    {
      resource: 'campaigns',
      current: quota.current_campaigns,
      max: quota.max_campaigns,
      percentage: (quota.current_campaigns / quota.max_campaigns) * 100,
      status: quota.current_campaigns >= quota.max_campaigns ? 'blocked' :
              quota.current_campaigns >= quota.max_campaigns * 0.85 ? 'critical' :
              quota.current_campaigns >= quota.max_campaigns * 0.7 ? 'warning' : 'safe'
    },
    {
      resource: 'connections',
      current: quota.current_connections,
      max: quota.max_connections,
      percentage: (quota.current_connections / quota.max_connections) * 100,
      status: quota.current_connections >= quota.max_connections ? 'blocked' :
              quota.current_connections >= quota.max_connections * 0.85 ? 'critical' :
              quota.current_connections >= quota.max_connections * 0.7 ? 'warning' : 'safe'
    }
  ];

  return (
    <div className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-4', className)}>
      {quotaUsages.map((usage) => (
        <QuotaProgressCard
          key={usage.resource}
          title={resourceTitles[usage.resource]}
          usage={usage}
          icon={resourceIcons[usage.resource]}
        />
      ))}
    </div>
  );
};
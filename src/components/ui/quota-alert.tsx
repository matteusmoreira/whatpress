import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  AlertTriangle, 
  XCircle, 
  X, 
  CheckCircle, 
  Users, 
  MessageSquare, 
  Zap, 
  Smartphone,
  Clock,
  TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { QuotaAlert } from '@/hooks/useQuotas';

interface QuotaAlertProps {
  alert: QuotaAlert;
  onAcknowledge?: (alertId: string) => void;
  onDismiss?: (alertId: string) => void;
  showActions?: boolean;
  compact?: boolean;
  className?: string;
}

interface QuotaAlertListProps {
  alerts: QuotaAlert[];
  onAcknowledge?: (alertId: string) => void;
  onDismiss?: (alertId: string) => void;
  maxItems?: number;
  showEmpty?: boolean;
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

// Componente de alerta individual
export const QuotaAlert: React.FC<QuotaAlertProps> = ({
  alert,
  onAcknowledge,
  onDismiss,
  showActions = true,
  compact = false,
  className
}) => {
  const getAlertVariant = (alertType: QuotaAlert['alert_type']) => {
    return alertType === '100_percent' ? 'destructive' : 'default';
  };

  const getAlertIcon = (alertType: QuotaAlert['alert_type']) => {
    return alertType === '100_percent' ? 
      <XCircle className="h-4 w-4" /> : 
      <AlertTriangle className="h-4 w-4" />;
  };

  const getAlertTitle = (alert: QuotaAlert) => {
    const resource = resourceTitles[alert.resource_type];
    return alert.alert_type === '100_percent' 
      ? `Limite de ${resource} Atingido`
      : `Limite de ${resource} Próximo`;
  };

  const formatTimeAgo = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { 
        addSuffix: true, 
        locale: ptBR 
      });
    } catch {
      return 'há alguns momentos';
    }
  };

  if (compact) {
    return (
      <div className={cn(
        'flex items-center justify-between p-3 border rounded-lg',
        alert.alert_type === '100_percent' 
          ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20'
          : 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/20',
        className
      )}>
        <div className="flex items-center gap-3 flex-1">
          <div className={cn(
            'flex items-center justify-center w-8 h-8 rounded-full',
            alert.alert_type === '100_percent'
              ? 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400'
              : 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-400'
          )}>
            {getAlertIcon(alert.alert_type)}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {resourceIcons[alert.resource_type]}
              <span className="text-sm font-medium truncate">
                {alert.message}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {alert.percentage.toFixed(1)}%
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatTimeAgo(alert.created_at)}
              </span>
            </div>
          </div>
        </div>

        {showActions && (
          <div className="flex items-center gap-1 ml-2">
            {onAcknowledge && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onAcknowledge(alert.id)}
                className="h-8 w-8 p-0"
              >
                <CheckCircle className="h-4 w-4" />
              </Button>
            )}
            {onDismiss && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDismiss(alert.id)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <Alert 
      variant={getAlertVariant(alert.alert_type)}
      className={cn('relative', className)}
    >
      {getAlertIcon(alert.alert_type)}
      
      <div className="flex-1">
        <AlertTitle className="flex items-center gap-2">
          {resourceIcons[alert.resource_type]}
          {getAlertTitle(alert)}
        </AlertTitle>
        
        <AlertDescription className="mt-2">
          <div className="space-y-2">
            <p>{alert.message}</p>
            
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                <span>Uso: {alert.percentage.toFixed(1)}%</span>
              </div>
              
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{formatTimeAgo(alert.created_at)}</span>
              </div>
            </div>
          </div>
        </AlertDescription>
      </div>

      {showActions && (
        <div className="absolute top-2 right-2 flex items-center gap-1">
          {onAcknowledge && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onAcknowledge(alert.id)}
              className="h-8 w-8 p-0"
              title="Marcar como reconhecido"
            >
              <CheckCircle className="h-4 w-4" />
            </Button>
          )}
          {onDismiss && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDismiss(alert.id)}
              className="h-8 w-8 p-0"
              title="Dispensar alerta"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </Alert>
  );
};

// Componente de lista de alertas
export const QuotaAlertList: React.FC<QuotaAlertListProps> = ({
  alerts,
  onAcknowledge,
  onDismiss,
  maxItems = 5,
  showEmpty = true,
  className
}) => {
  const displayAlerts = maxItems ? alerts.slice(0, maxItems) : alerts;
  const hasMoreAlerts = maxItems && alerts.length > maxItems;

  if (alerts.length === 0 && showEmpty) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
          <h3 className="text-lg font-medium text-center mb-2">
            Nenhum Alerta Ativo
          </h3>
          <p className="text-sm text-muted-foreground text-center">
            Todas as suas quotas estão dentro dos limites normais.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-3', className)}>
      {displayAlerts.map((alert) => (
        <QuotaAlert
          key={alert.id}
          alert={alert}
          onAcknowledge={onAcknowledge}
          onDismiss={onDismiss}
          compact={true}
        />
      ))}
      
      {hasMoreAlerts && (
        <div className="text-center py-2">
          <Badge variant="outline" className="text-xs">
            +{alerts.length - maxItems} alertas adicionais
          </Badge>
        </div>
      )}
    </div>
  );
};

// Componente de banner de alerta crítico
export const QuotaCriticalBanner: React.FC<{
  alerts: QuotaAlert[];
  onAcknowledge?: (alertId: string) => void;
  className?: string;
}> = ({ alerts, onAcknowledge, className }) => {
  const criticalAlerts = alerts.filter(alert => alert.alert_type === '100_percent');
  
  if (criticalAlerts.length === 0) {
    return null;
  }

  const alert = criticalAlerts[0]; // Mostrar apenas o primeiro alerta crítico

  return (
    <Alert variant="destructive" className={cn('border-red-500', className)}>
      <XCircle className="h-4 w-4" />
      <AlertTitle className="flex items-center justify-between">
        <span>Limite Crítico Atingido</span>
        {onAcknowledge && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onAcknowledge(alert.id)}
            className="h-6 w-6 p-0 hover:bg-red-100 dark:hover:bg-red-900"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </AlertTitle>
      <AlertDescription>
        <div className="flex items-center justify-between">
          <span>{alert.message}</span>
          {criticalAlerts.length > 1 && (
            <Badge variant="outline" className="ml-2">
              +{criticalAlerts.length - 1} outros
            </Badge>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
};

// Componente de notificação flutuante
export const QuotaAlertToast: React.FC<{
  alert: QuotaAlert;
  onClose?: () => void;
  autoClose?: boolean;
  duration?: number;
}> = ({ alert, onClose, autoClose = true, duration = 5000 }) => {
  React.useEffect(() => {
    if (autoClose && onClose) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [autoClose, onClose, duration]);

  return (
    <div className={cn(
      'fixed top-4 right-4 z-50 w-96 p-4 rounded-lg shadow-lg border',
      'bg-background border-border',
      'animate-in slide-in-from-right-full duration-300'
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          'flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0',
          alert.alert_type === '100_percent'
            ? 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400'
            : 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-400'
        )}>
          {getAlertIcon(alert.alert_type)}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {resourceIcons[alert.resource_type]}
            <h4 className="text-sm font-medium">
              {resourceTitles[alert.resource_type]}
            </h4>
          </div>
          <p className="text-sm text-muted-foreground">
            {alert.message}
          </p>
        </div>

        {onClose && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="h-6 w-6 p-0 flex-shrink-0"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
};
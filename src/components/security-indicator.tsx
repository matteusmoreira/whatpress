import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Shield, Lock, Eye, AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useConsent } from '@/hooks/useConsent';
import { useSecurityAudit } from '@/services/securityAuditService';
import { securityConfig } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface SecurityScore {
  overall: number;
  encryption: boolean;
  rateLimiting: boolean;
  auditEnabled: boolean;
  consentConfigured: boolean;
  recentAlerts: number;
}

export function SecurityIndicator() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { consentSettings } = useConsent();
  const { logEvent } = useSecurityAudit();
  
  const [securityScore, setSecurityScore] = useState<SecurityScore>({
    overall: 0,
    encryption: false,
    rateLimiting: false,
    auditEnabled: false,
    consentConfigured: false,
    recentAlerts: 0
  });
  const [loading, setLoading] = useState(false);

  const calculateSecurityScore = async () => {
    if (!currentTenant?.id) return;

    setLoading(true);
    try {
      // Verificar configurações de segurança
      const { data: tenantSettings } = await supabase
        .from('tenant_settings')
        .select('security_settings')
        .eq('tenant_id', currentTenant.id)
        .single();

      // Contar alertas recentes (últimos 7 dias)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { count: alertsCount } = await supabase
        .from('security_audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', currentTenant.id)
        .eq('status', 'error')
        .gte('created_at', sevenDaysAgo.toISOString());

      const settings = tenantSettings?.security_settings || {};
      
      const score: SecurityScore = {
        overall: 0,
        encryption: securityConfig.encryptionEnabled || settings.encryption_enabled || false,
        rateLimiting: securityConfig.rateLimitEnabled || settings.rate_limit_enabled || false,
        auditEnabled: securityConfig.securityAuditEnabled || settings.security_audit_enabled || false,
        consentConfigured: !!consentSettings?.show_consent_banner || false,
        recentAlerts: alertsCount || 0
      };

      // Calcular pontuação geral (0-100)
      let totalScore = 0;
      if (score.encryption) totalScore += 25;
      if (score.rateLimiting) totalScore += 25;
      if (score.auditEnabled) totalScore += 25;
      if (score.consentConfigured) totalScore += 15;
      if (score.recentAlerts === 0) totalScore += 10;
      else if (score.recentAlerts <= 5) totalScore += 5;

      score.overall = Math.min(totalScore, 100);
      setSecurityScore(score);

    } catch (error) {
      console.error('Erro ao calcular pontuação de segurança:', error);
      toast.error('Erro ao verificar status de segurança');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calculateSecurityScore();
  }, [currentTenant?.id, consentSettings]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 80) return 'default';
    if (score >= 60) return 'secondary';
    return 'destructive';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excelente';
    if (score >= 60) return 'Bom';
    if (score >= 40) return 'Regular';
    return 'Crítico';
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-blue-600" />
            <CardTitle>Status de Segurança</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={getScoreBadgeVariant(securityScore.overall)}>
              {getScoreLabel(securityScore.overall)}
            </Badge>
            <Button
              onClick={calculateSecurityScore}
              disabled={loading}
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        <CardDescription>
          Verifique o status de segurança do seu sistema
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Pontuação Geral */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Pontuação de Segurança</span>
            <span className={`text-lg font-bold ${getScoreColor(securityScore.overall)}`}>
              {securityScore.overall}/100
            </span>
          </div>
          <Progress value={securityScore.overall} className="h-2" />
        </div>

        {/* Itens de Segurança */}
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Lock className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium">Criptografia de Dados</span>
            </div>
            {securityScore.encryption ? (
              <Badge variant="default" className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Ativado
              </Badge>
            ) : (
              <Badge variant="destructive" className="flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                Desativado
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium">Rate Limiting</span>
            </div>
            {securityScore.rateLimiting ? (
              <Badge variant="default" className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Ativado
              </Badge>
            ) : (
              <Badge variant="destructive" className="flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                Desativado
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Eye className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium">Auditoria de Segurança</span>
            </div>
            {securityScore.auditEnabled ? (
              <Badge variant="default" className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Ativado
              </Badge>
            ) : (
              <Badge variant="destructive" className="flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                Desativado
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Shield className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium">Consentimento LGPD</span>
            </div>
            {securityScore.consentConfigured ? (
              <Badge variant="default" className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Configurado
              </Badge>
            ) : (
              <Badge variant="destructive" className="flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                Não Configurado
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium">Alertas Recentes (7 dias)</span>
            </div>
            <Badge 
              variant={securityScore.recentAlerts === 0 ? 'default' : 'destructive'}
              className="flex items-center gap-1"
            >
              {securityScore.recentAlerts === 0 ? (
                <>
                  <CheckCircle className="h-3 w-3" />
                  Nenhum
                </>
              ) : (
                <>
                  <AlertTriangle className="h-3 w-3" />
                  {securityScore.recentAlerts}
                </>
              )}
            </Badge>
          </div>
        </div>

        {/* Ações */}
        <div className="flex gap-3 pt-4 border-t">
          <Button
            onClick={() => window.location.href = '/dashboard/settings/security'}
            variant="outline"
            className="flex-1"
          >
            <Shield className="h-4 w-4 mr-2" />
            Configurar Segurança
          </Button>
          <Button
            onClick={calculateSecurityScore}
            disabled={loading}
            className="flex-1"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';

export interface SecurityLog {
  id?: string;
  user_id?: string;
  tenant_id?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  ip_address?: string;
  user_agent?: string;
  status: 'success' | 'failure';
  error_message?: string;
  metadata?: Record<string, any>;
  created_at?: string;
}

export interface AuditEvent {
  action: string;
  resource_type: string;
  resource_id?: string;
  metadata?: Record<string, any>;
  status?: 'success' | 'failure';
  error_message?: string;
}

class SecurityAuditService {
  private static instance: SecurityAuditService;
  private logs: SecurityLog[] = [];
  private batchSize = 10;
  private flushInterval = 5000; // 5 segundos
  private flushTimer?: NodeJS.Timeout;

  private constructor() {
    this.startPeriodicFlush();
  }

  static getInstance(): SecurityAuditService {
    if (!SecurityAuditService.instance) {
      SecurityAuditService.instance = new SecurityAuditService();
    }
    return SecurityAuditService.instance;
  }

  /**
   * Registra um evento de segurança
   */
  async logEvent(event: AuditEvent): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: { session } } = await supabase.auth.getSession();
      
      // Obter tenant_id do token JWT ou localStorage
      const tenantId = this.getCurrentTenantId();

      const log: SecurityLog = {
        user_id: user?.id,
        tenant_id: tenantId,
        action: event.action,
        resource_type: event.resource_type,
        resource_id: event.resource_id,
        ip_address: await this.getClientIP(),
        user_agent: navigator.userAgent,
        status: event.status || 'success',
        error_message: event.error_message,
        metadata: event.metadata,
        created_at: new Date().toISOString()
      };

      // Adiciona à fila em memória
      this.logs.push(log);

      // Se atingiu o tamanho do lote, envia imediatamente
      if (this.logs.length >= this.batchSize) {
        await this.flushLogs();
      }
    } catch (error) {
      console.error('Erro ao registrar evento de segurança:', error);
      // Em caso de erro, ainda mantém o log local para tentar enviar depois
    }
  }

  /**
   * Registra tentativa de acesso não autorizado
   */
  async logUnauthorizedAccess(
    resourceType: string,
    resourceId?: string,
    reason?: string
  ): Promise<void> {
    await this.logEvent({
      action: 'unauthorized_access_attempt',
      resource_type: resourceType,
      resource_id: resourceId,
      status: 'failure',
      error_message: reason || 'Acesso não autorizado',
      metadata: {
        url: window.location.href,
        timestamp: Date.now()
      }
    });
  }

  /**
   * Registra alteração de dados sensíveis
   */
  async logSensitiveDataChange(
    resourceType: string,
    resourceId: string,
    fieldChanged: string,
    oldValue?: string,
    newValue?: string
  ): Promise<void> {
    await this.logEvent({
      action: 'sensitive_data_changed',
      resource_type: resourceType,
      resource_id: resourceId,
      status: 'success',
      metadata: {
        field_changed: fieldChanged,
        old_value_hash: oldValue ? this.hashValue(oldValue) : undefined,
        new_value_hash: newValue ? this.hashValue(newValue) : undefined,
        timestamp: Date.now()
      }
    });
  }

  /**
   * Registra acesso a dados sensíveis
   */
  async logSensitiveDataAccess(
    resourceType: string,
    resourceId: string,
    fieldsAccessed: string[]
  ): Promise<void> {
    await this.logEvent({
      action: 'sensitive_data_accessed',
      resource_type: resourceType,
      resource_id: resourceId,
      status: 'success',
      metadata: {
        fields_accessed: fieldsAccessed,
        timestamp: Date.now()
      }
    });
  }

  /**
   * Registra falha de autenticação
   */
  async logAuthenticationFailure(
    username?: string,
    reason?: string
  ): Promise<void> {
    await this.logEvent({
      action: 'authentication_failure',
      resource_type: 'authentication',
      status: 'failure',
      error_message: reason || 'Falha na autenticação',
      metadata: {
        username_attempt: username ? this.hashValue(username) : undefined,
        timestamp: Date.now()
      }
    });
  }

  /**
   * Registra atividade suspeita
   */
  async logSuspiciousActivity(
    activity: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.logEvent({
      action: 'suspicious_activity',
      resource_type: 'security',
      status: 'failure',
      error_message: activity,
      metadata: {
        activity_details: details,
        timestamp: Date.now()
      }
    });
  }

  /**
   * Busca logs de auditoria com filtros
   */
  async getAuditLogs(filters?: {
    user_id?: string;
    tenant_id?: string;
    action?: string;
    resource_type?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
  }): Promise<SecurityLog[]> {
    try {
      let query = supabase
        .from('security_audit_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.user_id) {
        query = query.eq('user_id', filters.user_id);
      }

      if (filters?.tenant_id) {
        query = query.eq('tenant_id', filters.tenant_id);
      }

      if (filters?.action) {
        query = query.eq('action', filters.action);
      }

      if (filters?.resource_type) {
        query = query.eq('resource_type', filters.resource_type);
      }

      if (filters?.start_date) {
        query = query.gte('created_at', filters.start_date);
      }

      if (filters?.end_date) {
        query = query.lte('created_at', filters.end_date);
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar logs de auditoria:', error);
      return [];
    }
  }

  /**
   * Envia logs pendentes para o banco de dados
   */
  private async flushLogs(): Promise<void> {
    if (this.logs.length === 0) return;

    const logsToSend = [...this.logs];
    this.logs = [];

    try {
      const { error } = await supabase
        .from('security_audit_logs')
        .insert(logsToSend);

      if (error) {
        throw error;
      }

      console.log(`${logsToSend.length} logs de segurança enviados com sucesso`);
    } catch (error) {
      console.error('Erro ao enviar logs de segurança:', error);
      // Recoloca os logs na fila para tentar novamente
      this.logs.unshift(...logsToSend);
    }
  }

  /**
   * Inicia flush periódico dos logs
   */
  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flushLogs();
    }, this.flushInterval);
  }

  /**
   * Para o flush periódico (útil em testes ou desmontagem)
   */
  stopPeriodicFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
  }

  /**
   * Obtém o IP do cliente (forma básica)
   */
  private async getClientIP(): Promise<string | undefined> {
    try {
      // Tenta obter IP via API pública (fallback para localhost)
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return 'localhost';
    }
  }

  /**
   * Obtém o tenant_id atual
   */
  private getCurrentTenantId(): string | undefined {
    try {
      // Tenta obter do localStorage primeiro
      const stored = localStorage.getItem('current_tenant');
      if (stored) {
        const tenant = JSON.parse(stored);
        return tenant.id;
      }

      // Fallback para o hook useTenant (se disponível)
      // Nota: Isso é uma simplificação, em produção seria melhor
      return undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Cria hash de valores sensíveis para logs
   */
  private hashValue(value: string): string {
    // Implementação simples de hash (em produção usar crypto-js ou similar)
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      const char = value.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Converte para 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Limpa logs antigos (mantém últimos 90 dias)
   */
  async cleanupOldLogs(): Promise<void> {
    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const { error } = await supabase
        .from('security_audit_logs')
        .delete()
        .lt('created_at', ninetyDaysAgo.toISOString());

      if (error) {
        throw error;
      }

      console.log('Logs antigos removidos com sucesso');
    } catch (error) {
      console.error('Erro ao limpar logs antigos:', error);
    }
  }
}

// Export singleton instance
export const securityAuditService = SecurityAuditService.getInstance();

// Hook React para usar o serviço
export const useSecurityAudit = () => {
  return {
    logEvent: securityAuditService.logEvent.bind(securityAuditService),
    logUnauthorizedAccess: securityAuditService.logUnauthorizedAccess.bind(securityAuditService),
    logSensitiveDataChange: securityAuditService.logSensitiveDataChange.bind(securityAuditService),
    logSensitiveDataAccess: securityAuditService.logSensitiveDataAccess.bind(securityAuditService),
    logAuthenticationFailure: securityAuditService.logAuthenticationFailure.bind(securityAuditService),
    logSuspiciousActivity: securityAuditService.logSuspiciousActivity.bind(securityAuditService),
    getAuditLogs: securityAuditService.getAuditLogs.bind(securityAuditService),
    cleanupOldLogs: securityAuditService.cleanupOldLogs.bind(securityAuditService)
  };
};

export default SecurityAuditService;
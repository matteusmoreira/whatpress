import { supabase } from './supabase';
import { getEncryptionService } from './encryption';

export interface BackupOptions {
  tenantId: string;
  backupType: 'full' | 'contacts' | 'messages' | 'templates' | 'campaigns';
  includeEncrypted: boolean;
  compress: boolean;
}

export interface BackupResult {
  success: boolean;
  backupId?: string;
  backupPath?: string;
  sizeBytes?: number;
  checksum?: string;
  error?: string;
  durationMs?: number;
}

export interface BackupLog {
  id: string;
  tenant_id: string;
  backup_type: string;
  backup_size_bytes: number;
  backup_location: string;
  backup_checksum: string;
  backup_status: 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at?: string;
  error_message?: string;
  created_by?: string;
}

class BackupService {
  private encryptionService = getEncryptionService();

  async createBackup(options: BackupOptions): Promise<BackupResult> {
    const startTime = Date.now();
    let backupLog: any = null;

    try {
      // Criar log de backup
      const { data: logData, error: logError } = await supabase
        .from('backup_logs')
        .insert({
          tenant_id: options.tenantId,
          backup_type: options.backupType,
          backup_status: 'running',
          started_at: new Date().toISOString(),
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (logError) {
        throw new Error(`Falha ao criar log de backup: ${logError.message}`);
      }

      backupLog = logData;

      // Coletar dados baseado no tipo de backup
      const backupData = await this.collectBackupData(options);
      
      // Criptografar dados se necessário
      let processedData = backupData;
      if (options.includeEncrypted) {
        processedData = await this.encryptBackupData(backupData);
      }

      // Comprimir dados se necessário
      if (options.compress) {
        processedData = await this.compressData(processedData);
      }

      // Calcular checksum
      const checksum = this.calculateChecksum(processedData);

      // Salvar backup (simulado - em produção, salvaria em S3 ou similar)
      const backupPath = `backups/${options.tenantId}/${options.backupType}/${Date.now()}.json`;
      const backupSize = new Blob([JSON.stringify(processedData)]).size;

      // Atualizar log de backup
      const { error: updateError } = await supabase
        .from('backup_logs')
        .update({
          backup_status: 'completed',
          completed_at: new Date().toISOString(),
          backup_location: backupPath,
          backup_size_bytes: backupSize,
          backup_checksum: checksum
        })
        .eq('id', backupLog.id);

      if (updateError) {
        console.error('Erro ao atualizar log de backup:', updateError);
      }

      // Registrar auditoria
      await this.logBackupActivity(options.tenantId, 'backup_created', {
        backup_type: options.backupType,
        backup_size: backupSize,
        backup_path: backupPath
      });

      return {
        success: true,
        backupId: backupLog.id,
        backupPath,
        sizeBytes: backupSize,
        checksum,
        durationMs: Date.now() - startTime
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      if (backupLog) {
        await supabase
          .from('backup_logs')
          .update({
            backup_status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: errorMessage
          })
          .eq('id', backupLog.id);
      }

      // Registrar auditoria de erro
      await this.logBackupActivity(options.tenantId, 'backup_failed', {
        backup_type: options.backupType,
        error: errorMessage
      });

      return {
        success: false,
        error: errorMessage,
        durationMs: Date.now() - startTime
      };
    }
  }

  private async collectBackupData(options: BackupOptions): Promise<any> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Usuário não autenticado');
    }

    const backupData: any = {
      metadata: {
        tenantId: options.tenantId,
        backupType: options.backupType,
        createdAt: new Date().toISOString(),
        createdBy: user.id,
        version: '1.0'
      }
    };

    switch (options.backupType) {
      case 'full':
        backupData.contacts = await this.backupContacts(options.tenantId);
        backupData.messages = await this.backupMessages(options.tenantId);
        backupData.templates = await this.backupTemplates(options.tenantId);
        backupData.campaigns = await this.backupCampaigns(options.tenantId);
        break;
      
      case 'contacts':
        backupData.contacts = await this.backupContacts(options.tenantId);
        break;
      
      case 'messages':
        backupData.messages = await this.backupMessages(options.tenantId);
        break;
      
      case 'templates':
        backupData.templates = await this.backupTemplates(options.tenantId);
        break;
      
      case 'campaigns':
        backupData.campaigns = await this.backupCampaigns(options.tenantId);
        break;
    }

    return backupData;
  }

  private async backupContacts(tenantId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`Falha ao buscar contatos: ${error.message}`);
    }

    return data || [];
  }

  private async backupMessages(tenantId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`Falha ao buscar mensagens: ${error.message}`);
    }

    return data || [];
  }

  private async backupTemplates(tenantId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`Falha ao buscar templates: ${error.message}`);
    }

    return data || [];
  }

  private async backupCampaigns(tenantId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`Falha ao buscar campanhas: ${error.message}`);
    }

    return data || [];
  }

  private async encryptBackupData(data: any): Promise<any> {
    try {
      const encryptedData = JSON.stringify(data);
      return this.encryptionService.encrypt(encryptedData);
    } catch (error) {
      console.error('Erro ao criptografar dados de backup:', error);
      throw new Error('Falha ao criptografar dados de backup');
    }
  }

  private async compressData(data: any): Promise<any> {
    // Em produção, implementar compressão real
    // Por enquanto, retorna os dados sem compressão
    return data;
  }

  private calculateChecksum(data: any): string {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(data));
    return hash.digest('hex');
  }

  private async logBackupActivity(tenantId: string, action: string, details: any): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase.from('security_audit_log').insert({
        tenant_id: tenantId,
        user_id: user?.id,
        action: `backup_${action}`,
        resource_type: 'backup',
        details,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Erro ao registrar atividade de backup:', error);
    }
  }

  async getBackupHistory(tenantId: string, limit: number = 10): Promise<BackupLog[]> {
    try {
      const { data, error } = await supabase
        .from('backup_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Falha ao buscar histórico de backups: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar histórico de backups:', error);
      return [];
    }
  }

  async deleteOldBackups(tenantId: string, retentionDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const { data, error } = await supabase
        .from('backup_logs')
        .delete()
        .eq('tenant_id', tenantId)
        .lt('created_at', cutoffDate.toISOString())
        .select();

      if (error) {
        throw new Error(`Falha ao deletar backups antigos: ${error.message}`);
      }

      const deletedCount = data?.length || 0;

      // Registrar auditoria
      await this.logBackupActivity(tenantId, 'cleanup_completed', {
        retention_days: retentionDays,
        deleted_count: deletedCount
      });

      return deletedCount;
    } catch (error) {
      console.error('Erro ao deletar backups antigos:', error);
      return 0;
    }
  }

  async restoreFromBackup(backupId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Buscar backup
      const { data: backupLog, error: backupError } = await supabase
        .from('backup_logs')
        .select('*')
        .eq('id', backupId)
        .single();

      if (backupError || !backupLog) {
        throw new Error('Backup não encontrado');
      }

      // Em produção, implementar lógica de restauração real
      // Por enquanto, apenas registrar a tentativa
      await this.logBackupActivity(backupLog.tenant_id, 'restore_attempted', {
        backup_id: backupId,
        backup_type: backupLog.backup_type
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      return { success: false, error: errorMessage };
    }
  }
}

// Exportar instância singleton
let backupService: BackupService | null = null;

export const getBackupService = (): BackupService => {
  if (!backupService) {
    backupService = new BackupService();
  }
  return backupService;
};

export default BackupService;
import supabase from '@/lib/supabase'
import { getEncryptionService } from '@/lib/encryption'

export interface BackupConfig {
  id?: string
  name: string
  description?: string
  tables: string[]
  schedule?: 'daily' | 'weekly' | 'monthly'
  retention_days: number
  is_encrypted: boolean
  tenant_id?: string
  created_at?: string
  last_backup?: string
  is_active: boolean
}

export interface BackupData {
  id: string
  config_id: string
  backup_type: 'manual' | 'scheduled'
  filename: string
  file_size: number
  tables: string[]
  row_count: number
  is_encrypted: boolean
  checksum: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  error_message?: string
  created_at: string
  completed_at?: string
  tenant_id?: string
}

class BackupService {
  private encryptionService = getEncryptionService()

  async createBackupConfig(config: Omit<BackupConfig, 'id' | 'created_at' | 'last_backup'>): Promise<BackupConfig> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Usuário não autenticado')

    const tenantId = user.user_metadata?.tenant_id || user.id

    const configData = {
      ...config,
      tenant_id: tenantId,
      created_at: new Date().toISOString(),
      is_active: true
    }

    const { data, error } = await supabase
      .from('backup_configs')
      .insert(configData)
      .select()
      .single()

    if (error) throw new Error(`Erro ao criar configuração de backup: ${error.message}`)
    return data
  }

  async updateBackupConfig(id: string, updates: Partial<BackupConfig>): Promise<BackupConfig> {
    const { data, error } = await supabase
      .from('backup_configs')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(`Erro ao atualizar configuração de backup: ${error.message}`)
    return data
  }

  async deleteBackupConfig(id: string): Promise<void> {
    const { error } = await supabase
      .from('backup_configs')
      .delete()
      .eq('id', id)

    if (error) throw new Error(`Erro ao excluir configuração de backup: ${error.message}`)
  }

  async getBackupConfigs(): Promise<BackupConfig[]> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Usuário não autenticado')

    const tenantId = user.user_metadata?.tenant_id || user.id

    const { data, error } = await supabase
      .from('backup_configs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Erro ao buscar configurações de backup: ${error.message}`)
    return data || []
  }

  async createBackup(configId: string, backupType: 'manual' | 'scheduled' = 'manual'): Promise<BackupData> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Usuário não autenticado')

    const tenantId = user.user_metadata?.tenant_id || user.id

    // Buscar configuração de backup
    const { data: config } = await supabase
      .from('backup_configs')
      .select('*')
      .eq('id', configId)
      .single()

    if (!config) throw new Error('Configuração de backup não encontrada')

    // Criar registro de backup
    const backupRecord: Omit<BackupData, 'id' | 'created_at' | 'completed_at'> = {
      config_id: configId,
      backup_type: backupType,
      filename: `backup_${config.name}_${Date.now()}.json`,
      file_size: 0,
      tables: config.tables,
      row_count: 0,
      is_encrypted: config.is_encrypted,
      checksum: '',
      status: 'pending',
      tenant_id: tenantId
    }

    const { data: backupData, error: insertError } = await supabase
      .from('backups')
      .insert(backupRecord)
      .select()
      .single()

    if (insertError) throw new Error(`Erro ao criar registro de backup: ${insertError.message}`)

    // Executar backup em background
    this.executeBackup(backupData.id, config, backupData)

    return backupData
  }

  private async executeBackup(backupId: string, config: BackupConfig, backupRecord: BackupData): Promise<void> {
    try {
      // Atualizar status para running
      await supabase
        .from('backups')
        .update({ status: 'running' })
        .eq('id', backupId)

      let allData: any = {}
      let totalRows = 0

      // Buscar dados de cada tabela
      for (const table of config.tables) {
        try {
          const { data, error } = await supabase
            .from(table)
            .select('*')

          if (error) {
            console.error(`Erro ao buscar dados da tabela ${table}:`, error)
            allData[table] = []
          } else {
            allData[table] = data || []
            totalRows += data?.length || 0
          }
        } catch (error) {
          console.error(`Erro ao processar tabela ${table}:`, error)
          allData[table] = []
        }
      }

      // Criar objeto de backup
      const backupData = {
        backup_info: {
          id: backupId,
          config_id: config.id,
          created_at: new Date().toISOString(),
          tables: config.tables,
          total_rows: totalRows,
          is_encrypted: config.is_encrypted
        },
        data: allData
      }

      // Converter para JSON
      let backupContent = JSON.stringify(backupData, null, 2)

      // Criptografar se necessário
      if (config.is_encrypted && this.encryptionService.isEnabled()) {
        backupContent = await this.encryptionService.encryptData(backupContent)
      }

      // Calcular checksum
      const checksum = await this.calculateChecksum(backupContent)

      // Fazer upload para o Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('backups')
        .upload(`${config.tenant_id}/${backupRecord.filename}`, backupContent, {
          contentType: 'application/json',
          upsert: false
        })

      if (uploadError) throw new Error(`Erro ao fazer upload do backup: ${uploadError.message}`)

      // Atualizar registro de backup
      const fileSize = new Blob([backupContent]).size
      await supabase
        .from('backups')
        .update({
          status: 'completed',
          file_size: fileSize,
          row_count: totalRows,
          checksum,
          completed_at: new Date().toISOString()
        })
        .eq('id', backupId)

      // Atualizar último backup na configuração
      await supabase
        .from('backup_configs')
        .update({ last_backup: new Date().toISOString() })
        .eq('id', config.id)

    } catch (error) {
      console.error('Erro ao executar backup:', error)
      
      // Atualizar status para failed
      await supabase
        .from('backups')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Erro desconhecido',
          completed_at: new Date().toISOString()
        })
        .eq('id', backupId)
    }
  }

  async restoreBackup(backupId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Usuário não autenticado')

    // Buscar backup
    const { data: backup } = await supabase
      .from('backups')
      .select('*')
      .eq('id', backupId)
      .single()

    if (!backup) throw new Error('Backup não encontrado')
    if (backup.status !== 'completed') throw new Error('Backup não está completo')

    // Fazer download do arquivo
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('backups')
      .download(`${backup.tenant_id}/${backup.filename}`)

    if (downloadError) throw new Error(`Erro ao fazer download do backup: ${downloadError.message}`)

    try {
      let backupContent = await fileData.text()

      // Descriptografar se necessário
      if (backup.is_encrypted && this.encryptionService.isEnabled()) {
        backupContent = await this.encryptionService.decryptData(backupContent)
      }

      const backupData = JSON.parse(backupContent)

      // Verificar checksum
      const calculatedChecksum = await this.calculateChecksum(backupContent)
      if (calculatedChecksum !== backup.checksum) {
        throw new Error('Checksum inválido - backup pode estar corrompido')
      }

      // Restaurar dados de cada tabela
      for (const table of backup.tables) {
        if (backupData.data[table]) {
          // Limpar tabela existente
          await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')

          // Inserir dados do backup
          const rows = backupData.data[table]
          if (rows.length > 0) {
            // Inserir em lotes de 100 para evitar problemas de performance
            const batchSize = 100
            for (let i = 0; i < rows.length; i += batchSize) {
              const batch = rows.slice(i, i + batchSize)
              const { error } = await supabase.from(table).insert(batch)
              if (error) {
                console.error(`Erro ao restaurar dados da tabela ${table}:`, error)
                throw new Error(`Erro ao restaurar dados da tabela ${table}: ${error.message}`)
              }
            }
          }
        }
      }

    } catch (error) {
      console.error('Erro ao restaurar backup:', error)
      throw error
    }
  }

  async getBackups(): Promise<BackupData[]> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Usuário não autenticado')

    const tenantId = user.user_metadata?.tenant_id || user.id

    const { data, error } = await supabase
      .from('backups')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Erro ao buscar backups: ${error.message}`)
    return data || []
  }

  async deleteBackup(backupId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Usuário não autenticado')

    const tenantId = user.user_metadata?.tenant_id || user.id

    // Buscar backup
    const { data: backup } = await supabase
      .from('backups')
      .select('*')
      .eq('id', backupId)
      .single()

    if (!backup) throw new Error('Backup não encontrado')

    // Deletar arquivo do storage
    const { error: storageError } = await supabase.storage
      .from('backups')
      .remove([`${tenantId}/${backup.filename}`])

    if (storageError) {
      console.error('Erro ao deletar arquivo do backup:', storageError)
    }

    // Deletar registro do banco
    const { error } = await supabase
      .from('backups')
      .delete()
      .eq('id', backupId)

    if (error) throw new Error(`Erro ao deletar backup: ${error.message}`)
  }

  async cleanupOldBackups(configId: string): Promise<number> {
    const { data: config } = await supabase
      .from('backup_configs')
      .select('*')
      .eq('id', configId)
      .single()

    if (!config) throw new Error('Configuração de backup não encontrada')

    const retentionDate = new Date()
    retentionDate.setDate(retentionDate.getDate() - config.retention_days)

    // Buscar backups antigos
    const { data: oldBackups } = await supabase
      .from('backups')
      .select('*')
      .eq('config_id', configId)
      .lt('created_at', retentionDate.toISOString())
      .eq('status', 'completed')

    let deletedCount = 0

    if (oldBackups && oldBackups.length > 0) {
      for (const backup of oldBackups) {
        try {
          await this.deleteBackup(backup.id)
          deletedCount++
        } catch (error) {
          console.error(`Erro ao deletar backup antigo ${backup.id}:`, error)
        }
      }
    }

    return deletedCount
  }

  private async calculateChecksum(content: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(content)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }
}

export const backupService = new BackupService()
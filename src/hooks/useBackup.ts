import { useState, useCallback } from 'react'
import { backupService, BackupConfig, BackupData } from '@/services/BackupService'
import { toast } from 'sonner'

export function useBackup() {
  const [loading, setLoading] = useState(false)
  const [configs, setConfigs] = useState<BackupConfig[]>([])
  const [backups, setBackups] = useState<BackupData[]>([])

  const createBackupConfig = useCallback(async (config: Omit<BackupConfig, 'id' | 'created_at' | 'last_backup'>) => {
    setLoading(true)
    try {
      const newConfig = await backupService.createBackupConfig(config)
      setConfigs(prev => [newConfig, ...prev])
      toast.success('Configuração de backup criada com sucesso!')
      return newConfig
    } catch (error) {
      console.error('Erro ao criar configuração de backup:', error)
      toast.error('Erro ao criar configuração de backup')
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  const updateBackupConfig = useCallback(async (id: string, updates: Partial<BackupConfig>) => {
    setLoading(true)
    try {
      const updatedConfig = await backupService.updateBackupConfig(id, updates)
      setConfigs(prev => prev.map(config => config.id === id ? updatedConfig : config))
      toast.success('Configuração de backup atualizada com sucesso!')
      return updatedConfig
    } catch (error) {
      console.error('Erro ao atualizar configuração de backup:', error)
      toast.error('Erro ao atualizar configuração de backup')
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  const deleteBackupConfig = useCallback(async (id: string) => {
    setLoading(true)
    try {
      await backupService.deleteBackupConfig(id)
      setConfigs(prev => prev.filter(config => config.id !== id))
      toast.success('Configuração de backup excluída com sucesso!')
    } catch (error) {
      console.error('Erro ao excluir configuração de backup:', error)
      toast.error('Erro ao excluir configuração de backup')
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  const getBackupConfigs = useCallback(async () => {
    setLoading(true)
    try {
      const configs = await backupService.getBackupConfigs()
      setConfigs(configs)
      return configs
    } catch (error) {
      console.error('Erro ao buscar configurações de backup:', error)
      toast.error('Erro ao buscar configurações de backup')
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  const createBackup = useCallback(async (configId: string, backupType: 'manual' | 'scheduled' = 'manual') => {
    setLoading(true)
    try {
      const backup = await backupService.createBackup(configId, backupType)
      toast.success('Backup iniciado com sucesso! Você será notificado quando terminar.')
      return backup
    } catch (error) {
      console.error('Erro ao criar backup:', error)
      toast.error('Erro ao criar backup')
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  const restoreBackup = useCallback(async (backupId: string) => {
    setLoading(true)
    try {
      await backupService.restoreBackup(backupId)
      toast.success('Backup restaurado com sucesso!')
    } catch (error) {
      console.error('Erro ao restaurar backup:', error)
      toast.error('Erro ao restaurar backup')
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  const getBackups = useCallback(async () => {
    setLoading(true)
    try {
      const backups = await backupService.getBackups()
      setBackups(backups)
      return backups
    } catch (error) {
      console.error('Erro ao buscar backups:', error)
      toast.error('Erro ao buscar backups')
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  const deleteBackup = useCallback(async (backupId: string) => {
    setLoading(true)
    try {
      await backupService.deleteBackup(backupId)
      setBackups(prev => prev.filter(backup => backup.id !== backupId))
      toast.success('Backup excluído com sucesso!')
    } catch (error) {
      console.error('Erro ao excluir backup:', error)
      toast.error('Erro ao excluir backup')
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  const cleanupOldBackups = useCallback(async (configId: string) => {
    try {
      const deletedCount = await backupService.cleanupOldBackups(configId)
      if (deletedCount > 0) {
        toast.success(`${deletedCount} backups antigos foram limpos com sucesso!`)
      }
      return deletedCount
    } catch (error) {
      console.error('Erro ao limpar backups antigos:', error)
      toast.error('Erro ao limpar backups antigos')
      throw error
    }
  }, [])

  return {
    loading,
    configs,
    backups,
    createBackupConfig,
    updateBackupConfig,
    deleteBackupConfig,
    getBackupConfigs,
    createBackup,
    restoreBackup,
    getBackups,
    deleteBackup,
    cleanupOldBackups
  }
}
import { useState, useEffect } from 'react'
import { Shield, Lock, Database, Save, RefreshCw, Download, Upload, Trash2, Plus, Settings } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useBackup } from '@/hooks/useBackup'
import { toast } from 'sonner'
import { BackupConfig } from '@/services/BackupService'

export function SecuritySettings() {
  const { 
    configs, 
    backups, 
    loading, 
    createBackupConfig, 
    updateBackupConfig, 
    deleteBackupConfig, 
    getBackupConfigs,
    createBackup,
    restoreBackup,
    deleteBackup,
    cleanupOldBackups
  } = useBackup()

  const [encryptionEnabled, setEncryptionEnabled] = useState(false)
  const [showNewConfigForm, setShowNewConfigForm] = useState(false)
  const [newConfig, setNewConfig] = useState({
    name: '',
    description: '',
    tables: ['messages', 'contacts', 'templates'],
    schedule: 'daily' as 'daily' | 'weekly' | 'monthly',
    retention_days: 30,
    is_encrypted: true
  })

  useEffect(() => {
    loadData()
    checkEncryptionStatus()
  }, [])

  const loadData = async () => {
    try {
      await getBackupConfigs()
    } catch (error) {
      console.error('Erro ao carregar configurações:', error)
    }
  }

  const checkEncryptionStatus = () => {
    const isEnabled = import.meta.env.VITE_ENCRYPTION_ENABLED === 'true'
    setEncryptionEnabled(isEnabled)
  }

  const handleCreateConfig = async () => {
    if (!newConfig.name.trim()) {
      toast.error('Nome da configuração é obrigatório')
      return
    }

    try {
      await createBackupConfig(newConfig)
      setShowNewConfigForm(false)
      setNewConfig({
        name: '',
        description: '',
        tables: ['messages', 'contacts', 'templates'],
        schedule: 'daily',
        retention_days: 30,
        is_encrypted: true
      })
    } catch (error) {
      console.error('Erro ao criar configuração:', error)
    }
  }

  const handleCreateBackup = async (configId: string) => {
    try {
      await createBackup(configId, 'manual')
    } catch (error) {
      console.error('Erro ao criar backup:', error)
    }
  }

  const handleRestoreBackup = async (backupId: string) => {
    if (!confirm('Tem certeza que deseja restaurar este backup? Esta ação substituirá os dados atuais.')) {
      return
    }

    try {
      await restoreBackup(backupId)
      toast.success('Backup restaurado com sucesso!')
    } catch (error) {
      console.error('Erro ao restaurar backup:', error)
      toast.error('Erro ao restaurar backup')
    }
  }

  const handleDeleteBackup = async (backupId: string) => {
    if (!confirm('Tem certeza que deseja excluir este backup?')) {
      return
    }

    try {
      await deleteBackup(backupId)
    } catch (error) {
      console.error('Erro ao excluir backup:', error)
    }
  }

  const handleCleanup = async (configId: string) => {
    try {
      await cleanupOldBackups(configId)
    } catch (error) {
      console.error('Erro ao limpar backups antigos:', error)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default">Concluído</Badge>
      case 'failed':
        return <Badge variant="destructive">Falhou</Badge>
      case 'running':
        return <Badge variant="secondary">Em Execução</Badge>
      case 'pending':
        return <Badge variant="outline">Pendente</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-6">
      {/* Alerta de Segurança */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>Configurações de Segurança</AlertTitle>
        <AlertDescription>
          Gerencie as configurações de criptografia, backup e auditoria de segurança do sistema.
        </AlertDescription>
      </Alert>

      {/* Configuração de Criptografia */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Lock className="h-5 w-5" />
            <span>Criptografia de Dados</span>
          </CardTitle>
          <CardDescription>
            Configure a criptografia de dados sensíveis no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="encryption-enabled">Criptografia Ativada</Label>
                <p className="text-sm text-gray-500">
                  {encryptionEnabled 
                    ? 'Dados sensíveis estão sendo criptografados' 
                    : 'Criptografia não está ativada no sistema'}
                </p>
              </div>
              <Switch
                id="encryption-enabled"
                checked={encryptionEnabled}
                disabled={true}
                onCheckedChange={setEncryptionEnabled}
              />
            </div>
            
            {encryptionEnabled && (
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-800">
                    Criptografia está ativa e protegendo seus dados
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Configurações de Backup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Database className="h-5 w-5" />
              <span>Configurações de Backup</span>
            </div>
            <Button
              size="sm"
              onClick={() => setShowNewConfigForm(true)}
              disabled={showNewConfigForm}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Configuração
            </Button>
          </CardTitle>
          <CardDescription>
            Configure backups automáticos de dados críticos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showNewConfigForm && (
            <div className="mb-6 p-4 border rounded-lg bg-gray-50">
              <h4 className="font-medium mb-4">Nova Configuração de Backup</h4>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="config-name">Nome</Label>
                  <Input
                    id="config-name"
                    value={newConfig.name}
                    onChange={(e) => setNewConfig(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Backup Diário Mensagens"
                  />
                </div>
                <div>
                  <Label htmlFor="config-description">Descrição</Label>
                  <Input
                    id="config-description"
                    value={newConfig.description}
                    onChange={(e) => setNewConfig(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Descrição da configuração"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="config-schedule">Frequência</Label>
                    <Select
                      value={newConfig.schedule}
                      onValueChange={(value) => setNewConfig(prev => ({ ...prev, schedule: value as any }))}
                    >
                      <SelectTrigger id="config-schedule">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Diário</SelectItem>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="monthly">Mensal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="config-retention">Retenção (dias)</Label>
                    <Input
                      id="config-retention"
                      type="number"
                      value={newConfig.retention_days}
                      onChange={(e) => setNewConfig(prev => ({ ...prev, retention_days: parseInt(e.target.value) || 30 }))}
                      min="1"
                      max="365"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="config-encrypted">Criptografar backup</Label>
                  <Switch
                    id="config-encrypted"
                    checked={newConfig.is_encrypted}
                    onCheckedChange={(checked) => setNewConfig(prev => ({ ...prev, is_encrypted: checked }))}
                  />
                </div>
                <div className="flex space-x-2">
                  <Button onClick={handleCreateConfig} disabled={loading}>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowNewConfigForm(false)}
                    disabled={loading}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {configs.map(config => (
              <div key={config.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-medium">{config.name}</h4>
                    {config.description && (
                      <p className="text-sm text-gray-600">{config.description}</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {config.is_encrypted && <Lock className="h-4 w-4 text-green-500" />}
                    <Badge variant="outline">{config.schedule}</Badge>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                  <span>Tabelas: {config.tables.join(', ')}</span>
                  <span>Retenção: {config.retention_days} dias</span>
                </div>

                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    onClick={() => handleCreateBackup(config.id!)}
                    disabled={loading}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Backup Agora
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCleanup(config.id!)}
                    disabled={loading}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Limpar Antigos
                  </Button>
                </div>
              </div>
            ))}
            
            {configs.length === 0 && !showNewConfigForm && (
              <div className="text-center py-8 text-gray-500">
                Nenhuma configuração de backup encontrada
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Backups Existentes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Backups Existentes</span>
          </CardTitle>
          <CardDescription>
            Gerencie backups existentes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {backups.map(backup => (
              <div key={backup.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-medium">{backup.filename}</h4>
                    <p className="text-sm text-gray-600">
                      {backup.backup_type} - {formatDate(backup.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {backup.is_encrypted && <Lock className="h-4 w-4 text-green-500" />}
                    {getStatusBadge(backup.status)}
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                  <span>Tamanho: {formatFileSize(backup.file_size)}</span>
                  <span>Linhas: {backup.row_count.toLocaleString()}</span>
                  <span>Tabelas: {backup.tables.length}</span>
                </div>

                {backup.status === 'completed' && (
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      onClick={() => handleRestoreBackup(backup.id)}
                      disabled={loading}
                    >
                      <Upload className="h-4 w-4 mr-1" />
                      Restaurar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteBackup(backup.id)}
                      disabled={loading}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Excluir
                    </Button>
                  </div>
                )}
                
                {backup.error_message && (
                  <div className="mt-2 p-2 bg-red-50 text-red-600 text-sm rounded">
                    {backup.error_message}
                  </div>
                )}
              </div>
            ))}
            
            {backups.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                Nenhum backup encontrado
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
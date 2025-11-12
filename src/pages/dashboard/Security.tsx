import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Shield, 
  Key, 
  Download, 
  Trash2, 
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useEncryption } from '@/hooks/useEncryption'
import { useSecurityAudit } from '@/hooks/useSecurityAudit'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function Security() {
  const { user } = useAuth()
  const { 
    isEncryptionAvailable, 
    rotateKey, 
    exportUserData, 
    deleteUserData,
    getKeyStatus,
  } = useEncryption()
  const { logSecurityEvent } = useSecurityAudit()
// toast notifications are handled by sonner

  const [loading, setLoading] = useState(false)
  const [auditLogs] = useState<any[]>([])
  const [encryptionStatus, setEncryptionStatus] = useState({
    enabled: false,
    keyAge: 0,
    lastRotation: null as Date | null
  })

  useEffect(() => {
    loadSecurityData()
  }, [])

  const loadSecurityData = async () => {
    try {
      // Carregar status da criptografia
      const status = await getKeyStatus()
      const lastRotation = status?.createdAt ?? null
      const keyAge = lastRotation ? Math.floor((Date.now() - lastRotation.getTime()) / (24 * 60 * 60 * 1000)) : 0
      setEncryptionStatus({
        enabled: isEncryptionAvailable,
        keyAge,
        lastRotation
      })

      // Registrar acesso à página de segurança
      await logSecurityEvent({
        event_type: 'security_page_access',
        event_category: 'system_config',
        severity: 'low',
        description: 'Usuário acessou página de segurança',
        success: true
      })
    } catch (error) {
      console.error('Erro ao carregar dados de segurança:', error)
    }
  }

  const handleRotateKey = async () => {
    setLoading(true)
    try {
      await rotateKey()
      toast.success('Chave de Criptografia Rotacionada', {
        description: 'Uma nova chave de criptografia foi gerada com sucesso.'
      })

      await logSecurityEvent({
        event_type: 'encryption_key_rotation',
        event_category: 'encryption',
        severity: 'medium',
        description: 'Chave de criptografia rotacionada',
        success: true
      })
    } catch (error) {
      toast.error('Erro ao Rotacionar Chave', {
        description: 'Não foi possível rotacionar a chave de criptografia.'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleExportData = async () => {
    setLoading(true)
    try {
      const data = await exportUserData()
      
      // Criar arquivo JSON para download
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dados-usuario-${user?.email}-${format(new Date(), 'yyyy-MM-dd')}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success('Dados Exportados', {
        description: 'Seus dados foram exportados com sucesso.'
      })

      await logSecurityEvent({
        event_type: 'data_export',
        event_category: 'data_access',
        severity: 'low',
        description: 'Exportação de dados pessoais realizada',
        success: true
      })
    } catch (error) {
      toast.error('Erro na Exportação', {
        description: 'Não foi possível exportar seus dados.'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteData = async () => {
    if (!confirm('Tem certeza que deseja solicitar a exclusão de todos os seus dados? Esta ação é irreversível.')) {
      return
    }

    setLoading(true)
    try {
      await deleteUserData()
      
      toast.success('Solicitação de Exclusão Enviada', {
        description: 'Sua solicitação de exclusão de dados foi registrada e será processada em até 30 dias.'
      })

      await logSecurityEvent({
        event_type: 'data_deletion_request',
        event_category: 'data_modification',
        severity: 'high',
        description: 'Solicitação de exclusão de dados pessoais',
        success: true
      })
    } catch (error) {
      toast.error('Erro na Solicitação', {
        description: 'Não foi possível processar sua solicitação de exclusão.'
      })
    } finally {
      setLoading(false)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive'
      case 'high': return 'destructive'
      case 'medium': return 'warning'
      case 'low': return 'secondary'
      default: return 'secondary'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Segurança e LGPD</h1>
          <p className="text-muted-foreground">
            Gerencie a segurança dos seus dados e cumpra as obrigações da LGPD
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="encryption">Criptografia</TabsTrigger>
          <TabsTrigger value="lgpd">LGPD</TabsTrigger>
          <TabsTrigger value="audit">Auditoria</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Criptografia
                </CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {encryptionStatus.enabled ? 'Ativa' : 'Inativa'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Proteção de dados sensíveis
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Última Rotação
                </CardTitle>
                <Key className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {encryptionStatus.lastRotation ? 
                    format(encryptionStatus.lastRotation, 'dd/MM', { locale: ptBR }) : 
                    'Nunca'
                  }
                </div>
                <p className="text-xs text-muted-foreground">
                  Das chaves de criptografia
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Auditoria
                </CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {auditLogs.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Eventos registrados
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Conformidade
                </CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  LGPD
                </div>
                <p className="text-xs text-muted-foreground">
                  Em conformidade
                </p>
              </CardContent>
            </Card>
          </div>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              A segurança dos seus dados é nossa prioridade. Todas as comunicações são criptografadas 
              e mantemos logs de auditoria para garantir a integridade e conformidade com a LGPD.
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="encryption" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Criptografia</CardTitle>
              <CardDescription>
                Gerencie as chaves de criptografia e proteção de dados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Status da Criptografia</h4>
                  <p className="text-sm text-muted-foreground">
                    {encryptionStatus.enabled 
                      ? 'Dados sensíveis estão sendo criptografados' 
                      : 'Criptografia não está ativa'
                    }
                  </p>
                </div>
                <Badge variant={encryptionStatus.enabled ? 'success' : 'secondary'}>
                  {encryptionStatus.enabled ? 'Ativa' : 'Inativa'}
                </Badge>
              </div>

              {encryptionStatus.enabled && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Rotação de Chaves</h4>
                      <p className="text-sm text-muted-foreground">
                        Gere uma nova chave de criptografia para maior segurança
                      </p>
                    </div>
                    <Button 
                      onClick={handleRotateKey} 
                      disabled={loading}
                      variant="outline"
                    >
                      <Key className="mr-2 h-4 w-4" />
                      Rotacionar Chave
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lgpd" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Direitos LGPD</CardTitle>
              <CardDescription>
                Exercite seus direitos conforme a Lei Geral de Proteção de Dados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Download className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <h4 className="font-medium">Exportar Dados Pessoais</h4>
                      <p className="text-sm text-muted-foreground">
                        Baixe todos os seus dados pessoais em formato JSON
                      </p>
                    </div>
                  </div>
                  <Button onClick={handleExportData} disabled={loading}>
                    Exportar
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Trash2 className="h-5 w-5 text-red-500" />
                    <div>
                      <h4 className="font-medium">Solicitar Exclusão de Dados</h4>
                      <p className="text-sm text-muted-foreground">
                        Solicite a exclusão de todos os seus dados pessoais
                      </p>
                    </div>
                  </div>
                  <Button 
                    onClick={handleDeleteData} 
                    disabled={loading}
                    variant="destructive"
                  >
                    Solicitar Exclusão
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Informações sobre Proteção de Dados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium">Como protegemos seus dados:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Criptografia de dados em repouso e em trânsito</li>
                  <li>Logs de auditoria para rastreabilidade</li>
                  <li>Controle de acesso baseado em permissões</li>
                  <li>Backup regular dos dados</li>
                  <li>Conformidade com a LGPD</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Seus direitos:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Acesso aos seus dados pessoais</li>
                  <li>Correção de dados incompletos ou inexatos</li>
                  <li>Portabilidade dos dados para outro serviço</li>
                  <li>Exclusão dos seus dados pessoais</li>
                  <li>Revogação do consentimento a qualquer momento</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Logs de Auditoria</CardTitle>
              <CardDescription>
                Visualize os eventos de segurança e auditoria do sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {auditLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhum evento de auditoria encontrado
                  </p>
                ) : (
                  <div className="space-y-2">
                    {auditLogs.map((log, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className={`w-2 h-2 rounded-full ${
                            log.success ? 'bg-green-500' : 'bg-red-500'
                          }`} />
                          <div>
                            <p className="text-sm font-medium">{log.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                        <Badge variant={getSeverityColor(log.severity)}>
                          {log.severity}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

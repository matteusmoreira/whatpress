import { useState, useEffect } from 'react'
import { Shield, AlertTriangle, CheckCircle, XCircle, Clock, User, Globe, Lock, Unlock } from 'lucide-react'
import { useSecurityAudit } from '@/hooks/useSecurityAudit'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton.tsx'

interface SecurityEventDisplay {
  id: string
  eventType: string
  eventSubtype: string
  success: boolean
  userId?: string
  ipAddress?: string
  createdAt: string
  metadata?: any
}

export function SecurityDashboard() {
  const { getSecurityEvents, getSecurityStats } = useSecurityAudit()
  const [events, setEvents] = useState<SecurityEventDisplay[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedEventType, setSelectedEventType] = useState<string>('all')

  const eventTypes = [
    { value: 'all', label: 'Todos os Eventos' },
    { value: 'authentication', label: 'Autenticação' },
    { value: 'data_access', label: 'Acesso a Dados' },
    { value: 'encryption', label: 'Criptografia' },
    { value: 'backup', label: 'Backup' },
    { value: 'security_breach', label: 'Violação de Segurança' }
  ]

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [eventsData, statsData] = await Promise.all([
        getSecurityEvents(50),
        getSecurityStats()
      ])
      setEvents(eventsData)
      setStats(statsData)
    } catch (error) {
      console.error('Erro ao carregar dados de segurança:', error)
    } finally {
      setLoading(false)
    }
  }

  const getEventIcon = (eventType: string, success: boolean) => {
    const iconClass = success ? 'text-green-500' : 'text-red-500'
    
    switch (eventType) {
      case 'authentication':
        return success ? <CheckCircle className={`w-5 h-5 ${iconClass}`} /> : <XCircle className={`w-5 h-5 ${iconClass}`} />
      case 'data_access':
        return <Globe className="w-5 h-5 text-blue-500" />
      case 'encryption':
        return success ? <Lock className={`w-5 h-5 ${iconClass}`} /> : <Unlock className={`w-5 h-5 ${iconClass}`} />
      case 'backup':
        return <Shield className="w-5 h-5 text-purple-500" />
      case 'security_breach':
        return <AlertTriangle className="w-5 h-5 text-orange-500" />
      default:
        return <Clock className="w-5 h-5 text-gray-500" />
    }
  }

  const getEventTypeLabel = (eventType: string) => {
    switch (eventType) {
      case 'authentication': return 'Autenticação'
      case 'data_access': return 'Acesso a Dados'
      case 'encryption': return 'Criptografia'
      case 'backup': return 'Backup'
      case 'security_breach': return 'Violação de Segurança'
      default: return eventType
    }
  }

  const getEventSubtypeLabel = (subtype: string) => {
    switch (subtype) {
      case 'login': return 'Login'
      case 'logout': return 'Logout'
      case 'login_failed': return 'Falha de Login'
      case 'password_reset_request': return 'Solicitação de Reset de Senha'
      case 'password_reset_failed': return 'Falha no Reset de Senha'
      case 'registration': return 'Registro'
      case 'registration_failed': return 'Falha no Registro'
      case 'data_encrypted': return 'Dados Criptografados'
      case 'data_decrypted': return 'Dados Descriptografados'
      case 'encryption_error': return 'Erro de Criptografia'
      case 'backup_created': return 'Backup Criado'
      case 'backup_failed': return 'Falha no Backup'
      case 'backup_restored': return 'Backup Restaurado'
      case 'unauthorized_access': return 'Acesso Não Autorizado'
      case 'suspicious_activity': return 'Atividade Suspeita'
      default: return subtype
    }
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

  const filteredEvents = selectedEventType === 'all' 
    ? events 
    : events.filter(event => event.eventType === selectedEventType)

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  <Skeleton className="h-4 w-24" />
                </CardTitle>
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-4 w-32 mt-1" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Eventos de Segurança</CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Cards de Estatísticas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Eventos</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalEvents || 0}</div>
            <p className="text-xs text-muted-foreground">
              Últimas 24h: {stats?.events24h || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Falhas de Segurança</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats?.failedEvents || 0}</div>
            <p className="text-xs text-muted-foreground">
              Últimas 24h: {stats?.failedEvents24h || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Logins Bem-sucedidos</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats?.successfulLogins || 0}</div>
            <p className="text-xs text-muted-foreground">
              Últimas 24h: {stats?.successfulLogins24h || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Falhas de Login</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{stats?.failedLogins || 0}</div>
            <p className="text-xs text-muted-foreground">
              Últimas 24h: {stats?.failedLogins24h || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Eventos */}
      <Card>
        <CardHeader>
          <CardTitle>Eventos de Segurança</CardTitle>
          <CardDescription>
            Registro de eventos de segurança do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <select
              value={selectedEventType}
              onChange={(e) => setSelectedEventType(e.target.value)}
              className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {eventTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-4">
            {filteredEvents.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Nenhum evento de segurança encontrado
              </div>
            ) : (
              filteredEvents.map(event => (
                <div key={event.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                  <div className="flex-shrink-0 mt-1">
                    {getEventIcon(event.eventType, event.success)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-sm">
                          {getEventSubtypeLabel(event.eventSubtype)}
                        </span>
                        <Badge variant={event.success ? "default" : "destructive"}>
                          {event.success ? 'Sucesso' : 'Falha'}
                        </Badge>
                      </div>
                      <span className="text-xs text-gray-500">
                        {formatDate(event.createdAt)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center space-x-4 text-xs text-gray-600">
                      {event.userId && (
                        <div className="flex items-center space-x-1">
                          <User className="w-3 h-3" />
                          <span>{event.userId.substring(0, 8)}...</span>
                        </div>
                      )}
                      {event.ipAddress && (
                        <div className="flex items-center space-x-1">
                          <Globe className="w-3 h-3" />
                          <span>{event.ipAddress}</span>
                        </div>
                      )}
                      <div className="flex items-center space-x-1">
                        <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                          {getEventTypeLabel(event.eventType)}
                        </span>
                      </div>
                    </div>
                    {event.metadata?.error && (
                      <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                        {event.metadata.error}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-6 flex justify-center">
            <Button variant="outline" onClick={loadData}>
              Atualizar Dados
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

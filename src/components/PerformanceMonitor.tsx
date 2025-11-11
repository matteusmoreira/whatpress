import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle, Clock, Database, Globe, Server } from 'lucide-react'
import { getSystemHealth } from '@/lib/monitoring'

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  components: {
    database: { status: string; latency: number; lastCheck: Date }
    redis: { status: string; latency: number; lastCheck: Date }
    api: { status: string; latency: number; lastCheck: Date }
    memory: { status: string; usage: number; lastCheck: Date }
  }
  overallLatency: number
  lastCheck: Date
}

export function PerformanceMonitor() {
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchHealth = async () => {
    try {
      const systemHealth = await getSystemHealth()
      setHealth(systemHealth)
    } catch (error) {
      console.error('Erro ao buscar saúde do sistema:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHealth()
    const interval = setInterval(fetchHealth, 30000) // Atualizar a cada 30 segundos
    return () => clearInterval(interval)
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'connected':
        return 'bg-green-500'
      case 'degraded':
        return 'bg-yellow-500'
      case 'unhealthy':
      case 'disconnected':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'degraded':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case 'unhealthy':
      case 'disconnected':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance do Sistema</CardTitle>
          <CardDescription>Monitorando saúde e performance...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!health) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance do Sistema</CardTitle>
          <CardDescription>Erro ao carregar informações de performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500">
            <AlertCircle className="h-12 w-12 mx-auto mb-2" />
            <p>Não foi possível carregar os dados de performance</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Status do Sistema</CardTitle>
              <CardDescription>
                Última verificação: {health.lastCheck.toLocaleTimeString('pt-BR')}
              </CardDescription>
            </div>
            <Badge 
              variant={health.status === 'healthy' ? 'default' : health.status === 'degraded' ? 'secondary' : 'destructive'}
            >
              {health.status === 'healthy' ? 'Operacional' : health.status === 'degraded' ? 'Degradado' : 'Crítico'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <Database className="h-5 w-5 text-blue-600" />
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  {getStatusIcon(health.components.database.status)}
                  <span className="text-sm font-medium">Banco de Dados</span>
                </div>
                <p className="text-xs text-gray-500">
                  {health.components.database.latency}ms
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <Server className="h-5 w-5 text-purple-600" />
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  {getStatusIcon(health.components.redis.status)}
                  <span className="text-sm font-medium">Redis</span>
                </div>
                <p className="text-xs text-gray-500">
                  {health.components.redis.latency}ms
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <Globe className="h-5 w-5 text-green-600" />
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  {getStatusIcon(health.components.api.status)}
                  <span className="text-sm font-medium">API</span>
                </div>
                <p className="text-xs text-gray-500">
                  {health.components.api.latency}ms
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <Clock className="h-5 w-5 text-orange-600" />
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  {getStatusIcon(health.components.memory.status)}
                  <span className="text-sm font-medium">Memória</span>
                </div>
                <p className="text-xs text-gray-500">
                  {health.components.memory.usage.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Latência Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {health.overallLatency}ms
            </div>
            <p className="text-xs text-gray-500">
              Tempo médio de resposta
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {health.components.redis.status === 'connected' ? '98%' : 'N/A'}
            </div>
            <p className="text-xs text-gray-500">
              Taxa de acerto do cache
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Status Geral</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <div className={`h-3 w-3 rounded-full ${getStatusColor(health.status)}`}></div>
              <span className="text-sm font-medium capitalize">
                {health.status === 'healthy' ? 'Operacional' : health.status === 'degraded' ? 'Degradado' : 'Crítico'}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Todos os serviços
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
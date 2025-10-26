import { useEffect } from 'react'
import { useQuotas } from '@/hooks/useQuotas'
import { toast } from 'sonner'

type Usage = { current: number; max: number; percentage: number; status?: string } | null | undefined

interface QuotaAlertsManagerProps {
  showCriticalToast?: boolean
  usage?: Usage
  resourceLabel?: string
  autoAcknowledge?: boolean
}

// Componente leve que centraliza a exibição de toasts de alertas de quota
// e, opcionalmente, um toast para estado crítico de uso.
export function QuotaAlertsManager({ showCriticalToast = false, usage, resourceLabel = 'campanhas', autoAcknowledge = true }: QuotaAlertsManagerProps) {
  const { alerts, acknowledgeAlert } = useQuotas()

  useEffect(() => {
    if (!alerts || alerts.length === 0) return
    const nf = new Intl.NumberFormat('pt-BR')
    alerts.forEach(alert => {
      const title = alert.alert_type === '100_percent' ? 'Limite atingido' : 'Uso elevado'
      const current = nf.format(alert.current_usage)
      const max = nf.format(alert.max_limit)
      const perc = Math.round(alert.percentage)
      const description = `Recurso ${alert.resource_type}: ${current}/${max} (${perc}%).`
      if (alert.alert_type === '100_percent') {
        toast.error(`${title}. ${description}`)
      } else {
        toast.warning(`${title}. ${description}`)
      }
      // marcar como reconhecido após exibição, se habilitado
      if (autoAcknowledge) {
        acknowledgeAlert(alert.id)
      }
    })
  }, [alerts, acknowledgeAlert, autoAcknowledge])

  useEffect(() => {
    if (showCriticalToast && usage && (usage as any)?.status === 'critical') {
      const nf = new Intl.NumberFormat('pt-BR')
      const current = nf.format((usage as any).current)
      const max = nf.format((usage as any).max)
      const perc = Math.round((usage as any).percentage)
      toast.warning(`Atingiu ${perc}% do limite de ${resourceLabel} (${current}/${max}).`)
    }
  }, [showCriticalToast, usage, resourceLabel])

  return null
}
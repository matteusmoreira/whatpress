import React from 'react'
import { AlertCircle } from 'lucide-react'

// Nota: este componente padroniza a renderização do banner de gating/quota
// e deve ser reutilizado em páginas como Campaigns e CreateCampaign.

type Usage = { current: number; max: number; percentage: number; status?: string } | null | undefined

interface GatingBannerProps {
  campaignsQuotaBlocked?: boolean
  messagesFeatureBlocked?: boolean
  rateLimitedNow?: boolean
  criticalState?: boolean
  campaignsUsage?: Usage
  nextAllowedTime?: number | Date | null
  // Extensão genérica para outros recursos (ex.: contatos, conexões)
  resourceLabel?: string
  resourceUsage?: Usage
  resourceQuotaBlocked?: boolean
  // Controle de como exibir o próximo envio: relativo, absoluto ou ambos
  rateTimeMode?: 'relative' | 'absolute' | 'both'
}

export function GatingBanner({
  campaignsQuotaBlocked,
  messagesFeatureBlocked,
  rateLimitedNow,
  criticalState,
  campaignsUsage,
  nextAllowedTime,
  resourceLabel,
  resourceUsage,
  resourceQuotaBlocked,
  rateTimeMode,
}: GatingBannerProps) {
  const show = Boolean(
    campaignsQuotaBlocked ||
    messagesFeatureBlocked ||
    rateLimitedNow ||
    criticalState ||
    resourceQuotaBlocked
  )
  if (!show) return null

  const isBlocked = Boolean(campaignsQuotaBlocked || resourceQuotaBlocked)
  const isWarning = Boolean(messagesFeatureBlocked || rateLimitedNow || criticalState)

  const containerClass = `p-4 rounded-md border ${
    isBlocked
      ? 'bg-red-50 border-red-200'
      : isWarning
      ? 'bg-amber-50 border-amber-200'
      : 'bg-yellow-50 border-yellow-200'
  }`

  const iconClass = `h-5 w-5 ${
    isBlocked
      ? 'text-red-600'
      : isWarning
      ? 'text-amber-600'
      : 'text-yellow-600'
  }`

  const formatAbsoluteTime = (t?: number | Date | null) => {
    if (!t) return 'em breve'
    try {
      const dt = t instanceof Date ? t : new Date(t as number)
      return dt.toLocaleString('pt-BR')
    } catch {
      return 'em breve'
    }
  }

  const formatRelativeTime = (t?: number | Date | null) => {
    if (!t) return 'em breve'
    try {
      const target = t instanceof Date ? (t as Date).getTime() : (t as number)
      const now = Date.now()
      const diff = Math.max(0, target - now)
      const seconds = Math.floor(diff / 1000)
      if (seconds < 60) return `${seconds}s`
      const minutes = Math.floor(seconds / 60)
      if (minutes < 60) return `${minutes}m`
      const hours = Math.floor(minutes / 60)
      const remMinutes = minutes % 60
      if (hours < 24) return remMinutes ? `${hours}h ${remMinutes}m` : `${hours}h`
      const days = Math.floor(hours / 24)
      const remHours = hours % 24
      return remHours ? `${days}d ${remHours}h` : `${days}d`
    } catch {
      return 'em breve'
    }
  }

  const label = resourceLabel || 'recursos'
  const usageToShow = campaignsUsage ?? resourceUsage
  const nf = new Intl.NumberFormat('pt-BR')
  const formatted = usageToShow
    ? {
        current: nf.format(usageToShow.current),
        max: nf.format(usageToShow.max),
        percentage:
          typeof usageToShow.percentage === 'number'
            ? Math.round(usageToShow.percentage)
            : undefined,
      }
    : null

  return (
    <div className={containerClass}>
      <div className="flex items-start gap-3">
        <AlertCircle className={iconClass} />
        <div className="text-sm">
          {campaignsQuotaBlocked ? (
            <>
              <p className="font-medium">Limite de campanhas atingido</p>
              {usageToShow && (
                <p>
                  Uso: {formatted?.current}/{formatted?.max}
                  {formatted?.percentage !== undefined ? ` (${formatted.percentage}%)` : ''}
                </p>
              )}
              <p>Você não pode criar novas campanhas. Exclua campanhas antigas ou atualize seu plano.</p>
            </>
          ) : resourceQuotaBlocked ? (
            <>
              <p className="font-medium">Limite de {label} atingido</p>
              {usageToShow && (
                <p>
                  Uso: {formatted?.current}/{formatted?.max}
                  {formatted?.percentage !== undefined ? ` (${formatted.percentage}%)` : ''}
                </p>
              )}
              <p>Você não pode criar novos {label}. Exclua itens antigos ou atualize seu plano.</p>
            </>
          ) : messagesFeatureBlocked ? (
            <>
              <p className="font-medium">Envio de mensagens bloqueado</p>
              <p>Seu plano atual bloqueia o envio de mensagens. Atualize seu plano para iniciar campanhas.</p>
            </>
          ) : rateLimitedNow ? (
            <>
              <p className="font-medium">Limite de envio ativo</p>
              <p>
                {rateTimeMode === 'absolute' && <>Próximo envio permitido {nextAllowedTime ? formatAbsoluteTime(nextAllowedTime) : 'em breve'}.</>}
                {rateTimeMode === 'relative' && <>Próximo envio permitido em {formatRelativeTime(nextAllowedTime)}.</>}
                {(!rateTimeMode || rateTimeMode === 'both') && <>Próximo envio permitido em {formatRelativeTime(nextAllowedTime)}{nextAllowedTime ? ` (${formatAbsoluteTime(nextAllowedTime)})` : ''}.</>}
              </p>
            </>
          ) : (
            <>
              <p className="font-medium">{criticalState ? `Uso crítico de ${label}` : 'Atenção aos limites'}</p>
              {usageToShow && (
                <p>
                  Uso: {formatted?.current}/{formatted?.max}
                  {formatted?.percentage !== undefined ? ` (${formatted.percentage}%)` : ''}
                </p>
              )}
              {criticalState && (
                <p>Considere reduzir itens ativos, encerrar rascunhos antigos ou atualizar seu plano.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

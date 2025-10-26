import type React from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

// Serviço de logging de erros de UI
// Registra erros capturados pelo ErrorBoundary em uma tabela de auditoria via RPC log_user_action.
// Degrada com segurança quando o Supabase não está configurado.

// Throttle e deduplicação básica em memória para evitar spam de logs em loops de erro
const DEFAULT_THROTTLE_MS = 15_000
const MAX_FINGERPRINTS = 100

const errorLogMemory = new Map<string, { lastTs: number; suppressedCount: number }>()
let overrideThrottleMs: number | null = null

function nowTs(): number {
  return Date.now()
}

function getThrottleMs(): number {
  // Permite ajustar via env, senão usa padrão
  if (overrideThrottleMs && overrideThrottleMs > 0) return overrideThrottleMs
  const fromEnv = Number(import.meta?.env?.VITE_UI_ERROR_LOG_THROTTLE_MS)
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_THROTTLE_MS
}

function computeErrorFingerprint(error: Error, errorInfo?: React.ErrorInfo): string {
  const name = error?.name ?? 'Error'
  const msg = error?.message ?? ''
  const firstStackLine = (error?.stack || '').split('\n')[0] ?? ''
  const compStackHead = (errorInfo?.componentStack || '').split('\n').slice(0, 3).join('|')
  const path = typeof window !== 'undefined' ? window.location.pathname : ''
  // Fingerprint simples e estável para o mesmo erro/rota
  return [name, msg, firstStackLine, compStackHead, path].join('::')
}

function shouldLogByThrottle(fp: string): { shouldLog: boolean; suppressedCount: number } {
  const tMs = getThrottleMs()
  const ts = nowTs()

  const entry = errorLogMemory.get(fp)
  if (!entry) {
    // LRU simples: se muitos fingerprints, resetar memória
    if (errorLogMemory.size >= MAX_FINGERPRINTS) {
      errorLogMemory.clear()
    }
    errorLogMemory.set(fp, { lastTs: ts, suppressedCount: 0 })
    return { shouldLog: true, suppressedCount: 0 }
  }

  const elapsed = ts - entry.lastTs
  if (elapsed < tMs) {
    entry.suppressedCount += 1
    errorLogMemory.set(fp, entry)
    return { shouldLog: false, suppressedCount: entry.suppressedCount }
  }

  // Janela expirou: vamos logar e resetar contador
  const suppressed = entry.suppressedCount
  errorLogMemory.set(fp, { lastTs: ts, suppressedCount: 0 })
  return { shouldLog: true, suppressedCount: suppressed }
}

// Test utils para vitest (não afetam produção)
export function __setErrorLoggingThrottleMs(ms: number | null) {
  overrideThrottleMs = ms && ms > 0 ? ms : null
}

export function __resetErrorLoggingMemory() {
  errorLogMemory.clear()
}

function getCurrentUserId(): Promise<string | null> {
  try {
    return supabase.auth.getSession()
      .then(({ data }) => data?.session?.user?.id ?? null)
      .catch(() => null)
  } catch {
    return Promise.resolve(null)
  }
}

function getCurrentTenantId(): string | null {
  try {
    // useTenant persiste o tenant selecionado no localStorage
    return localStorage.getItem('selected_tenant_id')
  } catch {
    return null
  }
}

export async function logUIError(error: Error, errorInfo?: React.ErrorInfo): Promise<void> {
  // Throttle para evitar spam em loops
  const fingerprint = computeErrorFingerprint(error, errorInfo)
  const throttleCheck = shouldLogByThrottle(fingerprint)
  if (!throttleCheck.shouldLog) {
    // Apenas reporta no console para diagnosticar que houve supressão
    console.debug('[UIError] suprimido por throttle', { fingerprint, suppressedCount: throttleCheck.suppressedCount })
    return
  }

  // Coletar contexto do usuário/tenant
  const [userId, tenantId] = await Promise.all([
    getCurrentUserId(),
    Promise.resolve(getCurrentTenantId()),
  ])

  // Montar detalhes ricos sobre o erro e ambiente
  const details = {
    message: error?.message,
    name: error?.name,
    stack: (error?.stack || '').split('\n').slice(0, 25),
    componentStack: errorInfo?.componentStack,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    path: typeof window !== 'undefined' ? window.location.pathname : undefined,
    search: typeof window !== 'undefined' ? window.location.search : undefined,
    hash: typeof window !== 'undefined' ? window.location.hash : undefined,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    language: typeof navigator !== 'undefined' ? navigator.language : undefined,
    online: typeof navigator !== 'undefined' ? navigator.onLine : undefined,
    time: new Date().toISOString(),
    viteDev: import.meta.env?.DEV ?? false,
    supabaseConfigured: isSupabaseConfigured,
    fingerprint,
    throttledWindowMs: getThrottleMs(),
    suppressedCount: throttleCheck.suppressedCount,
  }

  try {
    // Mesmo quando supabase não está configurado, nosso client no-op retorna um objeto seguro.
    await supabase.rpc('log_user_action', {
      p_user_id: userId,
      p_tenant_id: tenantId,
      p_action: 'ui_error',
      p_resource: 'client',
      p_resource_id: null,
      p_details: details,
    })
  } catch (rpcErr) {
    // Nunca quebrar a UI por falha de logging
    console.warn('Falha ao registrar erro de UI via Supabase RPC', rpcErr)
  }
}

// Utilitário genérico caso desejarmos registrar eventos adicionais (não apenas erros)
export async function logUserEvent(
  action: string,
  resource?: string,
  extraDetails: Record<string, any> = {}
): Promise<void> {
  const [userId, tenantId] = await Promise.all([
    getCurrentUserId(),
    Promise.resolve(getCurrentTenantId()),
  ])

  try {
    await supabase.rpc('log_user_action', {
      p_user_id: userId,
      p_tenant_id: tenantId,
      p_action: action,
      p_resource: resource ?? null,
      p_resource_id: null,
      p_details: extraDetails ?? {},
    })
  } catch (err) {
    console.warn('Falha ao registrar evento de usuário', err)
  }
}
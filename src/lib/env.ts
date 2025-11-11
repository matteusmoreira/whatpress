// Centralized environment helpers
// Detect test environment reliably across Vite/Vitest and Node

export const isTestEnv: boolean = (() => {
  try {
    // Vitest exposes import.meta.vitest
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && (import.meta as any).vitest) return true
    // Vite sets MODE to 'test' when running Vitest
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.MODE === 'test') return true
  } catch {}
  // Fallback for Node-based contexts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proc: any = typeof process !== 'undefined' ? process : undefined
  if (proc && proc.env) {
    if (proc.env.VITEST) return true
    if (proc.env.NODE_ENV === 'test') return true
  }
  return false
})()

export const isDevEnv: boolean = (() => {
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.MODE === 'development') return true
  } catch {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proc: any = typeof process !== 'undefined' ? process : undefined
  return !!(proc && proc.env && proc.env.NODE_ENV === 'development')
})()

export const isProdEnv: boolean = (() => {
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.MODE === 'production') return true
  } catch {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proc: any = typeof process !== 'undefined' ? process : undefined
  return !!(proc && proc.env && proc.env.NODE_ENV === 'production')
})()

// Unified env accessor with safe fallbacks for tests and Node
// Provides commonly used VITE_* variables to avoid runtime TypeErrors
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const metaEnv: any = (() => {
  try {
    // @ts-ignore
    return typeof import.meta !== 'undefined' ? (import.meta as any).env ?? {} : {}
  } catch {
    return {}
  }
})()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeEnv: any = (typeof process !== 'undefined' && (process as any).env) ? (process as any).env : {}

const getVar = (key: string, def?: string): string => {
  const v = (metaEnv && key in metaEnv ? metaEnv[key] : undefined) ?? (nodeEnv ? nodeEnv[key] : undefined)
  return typeof v === 'string' && v.length > 0 ? v : (def ?? '')
}

export const env = {
  // Redis
  VITE_REDIS_HOST: getVar('VITE_REDIS_HOST', 'localhost'),
  VITE_REDIS_PORT: getVar('VITE_REDIS_PORT', '6379'),
  VITE_REDIS_PASSWORD: getVar('VITE_REDIS_PASSWORD', ''),
  VITE_REDIS_DB: getVar('VITE_REDIS_DB', '0'),
  VITE_REDIS_QUEUE_DB: getVar('VITE_REDIS_QUEUE_DB', '1'),
  VITE_REDIS_TLS: getVar('VITE_REDIS_TLS', 'false'),

  // Sentry / Monitoring
  VITE_SENTRY_DSN: getVar('VITE_SENTRY_DSN', ''),
  VITE_ENVIRONMENT: getVar('VITE_ENVIRONMENT', isTestEnv ? 'test' : (isDevEnv ? 'development' : 'production')),

  // API base
  VITE_API_URL: getVar('VITE_API_URL', ''),

  // Supabase
  VITE_SUPABASE_URL: getVar('VITE_SUPABASE_URL', ''),
  VITE_SUPABASE_ANON_KEY: getVar('VITE_SUPABASE_ANON_KEY', ''),

  // Evolution API
  VITE_EVOLUTION_API_URL: getVar('VITE_EVOLUTION_API_URL', ''),
  VITE_EVOLUTION_API_KEY: getVar('VITE_EVOLUTION_API_KEY', ''),
  VITE_EVOLUTION_INSTANCE_NAME: getVar('VITE_EVOLUTION_INSTANCE_NAME', ''),

  // Webhook
  VITE_WEBHOOK_URL: getVar('VITE_WEBHOOK_URL', ''),
}
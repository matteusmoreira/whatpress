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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock do cliente Supabase e flag de configuração
vi.mock('@/lib/supabase', () => {
  const rpc = vi.fn().mockResolvedValue({ data: null })
  const getSession = vi.fn().mockResolvedValue({ data: { session: { user: { id: 'user1' } } } })
  return {
    supabase: { rpc, auth: { getSession } },
    isSupabaseConfigured: true,
  }
})

import { logUIError, __setErrorLoggingThrottleMs, __resetErrorLoggingMemory } from '@/services/errorLogging'
import { supabase } from '@/lib/supabase'

describe('errorLogging logUIError', () => {
  beforeEach(() => {
    __resetErrorLoggingMemory()
    __setErrorLoggingThrottleMs(100) // 100ms para testes
    localStorage.setItem('selected_tenant_id', 'tenant1')
  })

  afterEach(() => {
    __setErrorLoggingThrottleMs(null)
    localStorage.clear()
  })

  it('deve logar o primeiro erro e suprimir subsequentes dentro da janela de throttle', async () => {
    const error = new Error('Boom')
    const errorInfo = { componentStack: 'at DevErrorPage\n at ErrorBoundary' } as any

    await logUIError(error, errorInfo)
    await logUIError(error, errorInfo)

    // Apenas uma chamada dentro da janela
    expect((supabase.rpc as any).mock.calls.length).toBe(1)

    // Aguardar expirar a janela e logar novamente
    await new Promise((res) => setTimeout(res, 120))
    await logUIError(error, errorInfo)

    expect((supabase.rpc as any).mock.calls.length).toBe(2)

    const lastArgs = (supabase.rpc as any).mock.calls.at(-1)[1]
    expect(lastArgs.p_action).toBe('ui_error')
    expect(lastArgs.p_tenant_id).toBe('tenant1')
    expect(lastArgs.p_user_id).toBe('user1')

    // Deve incluir fingerprint e suppressedCount acumulado
    expect(lastArgs.p_details.fingerprint).toBeDefined()
    expect(lastArgs.p_details.suppressedCount).toBeGreaterThanOrEqual(1)
  })
})
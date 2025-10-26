import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Simula ambiente sem Supabase configurado (DEV)
vi.mock('@/lib/supabase', () => {
  const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error('Supabase não configurado') })
  const getSession = vi.fn().mockResolvedValue({ data: { session: null } })
  return {
    supabase: { rpc, auth: { getSession } },
    isSupabaseConfigured: false,
  }
})

import { logUIError, __setErrorLoggingThrottleMs, __resetErrorLoggingMemory } from '@/services/errorLogging'
import { supabase } from '@/lib/supabase'

describe('errorLogging degrade quando Supabase NÃO está configurado (DEV)', () => {
  beforeEach(() => {
    __resetErrorLoggingMemory()
    __setErrorLoggingThrottleMs(50) // janela curta para evitar flakiness
    try { localStorage.removeItem('selected_tenant_id') } catch {}
  })

  afterEach(() => {
    __setErrorLoggingThrottleMs(null)
    try { localStorage.clear() } catch {}
  })

  it('não deve lançar erro e deve incluir supabaseConfigured=false nos detalhes', async () => {
    const error = new Error('Erro intencional para teste')

    // Chama o logger; deve resolver sem lançar
    await expect(logUIError(error)).resolves.toBeUndefined()

    // O RPC deve ter sido chamado uma vez
    expect((supabase.rpc as any).mock.calls.length).toBe(1)

    const lastArgs = (supabase.rpc as any).mock.calls.at(-1)[1]
    expect(lastArgs.p_action).toBe('ui_error')
    expect(lastArgs.p_details.supabaseConfigured).toBe(false)
    expect(lastArgs.p_details.name).toBe('Error')
    expect(lastArgs.p_details.message).toBe('Erro intencional para teste')
  })
})
import { createClient } from '@supabase/supabase-js'

// Frontend Supabase client
// Uses Vite environment variables (prefixed with VITE_) defined in .env
const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL
const rawSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Security configuration
const encryptionKey = import.meta.env.VITE_ENCRYPTION_KEY
const rateLimitEnabled = import.meta.env.VITE_RATE_LIMIT_ENABLED === 'true'
const securityAuditEnabled = import.meta.env.VITE_SECURITY_AUDIT_ENABLED === 'true'

// Sanitize env values to avoid hidden CRLF/newlines breaking WebSocket auth
const supabaseUrl = String(rawSupabaseUrl || '').replace(/\r?\n/g, '').trim()
const supabaseAnonKey = String(rawSupabaseAnonKey || '').replace(/\r?\n/g, '').trim()
const hasEnv = Boolean(supabaseUrl && supabaseAnonKey)

function createNoopClient(): any {
  // No-op client that safely mimics Supabase API to avoid runtime crashes
  // when environment variables are missing. It returns predictable results
  // and errors that can be handled gracefully by consumers.

  function createNoopBuilder(type: 'list' | 'single' = 'list') {
    const builder: any = {
      data: type === 'list' ? [] : null,
      error: new Error('Supabase não configurado'),
      count: type === 'list' ? 0 : null,
    }

    // Chainable no-op methods returning same object to preserve method availability
    builder.select = (_columns?: string, _opts?: any) => builder
    builder.insert = (_values?: any) => builder
    builder.update = (_values?: any) => builder
    builder.delete = () => builder
    builder.eq = (_column?: string, _value?: any) => builder
    builder.gt = (_column?: string, _value?: any) => builder
    builder.lt = (_column?: string, _value?: any) => builder
    builder.lte = (_column?: string, _value?: any) => builder
    builder.gte = (_column?: string, _value?: any) => builder
    builder.order = (_column?: string, _options?: any) => builder
    builder.limit = (_count?: number) => builder
    builder.range = (_from?: number, _to?: number) => builder
    builder.single = () => { builder.data = null; builder.count = null; return builder }

    return builder
  }

  return {
    // Database API
    from: (_table: string) => createNoopBuilder('list'),
    rpc: async (_fn: string, _params?: Record<string, any>) => ({ data: null, error: new Error('Supabase não configurado'), count: null }),

    // Realtime/channel API
    channel: (_name: string) => ({
      on: (_eventType: any, _filter: any, _callback: any) => {
        // Chainable
        return this
      },
      subscribe: () => ({ unsubscribe() {} }),
    }),

    // Auth API (minimal safe implementations)
    auth: {
      async signInWithPassword() {
        return { data: { session: null }, error: new Error('Supabase não configurado') }
      },
      async signOut() {
        return { error: null }
      },
      async getSession() {
        return { data: { session: null }, error: null }
      },
      onAuthStateChange() {
        return { data: { subscription: { unsubscribe() {} } } }
      },
    },
  }
}

export const supabase = hasEnv
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : createNoopClient()

export const isSupabaseConfigured = hasEnv

export const securityConfig = {
  encryptionKey,
  rateLimitEnabled,
  securityAuditEnabled
}

export default supabase
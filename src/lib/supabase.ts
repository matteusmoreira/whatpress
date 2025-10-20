import { createClient } from '@supabase/supabase-js'

// Frontend Supabase client
// Uses Vite environment variables (prefixed with VITE_) defined in .env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const hasEnv = Boolean(supabaseUrl && supabaseAnonKey)

function createNoopClient(): any {
  // No-op client that safely mimics Supabase API to avoid runtime crashes
  // when environment variables are missing. It returns predictable results
  // and errors that can be handled gracefully by consumers.

  // Helper: generic response objects
  const listResponse = { data: [], error: new Error('Supabase não configurado'), count: 0 }
  const singleResponse = { data: null, error: new Error('Supabase não configurado'), count: null }

  // Helper: create a thenable builder that supports common Postgrest methods
  function createBuilder(responseType: 'list' | 'single' = 'list') {
    const baseResponse = responseType === 'list' ? listResponse : singleResponse

    const builder: any = {
      select: (_columns?: string, _opts?: any) => builder,
      insert: (_values?: any) => builder,
      update: (_values?: any) => builder,
      delete: () => builder,
      eq: (_column?: string, _value?: any) => builder,
      gt: (_column?: string, _value?: any) => builder,
      lt: (_column?: string, _value?: any) => builder,
      lte: (_column?: string, _value?: any) => builder,
      gte: (_column?: string, _value?: any) => builder,
      order: (_column?: string, _options?: any) => builder,
      limit: (_count?: number) => builder,
      single: () => createBuilder('single'),
      // Thenable interface so `await` works
      then: (resolve: (value: any) => void) => resolve(baseResponse),
      catch: (reject: (reason?: any) => void) => reject(baseResponse.error),
    }

    return builder
  }

  return {
    // Database API
    from: (_table: string) => createBuilder('list'),
    rpc: (_fn: string, _params?: Record<string, any>) => Promise.resolve(singleResponse),

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

export default supabase
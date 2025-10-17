import { createClient } from '@supabase/supabase-js'

// Frontend Supabase client
// Uses Vite environment variables (prefixed with VITE_) defined in .env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const hasEnv = Boolean(supabaseUrl && supabaseAnonKey)

function createNoopClient(): any {
  // Minimal no-op client to avoid runtime errors when env is missing
  return {
    auth: {
      async signInWithPassword() {
        return { data: { session: null }, error: new Error('Supabase not configured') }
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

export default supabase
import { useCallback, useEffect, useState } from 'react'
import supabase from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import { isTestEnv } from '@/lib/env'

export interface AuthUser {
  id: string
  name: string
  email: string
  role?: 'user' | 'admin' | 'superadmin'
  plan?: string
  company?: string
  created_at?: string
}

interface AuthState {
  user: AuthUser | null
  loading: boolean
}

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>({ user: null, loading: true })

  const mapSupabaseUser = (user: User | null): AuthUser | null => {
    if (!user) return null
    const email = user.email ?? ''
    const nameFromEmail = email.split('@')[0] || 'User'
    return {
      id: user.id,
      name: user.user_metadata?.name || 
            nameFromEmail.charAt(0).toUpperCase() + nameFromEmail.slice(1),
      email,
      company: user.user_metadata?.company || '',
      role: 'user',
      plan: 'Free',
      created_at: user.created_at
    }
  }

  useEffect(() => {
    let mounted = true

    // In test env, avoid registering auth listeners and async state updates
    if (isTestEnv) {
      if (mounted) setAuth({ user: null, loading: false })
      return () => { mounted = false }
    }

    const loadSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) throw error
        if (!mounted) return
        setAuth({ user: mapSupabaseUser(session?.user ?? null), loading: false })
      } catch (error) {
        console.error('Erro ao carregar sessão:', error)
        if (!mounted) return
        setAuth({ user: null, loading: false })
      }
    }

    loadSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      setAuth({ user: mapSupabaseUser(session?.user ?? null), loading: false })
    })

    return () => {
      mounted = false
      subscription?.unsubscribe()
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    if (!email || !password) {
      throw new Error('Email e senha são obrigatórios')
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim()
      })

      if (error) {
        throw new Error(error.message)
      }

      const user = mapSupabaseUser(data.user)
      setAuth({ user, loading: false })
      return user
    } catch (error) {
      console.error('Erro ao fazer login:', error)
      setAuth({ user: null, loading: false })
      throw error
    }
  }, [])

  const register = useCallback(async (
    email: string, 
    password: string, 
    name?: string,
    company?: string
  ): Promise<{ user: AuthUser | null; needsConfirmation: boolean }> => {
    if (!email || !password) {
      throw new Error('Email e senha são obrigatórios')
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          data: {
            name: name || email.split('@')[0],
            company: company || ''
          }
        }
      })

      if (error) {
        throw new Error(error.message)
      }

      // Se a confirmação de email estiver habilitada, a sessão vem nula
      const needsConfirmation = !data.session
      const user = mapSupabaseUser(data.user)

      // Atualizar estado local se já houver sessão (sem confirmação necessária)
      setAuth({ user: user ?? null, loading: false })

      return { user: user ?? null, needsConfirmation }
    } catch (error) {
      console.error('Erro ao registrar:', error)
      setAuth({ user: null, loading: false })
      throw error
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        throw new Error(error.message)
      }
      setAuth({ user: null, loading: false })
    } catch (error) {
      console.error('Erro ao fazer logout:', error)
      setAuth({ user: null, loading: false })
      throw error
    }
  }, [])

  const resetPassword = useCallback(async (email: string) => {
    if (!email) {
      throw new Error('Email é obrigatório')
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`
      })

      if (error) {
        throw new Error(error.message)
      }
    } catch (error) {
      console.error('Erro ao solicitar reset de senha:', error)
      throw error
    }
  }, [])

  const updateProfile = useCallback(async (updates: Partial<AuthUser>) => {
    if (!auth.user) {
      throw new Error('Usuário não autenticado')
    }

    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          name: updates.name,
          company: updates.company
        }
      })

      if (error) {
        throw new Error(error.message)
      }

      // Atualizar estado local
      setAuth(prev => ({
        ...prev,
        user: prev.user ? { ...prev.user, ...updates } : null
      }))
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error)
      throw error
    }
  }, [auth.user])

  const isAuthenticated = !!auth.user && !auth.loading

  return {
    user: auth.user,
    loading: auth.loading,
    isAuthenticated,
    login,
    register,
    logout,
    resetPassword,
    updateProfile
  }
}

// Função utilitária para obter usuário atual (para uso fora de componentes)
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return null
    
    const email = session.user.email ?? ''
    const nameFromEmail = email.split('@')[0] || 'User'
    
    return {
      id: session.user.id,
      name: session.user.user_metadata?.name || 
            nameFromEmail.charAt(0).toUpperCase() + nameFromEmail.slice(1),
      email,
      company: session.user.user_metadata?.company || '',
      role: 'user',
      plan: 'Free',
      created_at: session.user.created_at
    }
  } catch (error) {
    console.error('Erro ao obter usuário atual:', error)
    return null
  }
}
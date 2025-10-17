import { useCallback, useEffect, useState } from 'react'
import supabase from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

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

  // Função para converter User do Supabase para AuthUser
  const mapSupabaseUser = (supabaseUser: User): AuthUser => {
    const email = supabaseUser.email ?? ''
    const nameFromEmail = email.split('@')[0] || 'User'
    
    return {
      id: supabaseUser.id,
      name: supabaseUser.user_metadata?.name || 
            nameFromEmail.charAt(0).toUpperCase() + nameFromEmail.slice(1),
      email,
      company: supabaseUser.user_metadata?.company || '',
      role: 'user', // Por padrão, novos usuários são 'user'
      plan: 'Free', // Por padrão, plano gratuito
      created_at: supabaseUser.created_at
    }
  }

  // Carregar sessão inicial e configurar listener
  useEffect(() => {
    let mounted = true

    // Função para carregar sessão atual
    const loadSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Erro ao carregar sessão:', error)
          if (mounted) setAuth({ user: null, loading: false })
          return
        }

        if (session?.user && mounted) {
          const authUser = mapSupabaseUser(session.user)
          setAuth({ user: authUser, loading: false })
        } else if (mounted) {
          setAuth({ user: null, loading: false })
        }
      } catch (error) {
        console.error('Erro inesperado ao carregar sessão:', error)
        if (mounted) setAuth({ user: null, loading: false })
      }
    }

    // Carregar sessão inicial
    loadSession()

    // Configurar listener para mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        if (event === 'SIGNED_IN' && session?.user) {
          const authUser = mapSupabaseUser(session.user)
          setAuth({ user: authUser, loading: false })
        } else if (event === 'SIGNED_OUT') {
          setAuth({ user: null, loading: false })
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          const authUser = mapSupabaseUser(session.user)
          setAuth({ user: authUser, loading: false })
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    if (!email || !password) {
      throw new Error('Email e senha são obrigatórios')
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      })

      if (error) {
        // Traduzir erros comuns do Supabase
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Email ou senha incorretos')
        }
        if (error.message.includes('Email not confirmed')) {
          throw new Error('Email não confirmado. Verifique sua caixa de entrada.')
        }
        throw new Error(error.message)
      }

      if (!data.session?.user) {
        throw new Error('Erro interno: sessão não criada')
      }

      const authUser = mapSupabaseUser(data.session.user)
      return { user: authUser, session: data.session }
    } catch (error) {
      console.error('Erro no login:', error)
      throw error
    }
  }, [])

  const register = useCallback(async (
    email: string, 
    password: string, 
    name: string, 
    company?: string
  ) => {
    if (!email || !password || !name) {
      throw new Error('Email, senha e nome são obrigatórios')
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            name: name.trim(),
            company: company?.trim() || ''
          }
        }
      })

      if (error) {
        // Traduzir erros comuns do Supabase
        if (error.message.includes('User already registered')) {
          throw new Error('Este email já está cadastrado')
        }
        if (error.message.includes('Password should be at least')) {
          throw new Error('A senha deve ter pelo menos 6 caracteres')
        }
        throw new Error(error.message)
      }

      return {
        user: data.user ? mapSupabaseUser(data.user) : null,
        session: data.session,
        needsConfirmation: !data.session // Se não há sessão, precisa confirmar email
      }
    } catch (error) {
      console.error('Erro no registro:', error)
      throw error
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Erro no logout:', error)
        throw new Error('Erro ao fazer logout')
      }
    } catch (error) {
      console.error('Erro no logout:', error)
      // Mesmo com erro, limpar estado local
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
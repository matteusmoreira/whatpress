import { useCallback, useEffect, useState } from 'react'
import supabase from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import { isTestEnv } from '@/lib/env'
import { useRateLimit } from '@/hooks/useRateLimit'
import { useCache } from '@/hooks/useCache'
import { monitorFunction } from '@/lib/monitoring'

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
  const { checkAuthenticationRateLimit } = useRateLimit()

  // Cache para dados do usuário
  const { data: cachedUserProfile, mutate: mutateUserProfile } = useCache(
    auth.user ? `user:profile:${auth.user.id}` : '',
    async () => {
      if (!auth.user) return null
      
      return monitorFunction(
        async () => {
          const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', auth.user!.id)
            .maybeSingle()

          if (error) {
            const msg = String(error.message || '')
            if (msg.includes('Could not find the table') || msg.includes('schema cache')) {
              return null
            }
            return null
          }
          return data || null
        },
        {
          functionName: 'getUserProfile',
          category: 'auth',
        }
      )
    },
    {
      ttl: 1800, // 30 minutos
      enabled: !!auth.user,
    }
  )

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

    return monitorFunction(
      async () => {
        try {
          // Verificar rate limit para autenticação
          const { allowed, info } = await checkAuthenticationRateLimit(email)
          if (!allowed) {
            throw new Error(`Muitas tentativas de login. Tente novamente em ${Math.ceil((info.resetTime.getTime() - Date.now()) / 1000)} segundos.`)
          }

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
      },
      {
        functionName: 'login',
        category: 'auth',
        metadata: { email }
      }
    )
  }, [checkAuthenticationRateLimit])

  const register = useCallback(async (
    email: string, 
    password: string, 
    name?: string,
    company?: string
  ): Promise<{ user: AuthUser | null; needsConfirmation: boolean }> => {
    if (!email || !password) {
      throw new Error('Email e senha são obrigatórios')
    }

    return monitorFunction(
      async () => {
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
      },
      {
        functionName: 'register',
        category: 'auth',
        metadata: { email, name, company }
      }
    )
  }, [])

  const logout = useCallback(async () => {
    return monitorFunction(
      async () => {
        try {
          const userId = auth.user?.id
          const { error } = await supabase.auth.signOut()
          if (error) {
            throw new Error(error.message)
          }
          
          
          
          setAuth({ user: null, loading: false })
          return true
        } catch (error) {
          console.error('Erro ao fazer logout:', error)
          setAuth({ user: null, loading: false })
          throw error
        }
      },
      {
        functionName: 'logout',
        category: 'auth',
        metadata: { userId: auth.user?.id }
      }
    )
  }, [auth.user])

  const resetPassword = useCallback(async (email: string) => {
    if (!email) {
      throw new Error('Email é obrigatório')
    }

    return monitorFunction(
      async () => {
        try {
          // Verificar rate limit para reset de senha
          const { allowed, info } = await checkAuthenticationRateLimit(email)
          if (!allowed) {
            throw new Error(`Muitas solicitações de reset. Tente novamente em ${Math.ceil((info.resetTime.getTime() - Date.now()) / 1000)} segundos.`)
          }

          const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: `${window.location.origin}/auth/reset-password`
          })

          if (error) {
            throw new Error(error.message)
          }

          

          return true
        } catch (error) {
          console.error('Erro ao solicitar redefinição de senha:', error)
          throw error
        }
      },
      {
        functionName: 'resetPassword',
        category: 'auth',
        metadata: { email }
      }
    )
  }, [checkAuthenticationRateLimit])

  const updateProfile = useCallback(async (updates: Partial<AuthUser>) => {
    if (!auth.user?.id) {
      throw new Error('Usuário não autenticado')
    }

    return monitorFunction(
      async () => {
        try {
          // Atualizar perfil no Supabase Auth
          const { error: authError } = await supabase.auth.updateUser({
            data: {
              name: updates.name,
              company: updates.company
            }
          })

          if (authError) {
            throw new Error(authError.message)
          }

          // Atualizar perfil na tabela user_profiles
          const { error: profileError } = await supabase
            .from('user_profiles')
            .update({
              name: updates.name,
              company: updates.company,
              updated_at: new Date().toISOString()
            })
            .eq('id', auth.user.id)

          if (profileError) {
            throw new Error(profileError.message)
          }

          // Atualizar estado local
          const updatedUser = { ...auth.user, ...updates }
          setAuth({ user: updatedUser, loading: false })

          // Invalidar cache do perfil
          await mutateUserProfile()

          return updatedUser
        } catch (error) {
          console.error('Erro ao atualizar perfil:', error)
          throw error
        }
      },
      {
        functionName: 'updateProfile',
        category: 'auth',
        metadata: { userId: auth.user.id, updates }
      }
    )
  }, [auth.user, mutateUserProfile])

  const getCurrentUser = useCallback(async (): Promise<AuthUser | null> => {
    if (auth.user) {
      return auth.user
    }

    return monitorFunction(
      async () => {
        try {
          const { data: { user }, error } = await supabase.auth.getUser()
          
          if (error) {
            console.error('Erro ao obter usuário atual:', error)
            return null
          }

          if (!user) {
            return null
          }

          const mappedUser = mapSupabaseUser(user)
          setAuth({ user: mappedUser, loading: false })
          
          return mappedUser
        } catch (error) {
          console.error('Erro ao obter usuário atual:', error)
          return null
        }
      },
      {
        functionName: 'getCurrentUser',
        category: 'auth',
        metadata: { hasCachedUser: !!auth.user }
      }
    )
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
    updateProfile,
    getCurrentUser,
    userProfileCache: cachedUserProfile,
    isLoadingProfile: !cachedUserProfile && !!auth.user
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

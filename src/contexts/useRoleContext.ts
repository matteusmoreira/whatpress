import { useContext } from 'react'
import { RoleContext } from './RoleContext'

export function useRoleContext() {
  const context = useContext(RoleContext)
  if (context === undefined) {
    throw new Error('useRoleContext deve ser usado dentro de um RoleProvider')
  }
  return context
}

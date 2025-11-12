import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ShieldX } from 'lucide-react'
import { useRoleContext } from '@/contexts/useRoleContext'

const UnauthorizedPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentRole } = useRoleContext()

  const from = (location.state as any)?.from as string | undefined
  const required = (location.state as any)?.required as {
    allowedRoles?: ('SUPERADMIN' | 'ADMIN' | 'USER')[]
    resource?: string
    action?: string
  } | undefined

  const goBack = () => {
    if (from) {
      navigate(from)
    } else {
      navigate('/dashboard')
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-4">
        <Alert variant="destructive">
          <ShieldX className="h-4 w-4" />
          <AlertDescription>
            Você não tem permissão para acessar esta página.
          </AlertDescription>
        </Alert>

        <div className="rounded-md border p-3 text-sm space-y-2">
          <div>
            <span className="font-semibold">Sua role atual:</span> {currentRole ?? 'N/A'}
          </div>
          {required?.resource && required?.action ? (
            <div>
              <span className="font-semibold">Permissão requerida:</span> {required.resource} / {required.action}
            </div>
          ) : required?.allowedRoles && required.allowedRoles.length > 0 ? (
            <div>
              <span className="font-semibold">Roles permitidas:</span> {required.allowedRoles.join(', ')}
            </div>
          ) : null}
          {from ? (
            <div>
              <span className="font-semibold">Rota de origem:</span> {from}
            </div>
          ) : null}
        </div>

        <div className="flex gap-2">
          <Button variant="default" onClick={goBack}>
            Voltar
          </Button>
          <Button variant="secondary" onClick={() => navigate('/dashboard')}>
            Ir para Dashboard
          </Button>
          <Button variant="ghost" onClick={() => navigate('/')}>Ir para Home</Button>
        </div>
      </div>
    </div>
  )
}

export default UnauthorizedPage

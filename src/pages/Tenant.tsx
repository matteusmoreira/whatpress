import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Building2, RefreshCw, UserPlus, Shield } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/hooks/useTenant'
import { toast } from 'sonner'

type Tenant = {
  id: string
  name: string
  domain?: string
  plan: 'starter' | 'pro' | 'enterprise'
  status: 'active' | 'suspended'
}

type TenantQuota = {
  tenant_id: string
  max_users: number
  max_contacts: number
  max_connections: number
  max_message_templates: number
  max_automations: number
  max_messages_per_month: number
  current_users?: number
  current_contacts?: number
  current_connections?: number
  current_message_templates?: number
  current_automations?: number
  used_messages_current_month?: number
}

export default function TenantPage() {
  const { id } = useParams()
  const tenantId = id || ''
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { switchTenant } = useTenant()
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [quota, setQuota] = useState<TenantQuota | null>(null)
  const [loading, setLoading] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDomain, setEditDomain] = useState('')
  const [editPlan, setEditPlan] = useState<'starter' | 'pro' | 'enterprise'>('starter')
  const [tenantUsers, setTenantUsers] = useState<Array<{ id: string; email: string; full_name: string | null; role: 'SUPERADMIN' | 'ADMIN' | 'USER' }>>([])
  const [selectedAdminId, setSelectedAdminId] = useState<string>('')
  const [adminSaving, setAdminSaving] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')

  const loadData = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const { data: t, error: te } = await supabase
        .from('tenants')
        .select('id, name, domain, plan, status')
        .eq('id', id)
        .single()
      if (te) throw te
      setTenant(t as Tenant)

      const { data: q, error: qe } = await supabase
        .from('tenant_quotas')
        .select('*')
        .eq('tenant_id', id)
        .single()
      if (!qe && q) setQuota(q as TenantQuota)
      // Carregar usuários do tenant pelo backend /api/roles
      try {
        const tokenRes = await supabase.auth.getSession()
        const token = tokenRes.data.session?.access_token || ''
        if (token) {
          const res = await fetch('/api/roles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ action: 'list_users', tenantId })
          })
          const result = await res.json()
          if (res.ok) {
            const list = (result?.users || []).map((u: any) => ({ id: u.user_id, email: u.email || '', full_name: u.full_name || null, role: u.role }))
            setTenantUsers(list)
            const currentAdmin = list.find((u: any) => u.role === 'ADMIN')
            setSelectedAdminId(currentAdmin?.id || '')
          }
        }
      } catch (err) {
        console.warn('Falha ao carregar usuários do tenant', err)
      }
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao carregar tenant')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    verifyAccess()
    loadData()
  }, [loadData, verifyAccess])

  useEffect(() => {
    if (searchParams.get('tab') === 'settings' && tenant) {
      setEditName(tenant.name)
      setEditDomain(tenant.domain || '')
      setEditPlan(tenant.plan)
      setEditOpen(true)
    }
  }, [searchParams, tenant])

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      active: 'bg-green-100 text-green-800 border-green-200',
      suspended: 'bg-red-100 text-red-800 border-red-200'
    }
    return variants[status] || variants.active
  }

  const getPlanBadge = (plan: string) => {
    const normalized = (plan || '').toLowerCase()
    const variants: Record<string, string> = {
      enterprise: 'bg-purple-100 text-purple-800 border-purple-200',
      pro: 'bg-blue-100 text-blue-800 border-blue-200',
      starter: 'bg-gray-100 text-gray-800 border-gray-200'
    }
    return variants[normalized] || variants.starter
  }

  const handleSuspendToggle = async () => {
    if (!tenant) return
    const next = tenant.status === 'active' ? 'suspended' : 'active'
    const { error } = await supabase
      .from('tenants')
      .update({ status: next })
      .eq('id', tenant.id)
    if (error) {
      toast.error(error.message)
      return
    }
    setTenant({ ...tenant, status: next })
    toast.success(next === 'suspended' ? 'Tenant suspenso' : 'Tenant reativado')
  }

  const handleEditSave = async () => {
    if (!tenant) return
    const { error } = await supabase
      .from('tenants')
      .update({ name: editName, domain: editDomain || null, plan: editPlan })
      .eq('id', tenant.id)
    if (error) {
      toast.error(error.message)
      return
    }
    setTenant({ ...tenant, name: editName, domain: editDomain || undefined, plan: editPlan })
    setEditOpen(false)
    toast.success('Tenant atualizado')
  }

  const saveAdminSelection = async () => {
    if (!tenantId) return
    setAdminSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      if (!token) throw new Error('Sessão não encontrada')

      // Se não há admin selecionado, apenas retorna
      if (!selectedAdminId) {
        setAdminSaving(false)
        return
      }

      // Promover selecionado para ADMIN
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action: 'update_role', tenantId: tenantId, userId: selectedAdminId, newRole: 'ADMIN' })
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result?.error || 'Falha ao definir administrador')

      // Opcional: rebaixar demais admins para USER
      const otherAdmins = tenantUsers.filter(u => u.role === 'ADMIN' && u.id !== selectedAdminId)
      for (const u of otherAdmins) {
        try {
          await fetch('/api/roles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ action: 'update_role', tenantId: tenantId, userId: u.id, newRole: 'USER' })
          })
        } catch (err) {
          console.warn('Falha ao atualizar role de outros admins', err)
        }
      }

      toast.success('Administrador atualizado')
      await loadData()
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar administrador')
    } finally {
      setAdminSaving(false)
    }
  }

  const inviteAdminByEmail = async () => {
    if (!tenantId || !inviteEmail) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      if (!token) throw new Error('Sessão não encontrada')

      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action: 'invite', tenantId: tenantId, email: inviteEmail, role: 'ADMIN' })
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result?.error || 'Falha ao adicionar administrador')
      toast.success('Administrador adicionado')
      setInviteEmail('')
      await loadData()
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao adicionar administrador')
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Tenant</h1>
                <p className="text-sm text-muted-foreground">Detalhes e configurações</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={loadData} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              {tenant && (
                <Button onClick={() => switchTenant(tenant.id).then(() => navigate('/dashboard'))}>
                  Selecionar contexto
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Informações do Tenant</CardTitle>
            <CardDescription>Dados básicos e status</CardDescription>
          </CardHeader>
          <CardContent>
            {tenant ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{tenant.name}</h3>
                      <Badge className={getPlanBadge(tenant.plan)}>
                        {tenant.plan.charAt(0).toUpperCase() + tenant.plan.slice(1)}
                      </Badge>
                      <Badge className={getStatusBadge(tenant.status)}>{tenant.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{tenant.domain || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => { setEditName(tenant.name); setEditDomain(tenant.domain || ''); setEditPlan(tenant.plan); setEditOpen(true) }}>Editar</Button>
                  <Button variant={tenant.status === 'active' ? 'destructive' : 'default'} onClick={handleSuspendToggle}>
                    {tenant.status === 'active' ? 'Suspender' : 'Reativar'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Carregando...</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quotas</CardTitle>
            <CardDescription>Limites e uso</CardDescription>
          </CardHeader>
          <CardContent>
            {quota ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">Usuários</p>
                  <p className="font-medium">{quota.current_users ?? 0} / {quota.max_users}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Contatos</p>
                  <p className="font-medium">{quota.current_contacts ?? 0} / {quota.max_contacts}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Conexões</p>
                  <p className="font-medium">{quota.current_connections ?? 0} / {quota.max_connections}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Templates</p>
                  <p className="font-medium">{quota.current_message_templates ?? 0} / {quota.max_message_templates}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Automações</p>
                  <p className="font-medium">{quota.current_automations ?? 0} / {quota.max_automations}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Mensagens/mês</p>
                  <p className="font-medium">{quota.used_messages_current_month ?? 0} / {quota.max_messages_per_month}</p>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Sem dados de quotas</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Administrador da Empresa</CardTitle>
            <CardDescription>Selecione o administrador principal desta empresa</CardDescription>
          </CardHeader>
          <CardContent>
            {tenantUsers.length > 0 ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Selecionar administrador</p>
                  <Select value={selectedAdminId} onValueChange={(v) => setSelectedAdminId(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o administrador" />
                    </SelectTrigger>
                    <SelectContent>
                      {tenantUsers.map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.full_name || u.email} ({u.email})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button onClick={saveAdminSelection} disabled={!selectedAdminId || adminSaving}>
                    <Shield className="h-4 w-4 mr-2" />
                    Salvar Administrador
                  </Button>
                </div>
                <div className="border-t pt-4 space-y-2">
                  <p className="text-sm text-muted-foreground">Adicionar por email</p>
                  <div className="flex items-center gap-2">
                    <Input placeholder="usuario@exemplo.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                    <Button variant="secondary" onClick={inviteAdminByEmail} disabled={!inviteEmail}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Adicionar como Admin
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Nenhum usuário associado a esta empresa</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Tenant</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Nome</p>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Domínio</p>
              <Input value={editDomain} onChange={(e) => setEditDomain(e.target.value)} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Plano</p>
              <Select value={editPlan} onValueChange={(v) => setEditPlan(v as 'starter' | 'pro' | 'enterprise')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecionar plano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
              <Button onClick={handleEditSave}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

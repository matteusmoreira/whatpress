import React, { useState, useEffect } from 'react';

import { useTenant } from '@/hooks/useTenant';
import { AdminOnly, SuperAdminOnly } from '@/components/RoleGuard'
import { PermissionGuard } from '@/components/PermissionGuard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { 
  Users, 
  Shield, 
  Settings, 
  UserPlus, 
  Edit, 
  Trash2, 
  Eye,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Resources, Actions } from '@/constants/permissions';
import { useRoleContext } from '@/contexts/RoleContext';

interface TenantUser {
  id: string;
  email: string;
  full_name: string | null;
  role: 'SUPERADMIN' | 'ADMIN' | 'USER';
  created_at: string;
  last_sign_in_at: string | null;
}

interface Permission {
  id: string;
  role: string;
  resource: string;
  action: string;
  allowed: boolean;
}

interface UserAction {
  id: string;
  user_id: string;
  user_email: string;
  action: string;
  resource: string;
  resource_id: string | null;
  details: any;
  created_at: string;
}

export const RoleManagement: React.FC = () => {
  const { currentTenant } = useTenant();
  const { logAction } = useRoleContext();
  
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [userActions, setUserActions] = useState<UserAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<TenantUser | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'USER'>('USER');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRole, setCreateRole] = useState<'ADMIN' | 'USER'>('USER');
  const [createName, setCreateName] = useState('');

  // Filtros da aba Auditoria
  const [auditLimit, setAuditLimit] = useState<number>(50);
  const [auditSinceMinutes, setAuditSinceMinutes] = useState<number>(0);
  const [auditActionFilter, setAuditActionFilter] = useState<string>('');
  const [auditResourceFilter, setAuditResourceFilter] = useState<string>('');

  // Base para chamadas da API de roles (permite usar backend local em dev)
  const API_BASE = (import.meta as any).env?.VITE_ROLES_BASE || '';

  // Helper: obter token de acesso atual para chamadas ao backend
  const getAccessToken = async (): Promise<string | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      return session?.access_token ?? null
    } catch {
      return null
    }
  }
  
  // Carregar dados
  useEffect(() => {
    if (currentTenant?.id) {
      loadData();
    }
  }, [currentTenant?.id]);

  const loadData = async () => {
    if (!currentTenant?.id) return;

    setLoading(true);
    try {
      await Promise.all([
        loadUsers(),
        loadPermissions(),
        loadUserActions()
      ]);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados do sistema');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    if (!currentTenant?.id) return;

    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Sessão não encontrada');

      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'list_users',
          tenantId: currentTenant.id
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || 'Falha ao carregar usuários');

      const formattedUsers: TenantUser[] = (result?.users ?? []).map((row: any) => ({
        id: row.user_id,
        email: row.email ?? '',
        full_name: row.full_name ?? null,
        role: row.role,
        created_at: row.created_at,
        last_sign_in_at: row.last_sign_in_at ?? null
      }));

      setUsers(formattedUsers);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    }
  };

  const loadPermissions = async () => {
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Sessão não encontrada');

      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'list_permissions'
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || 'Falha ao carregar permissões');

      setPermissions(result?.permissions ?? []);
    } catch (error) {
      console.error('Erro ao carregar permissões:', error);
    }
  };

  const loadUserActions = async () => {
    if (!currentTenant?.id) return;

    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Sessão não encontrada');

      // Montar payload com filtros
      const since = auditSinceMinutes > 0
        ? new Date(Date.now() - auditSinceMinutes * 60 * 1000).toISOString()
        : undefined;
      const payload: any = {
        action: 'list_user_actions',
        tenantId: currentTenant.id,
        limit: Math.max(1, Math.min(200, Number(auditLimit) || 50)),
      };
      if (auditActionFilter) payload.actionFilter = auditActionFilter;
      if (auditResourceFilter) payload.resource = auditResourceFilter;
      if (since) payload.since = since;

      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || 'Falha ao carregar ações');

      const actions: UserAction[] = (result?.actions ?? []).map((item: any) => ({
        id: item.id,
        user_id: item.user_id,
        user_email: item.user_email ?? '',
        action: item.action,
        resource: item.resource,
        resource_id: item.resource_id,
        details: item.details,
        created_at: item.created_at,
      }));

      setUserActions(actions);
    } catch (error) {
      console.error('Erro ao carregar ações:', error);
    }
  };

  const handleChangeUserRole = async (userId: string, newRole: 'ADMIN' | 'USER') => {
    if (!currentTenant?.id) return;

    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Sessão não encontrada');

      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'update_role',
          tenantId: currentTenant.id,
          userId,
          newRole
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || 'Falha ao atualizar role');

      // Logging realizado no backend (/api/roles: update_role)

      toast.success('Role do usuário atualizada com sucesso');
      // Auditoria cliente
      logAction(Actions.UPDATE_ROLE, Resources.USERS, { userId, newRole, result: 'success' }).catch(() => {})
      loadUsers();
    } catch (error) {
      console.error('Erro ao alterar role:', error);
      toast.error('Erro ao alterar role do usuário');
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!currentTenant?.id) return;

    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Sessão não encontrada');

      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'remove',
          tenantId: currentTenant.id,
          userId
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || 'Falha ao remover usuário');

      // Logging realizado no backend (/api/roles: remove)

      toast.success('Usuário removido com sucesso');
      // Auditoria cliente
      logAction(Actions.REMOVE, Resources.USERS, { userId, result: 'success' }).catch(() => {})
      loadUsers();
    } catch (error) {
      console.error('Erro ao remover usuário:', error);
      toast.error('Erro ao remover usuário');
    }
  };

  const handleInviteUser = async () => {
    if (!currentTenant?.id || !inviteEmail) return;

    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Sessão não encontrada');

      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'invite',
          tenantId: currentTenant.id,
          email: inviteEmail,
          role: inviteRole
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || 'Falha ao convidar usuário');

      // Logging realizado no backend (/api/roles: invite)

      toast.success('Usuário adicionado com sucesso');
      // Auditoria cliente
      logAction(Actions.INVITE, Resources.USERS, { email: inviteEmail, role: inviteRole, result: 'success' }).catch(() => {})
      setIsInviteDialogOpen(false);
      setInviteEmail('');
      setInviteRole('USER');
      loadUsers();
    } catch (error) {
      console.error('Erro ao convidar usuário:', error);
      toast.error('Erro ao convidar usuário');
    }
  };

  const handleCreateUser = async () => {
    if (!currentTenant?.id || !createEmail || !createPassword) return;
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Sessão não encontrada');

      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'create_user',
          tenantId: currentTenant.id,
          email: createEmail,
          password: createPassword,
          role: createRole,
          name: createName || undefined
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || 'Falha ao criar usuário');

      toast.success('Usuário criado com sucesso');
      logAction(Actions.INVITE, Resources.USERS, { email: createEmail, role: createRole, result: 'success' }).catch(() => {})
      setIsCreateDialogOpen(false);
      setCreateEmail('');
      setCreatePassword('');
      setCreateRole('USER');
      setCreateName('');
      loadUsers();
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      toast.error('Erro ao criar usuário');
    }
  };

  const handleUpdatePermission = async (permissionId: string, allowed: boolean) => {
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Sessão não encontrada');

      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'update_permission',
          permissionId,
          allowed
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || 'Falha ao atualizar permissão');

      // Logging realizado no backend (/api/roles: update_permission)

      toast.success('Permissão atualizada com sucesso');
      // Auditoria cliente
      logAction(Actions.MANAGE_ROLE_PERMISSIONS, Resources.ROLES, { permissionId, allowed, result: 'success' }).catch(() => {})
      loadPermissions();
    } catch (error) {
      console.error('Erro ao atualizar permissão:', error);
      toast.error('Erro ao atualizar permissão');
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'SUPERADMIN': return 'destructive';
      case 'ADMIN': return 'default';
      case 'USER': return 'secondary';
      default: return 'outline';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <AdminOnly>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gerenciamento de Roles</h1>
            <p className="text-muted-foreground">
              Gerencie usuários, permissões e controle de acesso
            </p>
          </div>
          
          <PermissionGuard allowedRoles={['ADMIN', 'SUPERADMIN']} resource={Resources.USERS} action={Actions.INVITE} mode="hide">
            <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Convidar Usuário
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Convidar Usuário</DialogTitle>
                  <DialogDescription>
                    Adicione um novo usuário ao tenant atual
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="usuario@exemplo.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="role">Role</Label>
                    <Select value={inviteRole} onValueChange={(value: 'ADMIN' | 'USER') => setInviteRole(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USER">Usuário</SelectItem>
                        <SelectItem value="ADMIN">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsInviteDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleInviteUser} disabled={!inviteEmail}>
                    Convidar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </PermissionGuard>
          <PermissionGuard allowedRoles={['ADMIN', 'SUPERADMIN']} resource={Resources.USERS} action={Actions.INVITE} mode="hide">
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Criar Usuário
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Usuário</DialogTitle>
                  <DialogDescription>
                    Crie um usuário com senha sem convite por email
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="create-name">Nome</Label>
                    <Input id="create-name" value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Nome completo (opcional)" />
                  </div>
                  <div>
                    <Label htmlFor="create-email">Email</Label>
                    <Input id="create-email" type="email" value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} placeholder="usuario@exemplo.com" />
                  </div>
                  <div>
                    <Label htmlFor="create-password">Senha</Label>
                    <Input id="create-password" type="password" value={createPassword} onChange={(e) => setCreatePassword(e.target.value)} placeholder="Senha forte" />
                  </div>
                  <div>
                    <Label htmlFor="create-role">Role</Label>
                    <Select value={createRole} onValueChange={(value: 'ADMIN' | 'USER') => setCreateRole(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USER">Usuário</SelectItem>
                        <SelectItem value="ADMIN">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={handleCreateUser} disabled={!createEmail || !createPassword}>Criar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </PermissionGuard>
        </div>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users">
              <Users className="h-4 w-4 mr-2" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="permissions">
              <Shield className="h-4 w-4 mr-2" />
              Permissões
            </TabsTrigger>
            <TabsTrigger value="audit">
              <Eye className="h-4 w-4 mr-2" />
              Auditoria
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>Usuários do Tenant</CardTitle>
                <CardDescription>
                  Gerencie os usuários e suas roles neste tenant
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Último Acesso</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{user.full_name || user.email}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getRoleBadgeVariant(user.role)}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.last_sign_in_at ? formatDate(user.last_sign_in_at) : 'Nunca'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {user.role !== 'SUPERADMIN' && (
                              <>
                                <PermissionGuard allowedRoles={['ADMIN', 'SUPERADMIN']} resource={Resources.USERS} action={Actions.UPDATE_ROLE} mode="hide">
                                  <Select
                                    value={user.role}
                                    onValueChange={(value: 'ADMIN' | 'USER') => 
                                      handleChangeUserRole(user.id, value)
                                    }
                                  >
                                    <SelectTrigger className="w-32">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="USER">USER</SelectItem>
                                      <SelectItem value="ADMIN">ADMIN</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </PermissionGuard>
                                <PermissionGuard allowedRoles={['ADMIN', 'SUPERADMIN']} resource={Resources.USERS} action={Actions.REMOVE} mode="hide">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleRemoveUser(user.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </PermissionGuard>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="permissions">
            <SuperAdminOnly>
              <Card>
                <CardHeader>
                  <CardTitle>Permissões por Role</CardTitle>
                  <CardDescription>
                    Configure as permissões granulares para cada role
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {['SUPERADMIN', 'ADMIN', 'USER'].map((role) => (
                      <div key={role} className="space-y-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          <Badge variant={getRoleBadgeVariant(role)}>{role}</Badge>
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

                          {Object.entries(
                            permissions
                              .filter(p => p.role === role)
                              .reduce((acc, permission) => {
                                const key = permission.resource;
                                if (!acc[key]) acc[key] = [];
                                acc[key].push(permission);
                                return acc;
                              }, {} as Record<string, Permission[]>)
                          ).map(([resource, resourcePermissions]) => (
                            <Card key={resource} className="p-4">
                              <h4 className="font-medium mb-3 capitalize">{resource}</h4>
                              <div className="space-y-2">
                                {resourcePermissions.map((permission) => (
                                  <div key={permission.id} className="flex items-center justify-between">
                                    <span className="text-sm capitalize">{permission.action}</span>
                                    <Switch
                                      checked={permission.allowed}
                                      onCheckedChange={(checked) => 
                                        handleUpdatePermission(permission.id, checked)
                                      }
                                      disabled={role === 'SUPERADMIN'}
                                    />
                                  </div>
                                ))}
                              </div>
                            </Card>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </SuperAdminOnly>
          </TabsContent>

          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <CardTitle>Log de Auditoria</CardTitle>
                <CardDescription>
                  Histórico de ações realizadas pelos usuários
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div>
                    <Label htmlFor="audit-limit">Limite</Label>
                    <Input
                      id="audit-limit"
                      type="number"
                      min={1}
                      max={200}
                      value={auditLimit}
                      onChange={(e) => setAuditLimit(Math.max(1, Math.min(200, parseInt(e.target.value || '0') || 0)))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="audit-since">Desde (minutos)</Label>
                    <Input
                      id="audit-since"
                      type="number"
                      min={0}
                      value={auditSinceMinutes}
                      onChange={(e) => setAuditSinceMinutes(Math.max(0, parseInt(e.target.value || '0') || 0))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="audit-action">Ação</Label>
                    <Input
                      id="audit-action"
                      placeholder="ex: invite_user"
                      value={auditActionFilter}
                      onChange={(e) => setAuditActionFilter(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="audit-resource">Recurso</Label>
                    <Input
                      id="audit-resource"
                      placeholder="ex: users"
                      value={auditResourceFilter}
                      onChange={(e) => setAuditResourceFilter(e.target.value)}
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <Button onClick={loadUserActions}>Aplicar filtros</Button>
                    <Button
                      variant="outline"
                      onClick={() => { setAuditLimit(50); setAuditSinceMinutes(0); setAuditActionFilter(''); setAuditResourceFilter(''); loadUserActions(); }}
                    >
                      Limpar
                    </Button>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Recurso</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userActions.map((action) => (
                      <TableRow key={action.id}>
                        <TableCell>{action.user_email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{action.action}</Badge>
                        </TableCell>
                        <TableCell>{action.resource}</TableCell>
                        <TableCell>{formatDate(action.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminOnly>
  );
};

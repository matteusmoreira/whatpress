import React, { useState, useEffect } from 'react';
import { useRoles } from '@/hooks/useRoles';
import { useTenant } from '@/hooks/useTenant';
import { RoleGuard, AdminOnly } from '@/components/RoleGuard';
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

interface TenantUser {
  id: string;
  email: string;
  full_name: string | null;
  user_role: 'SUPERADMIN' | 'ADMIN' | 'USER';
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
  const { isSuperAdmin, isAdmin, logAction } = useRoles();
  
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [userActions, setUserActions] = useState<UserAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<TenantUser | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'USER'>('USER');

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
      const { data, error } = await supabase
        .from('tenant_users')
        .select(`
          user_id,
          user_role,
          created_at,
          profiles!inner(
            id,
            email,
            full_name,
            last_sign_in_at
          )
        `)
        .eq('tenant_id', currentTenant.id);

      if (error) throw error;

      const formattedUsers: TenantUser[] = data?.map(item => ({
        id: item.user_id,
        email: item.profiles.email,
        full_name: item.profiles.full_name,
        user_role: item.user_role,
        created_at: item.created_at,
        last_sign_in_at: item.profiles.last_sign_in_at
      })) || [];

      setUsers(formattedUsers);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    }
  };

  const loadPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('*')
        .order('role', { ascending: true })
        .order('resource', { ascending: true })
        .order('action', { ascending: true });

      if (error) throw error;
      setPermissions(data || []);
    } catch (error) {
      console.error('Erro ao carregar permissões:', error);
    }
  };

  const loadUserActions = async () => {
    if (!currentTenant?.id) return;

    try {
      const { data, error } = await supabase
        .from('user_actions_log')
        .select(`
          *,
          profiles!inner(email)
        `)
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const formattedActions: UserAction[] = data?.map(item => ({
        id: item.id,
        user_id: item.user_id,
        user_email: item.profiles.email,
        action: item.action,
        resource: item.resource,
        resource_id: item.resource_id,
        details: item.details,
        created_at: item.created_at
      })) || [];

      setUserActions(formattedActions);
    } catch (error) {
      console.error('Erro ao carregar ações:', error);
    }
  };

  const handleChangeUserRole = async (userId: string, newRole: 'ADMIN' | 'USER') => {
    if (!currentTenant?.id) return;

    try {
      const { error } = await supabase
        .from('tenant_users')
        .update({ user_role: newRole })
        .eq('tenant_id', currentTenant.id)
        .eq('user_id', userId);

      if (error) throw error;

      await logAction('update_user_role', 'users', userId, { 
        new_role: newRole,
        tenant_id: currentTenant.id 
      });

      toast.success('Role do usuário atualizada com sucesso');
      loadUsers();
    } catch (error) {
      console.error('Erro ao alterar role:', error);
      toast.error('Erro ao alterar role do usuário');
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!currentTenant?.id) return;

    try {
      const { error } = await supabase
        .from('tenant_users')
        .delete()
        .eq('tenant_id', currentTenant.id)
        .eq('user_id', userId);

      if (error) throw error;

      await logAction('remove_user', 'users', userId, { 
        tenant_id: currentTenant.id 
      });

      toast.success('Usuário removido com sucesso');
      loadUsers();
    } catch (error) {
      console.error('Erro ao remover usuário:', error);
      toast.error('Erro ao remover usuário');
    }
  };

  const handleInviteUser = async () => {
    if (!currentTenant?.id || !inviteEmail) return;

    try {
      // Verificar se o usuário já existe
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', inviteEmail)
        .single();

      if (existingUser) {
        // Adicionar ao tenant
        const { error } = await supabase
          .from('tenant_users')
          .insert({
            tenant_id: currentTenant.id,
            user_id: existingUser.id,
            user_role: inviteRole
          });

        if (error) throw error;
      } else {
        // Criar convite (implementar sistema de convites)
        toast.info('Sistema de convites será implementado em breve');
        return;
      }

      await logAction('invite_user', 'users', existingUser.id, { 
        email: inviteEmail,
        role: inviteRole,
        tenant_id: currentTenant.id 
      });

      toast.success('Usuário adicionado com sucesso');
      setIsInviteDialogOpen(false);
      setInviteEmail('');
      setInviteRole('USER');
      loadUsers();
    } catch (error) {
      console.error('Erro ao convidar usuário:', error);
      toast.error('Erro ao convidar usuário');
    }
  };

  const handleUpdatePermission = async (permissionId: string, allowed: boolean) => {
    try {
      const { error } = await supabase
        .from('role_permissions')
        .update({ allowed })
        .eq('id', permissionId);

      if (error) throw error;

      await logAction('update_permission', 'permissions', permissionId, { 
        allowed,
        tenant_id: currentTenant?.id 
      });

      toast.success('Permissão atualizada com sucesso');
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
                          <Badge variant={getRoleBadgeVariant(user.user_role)}>
                            {user.user_role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.last_sign_in_at ? formatDate(user.last_sign_in_at) : 'Nunca'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {user.user_role !== 'SUPERADMIN' && (
                              <>
                                <Select
                                  value={user.user_role}
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
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRemoveUser(user.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
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
            <RoleGuard allowedRoles={['SUPERADMIN']}>
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
                          {permissions
                            .filter(p => p.role === role)
                            .reduce((acc, permission) => {
                              const key = permission.resource;
                              if (!acc[key]) acc[key] = [];
                              acc[key].push(permission);
                              return acc;
                            }, {} as Record<string, Permission[]>)
                          }
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
            </RoleGuard>
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
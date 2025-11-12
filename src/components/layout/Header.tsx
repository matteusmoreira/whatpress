import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Bell,
  Search,
  Settings,
  User,
  LogOut,
  Moon,
  Sun,
  Menu
} from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTenant } from '@/hooks/useTenant'
import { useRoleContext } from '@/contexts/RoleContext'

interface HeaderProps {
  onMenuClick?: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const { theme, setTheme } = useTheme()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { currentTenant, tenants, switchTenant, loading: tenantLoading } = useTenant()
  const { currentRole, isSuperAdmin, logAction } = useRoleContext()

  return (
    <header className="h-16 border-b border-border/40 backdrop-blur-sm bg-background/80 sticky top-0 z-50">
      <div className="flex items-center justify-between h-full px-6">
        {/* Left Section */}
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onMenuClick}
            className="md:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar campanhas, contatos..."
              className="pl-10 pr-4 py-2 w-80 bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
            />
          </div>

          {/* Tenant Selector: mostrar apenas para superadmin ou quando há múltiplas igrejas */}
          {!tenantLoading && (isSuperAdmin || tenants.length > 1) && (
            <div className="hidden md:flex md:items-center md:space-x-2">
              <Select 
                value={currentTenant?.id} 
                onValueChange={async (value) => {
                  const prev = currentTenant?.id
                  await switchTenant(value)
                  try {
                    await logAction('tenant_switch', 'tenant', value, { previous_tenant_id: prev, new_tenant_id: value })
                  } catch (e) {
                    console.error('Falha ao registrar troca de tenant:', e)
                  }
                }}
              >
                <SelectTrigger className="w-[220px] bg-muted/50 border border-border rounded-lg">
                  <SelectValue placeholder="Selecionar tenant" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentRole && currentRole !== 'NONE' && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                  {currentRole}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right Section */}
        <div className="flex items-center space-x-3">
          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="h-9 w-9 p-0"
          >
            {theme === 'light' ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
          </Button>

          {/* Notifications */}
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0 relative">
            <Bell className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full text-xs flex items-center justify-center text-white">
              3
            </span>
          </Button>

          {/* Settings */}
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
            <Settings className="h-4 w-4" />
          </Button>

          {/* User Menu */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-2 h-9 px-3"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center">
                <span className="text-sm font-medium text-white">{user?.name?.charAt(0).toUpperCase() || 'U'}</span>
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium">{user?.name || 'Usuário'}</p>
                <p className="text-xs text-muted-foreground">{user?.email || 'usuario@email.com'}</p>
              </div>
            </Button>

            {/* User Dropdown */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-lg shadow-lg z-50">
                <div className="p-3 border-b border-border">
                  <p className="font-medium">{user?.name || 'Usuário'}</p>
                  <p className="text-sm text-muted-foreground">{user?.email || 'usuario@email.com'}</p>
                  <div className="mt-2 flex items-center gap-2">
                    {user?.plan && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        Plano {user.plan}
                      </span>
                    )}
                    {currentRole && currentRole !== 'NONE' && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                        {currentRole}
                      </span>
                    )}
                  </div>
                  {/* Mobile Tenant Selector */}
                  {!tenantLoading && (isSuperAdmin || tenants.length > 1) && (
                    <div className="md:hidden mt-3">
                      <span className="text-xs text-muted-foreground">Tenant</span>
                      <Select 
                        value={currentTenant?.id} 
                        onValueChange={async (value) => {
                          const prev = currentTenant?.id
                          await switchTenant(value)
                          try {
                            await logAction('tenant_switch', 'tenant', value, { previous_tenant_id: prev, new_tenant_id: value })
                          } catch (e) {
                            console.error('Falha ao registrar troca de tenant:', e)
                          }
                        }}
                      >
                        <SelectTrigger className="w-full bg-muted/50 border border-border rounded-lg mt-1">
                          <SelectValue placeholder="Selecionar tenant" />
                        </SelectTrigger>
                        <SelectContent>
                          {tenants.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {/* Mostrar nome da igreja quando seletor oculto */}
                  {!tenantLoading && tenants.length === 1 && !isSuperAdmin && currentTenant?.name && (
                    <div className="md:hidden mt-3 text-xs text-muted-foreground">
                      Igreja: <span className="font-medium text-foreground">{currentTenant.name}</span>
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <Button variant="ghost" size="sm" className="w-full justify-start">
                    <User className="h-4 w-4 mr-2" />
                    Meu Perfil
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full justify-start">
                    <Settings className="h-4 w-4 mr-2" />
                    Configurações
                  </Button>
                  <div className="border-t border-border my-2"></div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => { logout(); navigate('/login') }}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sair
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

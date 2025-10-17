import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { 
  Crown,
  Building2,
  Users,
  DollarSign,
  Settings,
  Shield,
  BarChart3,
  Database,
  Bell,
  LogOut,
  Menu,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Dashboard', href: '/superadmin', icon: BarChart3 },
  { name: 'Tenants', href: '/superadmin/tenants', icon: Building2 },
  { name: 'Usuários', href: '/superadmin/users', icon: Users },
  { name: 'Faturamento', href: '/superadmin/billing', icon: DollarSign },
  { name: 'Sistema', href: '/superadmin/system', icon: Database },
  { name: 'Configurações', href: '/superadmin/settings', icon: Settings },
]

export default function SuperAdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform duration-200 ease-in-out lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-4 border-b">
            <div className="p-2 bg-gradient-to-br from-primary to-primary-glow rounded-lg">
              <Crown className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">SuperAdmin</h1>
              <p className="text-xs text-muted-foreground">Sistema de Gestão</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navigation.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </a>
            ))}
          </nav>

          {/* Bottom section */}
          <div className="px-4 py-4 border-t space-y-2">
            <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground">
              <Bell className="h-5 w-5" />
              Notificações
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground">
              <Shield className="h-5 w-5" />
              Segurança
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3 text-red-600 hover:text-red-700 hover:bg-red-50">
              <LogOut className="h-5 w-5" />
              Sair
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-30 bg-card border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>

            <div className="flex items-center gap-4">
              <div className="text-sm">
                <span className="text-muted-foreground">Logado como:</span>
                <span className="ml-2 font-medium text-foreground">Super Administrador</span>
              </div>
              <div className="h-8 w-8 bg-gradient-to-br from-primary to-primary-glow rounded-full flex items-center justify-center">
                <Crown className="h-4 w-4 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
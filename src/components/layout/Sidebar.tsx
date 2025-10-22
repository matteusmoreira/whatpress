import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  MessageCircle,
  LayoutDashboard,
  Users,
  MessageSquare,
  BarChart3,
  Settings,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Database,
  Shield,
  Crown,
  Calendar,
  Bell,
  TrendingUp
} from 'lucide-react'
import { useRoles } from '@/hooks/useRoles'

interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const { currentRole } = useRoles()
  const isSuperAdmin = currentRole?.role_type === 'SUPERADMIN'
  const isAdmin = isSuperAdmin || currentRole?.role_type === 'ADMIN'

  const navigation = [
    { 
      name: 'Dashboard', 
      href: '/dashboard', 
      icon: LayoutDashboard, 
      current: location.pathname === '/dashboard' 
    },
    { 
      name: 'Contatos', 
      href: '/dashboard/contacts', 
      icon: Users, 
      current: location.pathname.startsWith('/dashboard/contacts') 
    },
    { 
      name: 'Campanhas', 
      href: '/dashboard/campaigns', 
      icon: MessageSquare, 
      current: location.pathname.startsWith('/dashboard/campaigns') 
    },
    { 
      name: 'Analytics', 
      href: '/dashboard/analytics', 
      icon: BarChart3, 
      current: location.pathname.startsWith('/dashboard/analytics') 
    },
    { 
      name: 'Automação', 
      href: '/dashboard/automation', 
      icon: Settings, 
      current: location.pathname.startsWith('/dashboard/automation') 
    },
    { 
      name: 'WhatsApp', 
      href: '/dashboard/whatsapp', 
      icon: MessageCircle, 
      current: location.pathname.startsWith('/dashboard/whatsapp') 
    },
    { 
      name: 'Templates', 
      href: '/dashboard/templates', 
      icon: Bell, 
      current: location.pathname.startsWith('/dashboard/templates') 
    },
    { 
      name: 'Agendamentos', 
      href: '/dashboard/scheduling', 
      icon: Calendar, 
      current: location.pathname.startsWith('/dashboard/scheduling') 
    },
    { 
      name: 'Mensagens', 
      href: '/dashboard/messages', 
      icon: MessageSquare, 
      current: location.pathname.startsWith('/dashboard/messages') 
    },
    { 
      name: 'Notificações', 
      href: '/dashboard/notifications', 
      icon: Bell, 
      current: location.pathname.startsWith('/dashboard/notifications') 
    },
    { 
      name: 'Quotas', 
      href: '/dashboard/quotas', 
      icon: TrendingUp, 
      current: location.pathname.startsWith('/dashboard/quotas') 
    },
    { 
      name: 'Roles', 
      href: '/dashboard/roles', 
      icon: Shield, 
      current: location.pathname.startsWith('/dashboard/roles') 
    },
  ]

  const bottomNavigation = [
    {
      name: 'SuperAdmin',
      href: '/superadmin',
      icon: Crown,
      current: location.pathname.startsWith('/superadmin')
    },
    {
      name: 'Configurações',
      href: '/dashboard/settings',
      icon: Settings,
      current: location.pathname.startsWith('/dashboard/settings')
    },
    {
      name: 'Suporte',
      href: '/dashboard/support',
      icon: HelpCircle,
      current: location.pathname.startsWith('/dashboard/support')
    }
  ]
 
  const navigationFiltered = navigation.filter((item) => {
    if (item.href === '/dashboard/quotas' || item.href === '/dashboard/roles') {
      return !!isAdmin
    }
    return true
  })

  const bottomNavigationFiltered = bottomNavigation.filter((item) => {
    if (item.href === '/superadmin') {
      return !!isSuperAdmin
    }
    return true
  })
 
  return (
    <div className={cn(
      'flex flex-col h-full bg-card border-r border-border/40 transition-all duration-300',
      collapsed ? 'w-16' : 'w-64',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/40">
        {!collapsed && (
          <div className="flex items-center space-x-2">
            <MessageCircle className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold gradient-text">Whatpress</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="h-8 w-8 p-0"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>
 
      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navigationFiltered.map((item) => (
          <Link
            key={item.name}
            to={item.href}
            className={cn(
              'flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
              item.current
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
              collapsed && 'justify-center'
            )}
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span>{item.name}</span>}
          </Link>
        ))}
      </nav>
 
      {/* Bottom Navigation */}
      <div className="p-4 space-y-2 border-t border-border/40">
        {bottomNavigationFiltered.map((item) => (
          <Link
            key={item.name}
            to={item.href}
            className={cn(
              'flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
              item.current
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
              collapsed && 'justify-center'
            )}
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span>{item.name}</span>}
          </Link>
        ))}
        
        {/* Upgrade Button */}
        {!collapsed && (
          <div className="mt-4 p-3 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg border border-primary/20">
            <div className="flex items-center space-x-2 mb-2">
              <Crown className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Upgrade Pro</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Desbloqueie recursos avançados
            </p>
            <Button variant="default" size="sm" className="w-full">
              Upgrade
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
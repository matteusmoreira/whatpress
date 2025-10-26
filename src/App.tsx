import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from '@/components/theme-provider'
import LandingPage from '@/pages/Landing'
import LoginPage from '@/pages/Login'
import RegisterPage from '@/pages/Register'
import DashboardLayout from '@/components/layout/DashboardLayout'
import DashboardPage from '@/pages/Dashboard'
import SuperAdminLayout from '@/components/layout/SuperAdminLayout'
import SuperAdminPage from '@/pages/SuperAdmin'
import ContactsPage from '@/pages/Contacts'
import CampaignsPage from '@/pages/Campaigns'
import CreateCampaignPage from '@/pages/CreateCampaign'
import AnalyticsPage from '@/pages/Analytics'
import AutomationPage from './pages/Automation'
import FlowBuilderPage from './pages/FlowBuilder'
import WhatsAppConnectionsPage from '@/pages/WhatsAppConnections'
import WhatsAppIntegrationPage from './pages/WhatsAppIntegration'
import TemplatesPage from './pages/Templates'
import SchedulingPage from './pages/Scheduling'
import NotificationsPage from './pages/Notifications'
import MessagesPage from './pages/Messages'
import SettingsPage from './pages/Settings'
import SupportPage from './pages/Support'
import QuotaManagementPage from './pages/QuotaManagement'
import { Suspense, lazy } from 'react'
import NotFoundPage from '@/pages/NotFound'
import DevErrorPage from '@/pages/DevError'
const RoleManagementPage = lazy(() => import('./pages/RoleManagement').then(m => ({ default: m.RoleManagement })))
// RoleManagement page is lazy-loaded below
import RequireAuth from '@/components/auth/RequireAuth'
import './App.css'
import { Toaster } from '@/components/ui/toaster'
import { isSupabaseConfigured } from '@/lib/supabase'
import { AdminOnly, SuperAdminOnly } from '@/components/RoleGuard'
import UnauthorizedPage from '@/pages/Unauthorized'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import OfflineBanner from '@/components/OfflineBanner'

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      {!isSupabaseConfigured && (
        <div className="bg-yellow-100 dark:bg-yellow-900 border-b border-yellow-300 dark:border-yellow-700 text-yellow-900 dark:text-yellow-200 text-sm px-4 py-2 text-center">
          Supabase não está configurado. Algumas funcionalidades podem ficar indisponíveis. Consulte o arquivo <span className="font-medium">docs/supabase-setup.md</span> no repositório.
        </div>
      )}
      <OfflineBanner />
      <ErrorBoundary>
        <Router
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/dashboard" element={
              <RequireAuth>
                <DashboardLayout />
              </RequireAuth>
            }>
              <Route index element={<DashboardPage />} />
              <Route path="contacts" element={<ContactsPage />} />
              <Route path="campaigns" element={<CampaignsPage />} />
              <Route path="campaigns/create" element={<CreateCampaignPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="automation" element={<AutomationPage />} />
              <Route path="automation/flow/:id" element={<FlowBuilderPage />} />
              <Route path="whatsapp-integration" element={<WhatsAppIntegrationPage />} />
              <Route path="whatsapp" element={<WhatsAppConnectionsPage />} />
              <Route path="templates" element={<TemplatesPage />} />
              <Route path="scheduling" element={<SchedulingPage />} />
              <Route path="messages" element={<MessagesPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="quotas" element={<AdminOnly redirectTo="/unauthorized" showError={false}><QuotaManagementPage /></AdminOnly>} />
              <Route path="roles" element={<AdminOnly redirectTo="/unauthorized" showError={false}><Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Carregando...</div>}><RoleManagementPage /></Suspense></AdminOnly>} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="support" element={<SupportPage />} />
            </Route>
            <Route path="/superadmin" element={
              <RequireAuth>
                <SuperAdminOnly redirectTo="/unauthorized" showError={false}>
                  <SuperAdminLayout />
                </SuperAdminOnly>
              </RequireAuth>
            }>
              <Route index element={<SuperAdminPage />} />
              {/* Rota de teste de erro controlado (apenas SUPERADMIN) */}
              <Route path="test-error" element={<DevErrorPage />} />
            </Route>
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
            {import.meta.env.DEV && (
              <Route path="/dev/error" element={<DevErrorPage />} />
            )}
            {/* Catch-all para rotas desconhecidas */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          <Toaster />
        </Router>
      </ErrorBoundary>
    </ThemeProvider>
  )
}

export default App
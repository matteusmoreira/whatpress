import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
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
import RequireAuth from '@/components/auth/RequireAuth'
import './App.css'
import { Toaster } from '@/components/ui/toaster'

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Router>
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
            <Route path="settings" element={<SettingsPage />} />
            <Route path="support" element={<SupportPage />} />
          </Route>
          <Route path="/superadmin" element={
            <RequireAuth>
              <SuperAdminLayout />
            </RequireAuth>
          }>
            <Route index element={<SuperAdminPage />} />
          </Route>
        </Routes>
        <Toaster />
      </Router>
    </ThemeProvider>
  )
}

export default App
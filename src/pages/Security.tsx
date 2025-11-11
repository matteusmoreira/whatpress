import { useState } from 'react'
import { Shield, Activity, Settings, AlertTriangle } from 'lucide-react'
import { SecurityDashboard } from '@/components/SecurityDashboard'
import { SecuritySettings } from '@/components/SecuritySettings'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function Security() {
  const [activeTab, setActiveTab] = useState('dashboard')

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Segurança</h1>
          <p className="text-muted-foreground">
            Gerencie a segurança e auditoria do sistema
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Shield className="h-6 w-6 text-green-500" />
          <span className="text-sm text-green-600 font-medium">Sistema Protegido</span>
        </div>
      </div>

      {/* Alertas de Segurança */}
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2 text-orange-800">
            <AlertTriangle className="h-5 w-5" />
            <span>Alertas de Segurança</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-orange-700">
            <p>• Criptografia de dados está ativada</p>
            <p>• Auditoria de segurança está funcionando</p>
            <p>• Backups automáticos configurados</p>
          </div>
        </CardContent>
      </Card>

      {/* Abas de Navegação */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="dashboard" className="flex items-center space-x-2">
            <Activity className="h-4 w-4" />
            <span>Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center space-x-2">
            <Settings className="h-4 w-4" />
            <span>Configurações</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center space-x-2">
            <Shield className="h-4 w-4" />
            <span>Relatórios</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <SecurityDashboard />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <SecuritySettings />
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Relatórios de Segurança</CardTitle>
              <CardDescription>
                Em breve: relatórios detalhados de segurança e conformidade
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <Shield className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Funcionalidade em desenvolvimento</p>
                <p className="text-sm mt-2">Relatórios detalhados de segurança estarão disponíveis em breve.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
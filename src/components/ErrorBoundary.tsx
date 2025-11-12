import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { logUIError } from '@/services/errorLogging'

type ErrorBoundaryState = {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren<unknown>, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren<unknown>) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Logar o erro para monitoramento. Integração com Supabase via RPC
    console.error('ErrorBoundary caught error:', error, errorInfo)
    // Não bloquear a UI por falhas de logging
    logUIError(error, errorInfo).catch(() => {})
  }

  handleRetry = () => {
    // Tenta recarregar a rota atual sem reload completo
    this.setState({ hasError: false, error: undefined })
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
          <Card className="max-w-lg w-full">
            <CardHeader>
              <CardTitle>Ocorreu um erro inesperado</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Algo deu errado ao renderizar a interface. Você pode tentar novamente.
              </p>
              {this.state.error && (
                <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-48 mb-4">
                  {this.state.error.message}
                </pre>
              )}
              <div className="flex gap-2">
                <Button onClick={this.handleRetry} variant="default">Tentar novamente</Button>
                <Button onClick={() => window.location.reload()} variant="outline">Recarregar página</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

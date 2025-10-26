import React from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <CardTitle>Página não encontrada</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            O caminho acessado não existe. Você pode voltar para a página inicial ou ir para o Dashboard.
          </p>
          <div className="flex gap-2">
            <Button asChild variant="default">
              <Link to="/">Ir para Início</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/dashboard">Ir para Dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
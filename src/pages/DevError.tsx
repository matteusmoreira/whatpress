//

// Página de teste para acionar o ErrorBoundary em desenvolvimento
// Acessar /dev/error para validar captura e logging de erros de UI
export default function DevErrorPage() {
  throw new Error('DevErrorPage: erro intencional para testar ErrorBoundary e logging')
}

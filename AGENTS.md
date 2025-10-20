# AGENTS.md - Guia para Agentes IA

## Stack Tecnológica
- React 18 com TypeScript
- Vite como bundler
- npm como gerenciador de pacotes (NUNCA use yarn)

## Estrutura de Pastas
/src
  /components - Componentes React reutilizáveis
  /pages - Páginas da aplicação
  /hooks - Custom hooks
  /services - Lógica de API e integrações
  /utils - Funções utilitárias
  /types - Definições TypeScript

## Padrões de Código

### TypeScript
- SEMPRE use TypeScript strict mode
- Todos os componentes devem ter interfaces tipadas
- Use named exports, nunca default exports
- Proibido usar `any` - sempre defina tipos específicos

### React
- Use APENAS componentes funcionais com hooks
- Props devem ter interface própria (ex: ComponentNameProps)
- Use React.FC<Props> para tipar componentes
- Custom hooks devem começar com "use" (ex: useAuth)

### Naming Conventions
- Componentes: PascalCase (ex: UserProfile.tsx)
- Hooks: camelCase com prefixo use (ex: useFormValidation.ts)
- Funções utilitárias: camelCase (ex: formatCurrency.ts)
- Constantes: UPPER_SNAKE_CASE (ex: API_BASE_URL)

### Boas Práticas
- Sempre adicione tratamento de erros com try/catch
- Use async/await em vez de .then()
- Componentes não podem ter mais de 200 linhas
- Cada função deve fazer UMA coisa apenas
- PROIBIDO console.log em produção - use sistema de logging

### Comentários
- Use JSDoc para funções públicas
- Explique o PORQUÊ, não o QUÊ
- Comentários em português brasileiro

## Ferramentas e Comandos
- Build: `npm run build`
- Dev server: `npm run dev`
- Testes: `npm test`
- Lint: `npm run lint`

## Contexto Arquitetural
Este projeto é um sistema web progressivo (PWA)
A autenticação usa Supabase.Estado global gerenciado com Context API + hooks customizados.

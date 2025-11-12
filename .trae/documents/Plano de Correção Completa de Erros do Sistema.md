## Objetivos
- Eliminar erros de build/lint, warnings críticos e comportamentos incorretos.
- Padronizar tratamento de erros e logging, sem silenciar falhas importantes.
- Garantir consistência de tipagem, compatibilidade de ferramentas e segurança de variáveis de ambiente.
- Validar rotas, páginas e integrações (Supabase, Webhooks), com testes automatizados.

## Diagnóstico Inicial
- Rodar varredura de lint e análise estática em todo o repo.
- Levantar pontos com HMR inconsistências (React Refresh), imports quebrados e supressões indevidas no build.
- Mapear locais com `.catch(() => {})` e `try/catch {}` vazios para corrigir.

## Correções de Lint e Configuração
- Unificar configuração de ESLint entre root e `src/lib/sdk`.
- Ajustar compatibilidade `@typescript-eslint` com TypeScript 5.9:
  - Opção A: atualizar `@typescript-eslint/*` para versão que suporte TS 5.9.
  - Opção B: pinar `typescript@~5.3` e manter plugin estável.
- Reativar gradualmente regras desativadas e corrigir código:
  - `no-unused-vars`, `no-empty`, `prefer-const`, `react-hooks/exhaustive-deps` onde fizer sentido.
- Corrigir indentação/tabs e formatação em arquivos de configuração (ex.: `tailwind.config.ts`).

## Build/Dev Experience
- Remover supressão de warnings críticos no `vite.config.ts` e tratar causas (imports não resolvidos/externos não usados).
- Corrigir incompatibilidade de export para React Refresh (ex.: `src/contexts/RoleContext.tsx`) separando helpers em arquivos próprios.

## Refatorações de Código
- Remover imports/variáveis não utilizadas em páginas com maior incidência:
  - `src/pages/Support.tsx`, `Templates.tsx`, `Settings.tsx`, `SuperAdmin.tsx`, `WhatsAppIntegration.tsx`, `WhatsAppConnections.tsx`.
- Substituir blocos `catch {}` vazios por `console.warn`/logger com contexto.
- Aplicar `prefer-const` e eliminar semicolons supérfluos que quebram lint em libs (`monitoring.ts`, `bulkMessages.ts`, `analytics.ts`).
- Ajustar regex com escapes desnecessários (`src/lib/templates.ts`).

## Tratamento de Erros e Logging
- Centralizar logger (níveis info/warn/error) e substituir `.catch(() => {})` em:
  - `src/components/ErrorBoundary.tsx`, `src/main.tsx`.
- Padronizar mensagens de erro em serviços (Evolution API, WhatsApp Instance, Backup, Scheduler).
- Adicionar feedback de UI onde necessário (toasts/banners) em ações críticas.

## Tipagem TypeScript
- Reduzir `any` em serviços centrais: `rateLimitService`, `whatsappInstanceService`, `evolutionApi`, `securityAuditService`.
- Criar tipos/domínios locais ou `zod` schemas para IO de API/DB.

## Supabase e Autenticação
- Validar RPCs e tabelas usadas:
  - `get_user_role`, `get_user_tenants`, `has_permission`, `is_superadmin`, `is_tenant_admin`, `is_tenant_member`.
- Implementar persistência para status de rotação de chave (hoje local):
  - Tabela `encryption_keys` (user_id, tenant_id, created_at, expires_at, is_active).
  - Endpoint/API para leitura/rotação com auditoria.
  - Atualizar `useEncryption`/Dashboard Segurança para usar fonte persistente.

## Webhooks e Integrações
- Remover dados mock e substituir por chamadas reais com estados controlados.
- Validação de payloads, idempotência e retries no `api/webhook.ts`.
- Logs e métricas dos eventos (sucesso/erro, latência).

## Segurança e Variáveis de Ambiente
- Remover chaves sensíveis do `.env` do repo público.
- Validar presença de `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` e variáveis server-side em runtime.
- Habilitar cabeçalhos seguros e CORS consistentes no servidor interno (`src/lib/api/server.ts`).

## Testes e Validação
- Unitários: `encryption.ts`, `useAuth`, `RoleGuard`, `bulkMessages`, `monitoring`.
- Integração: fluxo de mensagens, quotas/limites, roles e permissões, webhook ingest e persistência.
- E2E básico: autenticação, navegação, ações críticas (criar campanha, enviar mensagem, rotação de chave).

## Performance e UX
- Memorizar componentes pesados (React memo/useMemo) e debounce em buscas.
- Virtualização em listas grandes (contacts/messages) se necessário.
- Acessibilidade: rótulos, foco, aria, contraste.

## Automação CI/CD
- Pipeline (GitHub Actions): lint + testes em PRs, build verificado.
- Gate para impedir merge com erros/lint.

## Entregas e Cronograma
- Semana 1: Diagnóstico, ESLint/TypeScript, correções rápidas (imports/const/indentação), remoção de supressões em Vite.
- Semana 2: Tratamento de erros e logger central, tipagem em serviços críticos, correções em páginas principais.
- Semana 3: Supabase (persistência rotação de chave, validações RPC), Webhook robustez.
- Semana 4: Testes unitários/integrados/E2E, otimizações de UX/performance, CI/CD.

## Critérios de Aceite
- Lint com regras principais reativadas sem erros.
- Build sem warnings críticos e HMR estável.
- Páginas navegam sem erros e mostram estados corretos.
- Logs de erro consistentes e telemetria mínima habilitada.
- Testes passam com cobertura mínima definida (ex.: 70%).
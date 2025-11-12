## Problemas identificados

* Requisição externa falha: `net::ERR_ABORTED https://ipapi.co/json/` em `src/lib/analytics.ts:321-334`.

* Tabelas ausentes no Supabase: `public.analytics_events` e `public.user_profiles` geram erros PGRST (`schema cache`).

* Quebra no Dashboard por `.map` em dados indefinidos (linha reportada): falta de guarda defensiva quando hooks retornam valores não carregados.

## Solução planejada

### 1) Analytics resiliente

* Adicionar flag de ambiente `VITE_ANALYTICS_ENABLED` para desligar analytics no ambiente de dev.

* Em `src/lib/analytics.ts`:

  * Respeitar `VITE_ANALYTICS_ENABLED`; se false, pular `getContext()`, `saveEvent()` e `saveEventsBatch()`.

  * Manter `try/catch` atual para `getLocation()` e logar como warning sem afetar UI.

### 2) Criar tabelas e RLS no Supabase

* `analytics_events`:

  * Colunas: `id uuid default gen_random_uuid() primary key`, `event text`, `user_id uuid`, `tenant_id uuid`, `session_id text`, `timestamp timestamptz`, `properties jsonb`, `context jsonb`.

  * Índices: por `tenant_id`, `timestamp`.

  * RLS: habilitar; políticas de INSERT para `authenticated` (limitar por `user_id = auth.uid()` quando aplicável); SELECT para `authenticated` por `tenant_id`.

* `user_profiles`:

  * Colunas: `id uuid primary key` (igual a `auth.users.id`), `name text`, `company text`, `created_at timestamptz default now()`.

  * RLS: habilitar; SELECT/UPDATE para `authenticated` onde `id = auth.uid()`.

* Executar SQL via Supabase Studio aplicando migração única contendo ambos os CREATE TABLE e políticas.

### 3) Robustez no Dashboard

* Em `src/pages/Dashboard.tsx`, garantir que todos os arrays usados em `.map` são verificados com `Array.isArray(...)` antes de mapear (ex.: `randomizationProfiles`, `rateLimitConfigs`, `instances`, `runningCampaigns`, `userTenants`).

* Onde dados vierem nulos/indefinidos, exibir estado vazio amigável (mensagem e evitar renderização listada).

### 4) Ajuste no useAuth/useCache

* Em `src/hooks/useAuth.ts`, quando SELECT em `user_profiles` retornar erro `PGRST205`, tratar como ausência de perfil e não quebrar fluxo (retornar `null` silenciosamente).

* Em `src/hooks/useCache.ts` (onde o erro foi logado), tratar especificamente códigos PGRST de tabela ausente, retornando `null`/fallback até a tabela existir.

## Validação

* Reiniciar `npm run dev:full`.

* Login com SuperAdmin e navegar para Dashboard e `/superadmin` sem erros.

* Verificar que não há logs de PGRST para `analytics_events` e `user_profiles`.

* Opcional: com `VITE_ANALYTICS_ENABLED=true`, registrar um evento e consultar na tabela `analytics_events`.

## Observações

* Não altero lógica de negócio; apenas crio estrutura de banco e fail-safes para impedir que o UI quebre quando dados externos ou tabelas não estão disponíveis.

## Próximo passo

* Após aprovação, aplico as migrações, introduzo a flag `VITE_ANALYTICS_ENABLED` e faço os ajustes pontuais nos arquivos citados, seguido de testes ponta-a-ponta.


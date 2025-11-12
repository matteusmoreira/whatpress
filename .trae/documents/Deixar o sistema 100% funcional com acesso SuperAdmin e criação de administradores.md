## Objetivo
- Garantir login e painel de SuperAdmin acessível, criação/gestão de administradores e funcionamento ponta-a-ponta das rotas/API.

## Diagnóstico
- O painel SuperAdmin é protegido por `SuperAdminOnly` em `src/App.tsx:75` e depende do `RoleContext` carregar a role via Supabase (`src/contexts/RoleContext.tsx:184`).
- Se `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` faltarem, o cliente Supabase vira no-op (`src/lib/supabase.ts:80-89`), impedindo login/roles.
- A API `/api/roles` precisa de `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE` para operar (`webhook-server.js:18-27`, endpoints em `webhook-server.js:399-626`).
- Credenciais padrão de SuperAdmin existem: `admin@sistema.com` / `admin123456` (`scripts/get-superadmin-token.mjs:7-8`, `create-superadmin.js:21-22`).

## Pré‑requisitos (.env)
- Criar `.env` na raiz com:
  - `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
  - `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE`
- Referência: `docs/supabase-setup.md:11-16`.

## Passos de Configuração
1) Configurar ambiente
- Preencher `.env` com as chaves do MESMO projeto Supabase (frontend e backend). Reiniciar `npm run dev:full` após editar.
- Validar `http://localhost:3001/health` retornando `supabase: 'connected'` (usa `SUPABASE_SERVICE_ROLE`).

2) Aplicar migrações no Supabase
- Executar no SQL Editor do Supabase os arquivos em `supabase/migrations/` para criar:
  - Tabelas multi‑tenant e permissões (ex.: `2025-01-20_enhanced_roles_system_fixed.sql` contém `role_permissions` e funções `get_user_role`, `get_user_tenants`, `has_permission`).
  - Policies e helpers de SuperAdmin (ex.: `2025-10-19_multi_tenant.sql`, `fix_superadmin_policies.sql`).

3) Criar/garantir o SuperAdmin
- Usar o script de serviço: `create-superadmin.js` (requere `SUPABASE_SERVICE_ROLE`). Ele cria o usuário, o tenant “Sistema Principal”, associa como `SUPERADMIN` e quotas (`create-superadmin.js:20-90`).
- Alternativamente, `scripts/create-superadmin-user.js <email> <senha> [tenant]` faz o mesmo com parâmetros.
- Credenciais padrão: email `admin@sistema.com`, senha `admin123456`.

4) Iniciar e validar servidores
- Executar `npm run dev:full` (já ativo). Confirmar:
  - Frontend consegue login (`src/hooks/useAuth.ts:122-133`).
  - Backend `/api/roles` responde com 200 (depende de tokens do Supabase via `Authorization: Bearer`).

## Acesso ao Painel SuperAdmin
- Login com `admin@sistema.com` / `admin123456`.
- Acessar `/superadmin` (roteado em `src/App.tsx:75-88`).
- Se redirecionar para `/unauthorized`:
  - Verificar se `RoleContext` carregou `currentRole = 'SUPERADMIN'` (`src/contexts/RoleContext.tsx:180-199`).
  - Checar associação em `user_tenants` (role `SUPERADMIN`, status `active`).
  - Garantir que pelo menos um tenant está selecionado (`useTenants.ts:78-83` seleciona automaticamente o primeiro).

## Criar Administradores
- Entrar no tenant desejado (menu do Dashboard).
- Abrir “Gerenciamento de Roles” em `/dashboard/roles` (rota em `src/App.tsx:75`, componente `src/pages/RoleManagement.tsx`).
- Usar “Convidar Usuário” para adicionar por email e escolher `ADMIN` ou `USER` (`RoleManagement.tsx:402-451`, ação `invite` via backend `webhook-server.js:512-553`).
- Alterar role de um usuário existente com `update_role` (`RoleManagement.tsx:228-261`, API `webhook-server.js:479-494`).

## Testes Ponta‑a‑Ponta
- Login e navegação até `/superadmin` (badge `SUPERADMIN` visível em `src/pages/Dashboard.tsx:261-268`).
- Listar usuários do tenant em `/dashboard/roles` e promover para `ADMIN`.
- Validar permissões consultando `role_permissions` e `has_permission` (funções em `supabase/migrations`).
- Health do backend em `http://localhost:3001/health` deve indicar `connected`.

## Observações
- O menu do `SuperAdminLayout` inclui links (`/superadmin/tenants`, `/superadmin/users`, etc., `src/components/layout/SuperAdminLayout.tsx:17-26`) que ainda não possuem rotas declaradas em `App.tsx`. Após liberar acesso, proponho alinhar navegação com rotas existentes ou criar essas páginas.

## Próximos Passos
- Após sua confirmação, eu:
  - Ajusto `.env`, valido health e aplico migrações.
  - Rodo o script de SuperAdmin, verifico associação e quotas.
  - Testo login e acesso ao `/superadmin`.
  - Exercito `/dashboard/roles` para convidar/promover administradores e deixo o fluxo 100% funcional.
## Objetivo
Implementar na página de Contatos:
1) Inserção manual de contato
2) Alternativa de visualização em Kanban integrada ao CRM

## Contexto da Base
- Página de Contatos: `src/pages/Contacts.tsx` (export da página em `src/pages/Contacts.tsx:70`).
- Rota: `src/App.tsx:11` (import) e `src/App.tsx:71` (Route `"/dashboard/contacts"`).
- Link de navegação: `src/components/layout/Sidebar.tsx:45`/`47`.
- Importação em massa já existe: `src/components/ContactImportModal.tsx` (inserção via Supabase em `src/components/ContactImportModal.tsx:182-199`).
- Hook de contatos (leitura e consentimento): `src/hooks/useContacts.ts:38` (fetch em `:60/:68/:80`).
- Supabase client: `src/lib/supabase.ts`.
- Integrações CRM: classes e modelos em `src/lib/integrations/crm.ts` (leads com `status`). API de integrações: `src/lib/api/integrations.ts` (rotas /api/integrations/crm/...)

## Inserção Manual de Contato
1. UI
- Adicionar botão "Adicionar Contato" no header de Contatos ao lado de Importar/Exportar (`src/pages/Contacts.tsx`, próximo de `:259-277`).
- Abrir um modal `ContactCreateModal` usando `Dialog` (`src/components/ui/dialog.tsx`). Campos:
  - `Nome` (opcional, usa telefone se vazio)
  - `Telefone` (obrigatório, normalização BR em formato 55DDDNúmero; reuso de lógica inspirada em `normalizePhoneBr` de `ContactImportModal.tsx:30-42`)
  - `Tags` (opcional, lista simples)
  - `Consentimento` (checkbox opcional)

2. Validação e quotas
- Validar telefone (11 dígitos + prefixo 55).
- Antes de inserir, verificar quota com `useQuotas.canCreateResource('contacts')` já disponível em `Contacts.tsx:222-224`; exibir tooltip se bloqueado (`formatUsageTooltip`).

3. Inserção (Supabase)
- Inserir em `contacts` com `tenant_id` quando houver (`useTenant.currentTenant?.id`), ou `user_id` caso contrário, seguindo o padrão da importação (`ContactImportModal.tsx:182-199`).
- Deduplicação: consultar `contacts.phone_number` por `tenant_id`/`user_id` e evitar duplicatas.
- Definir `created_at: new Date().toISOString()`; `is_group: false`; `profile_pic_url: null`.
- Se marcar consentimento, registrar via `useContacts.recordContactConsent(contactId, true, 'manual_entry')` (`src/hooks/useContacts.ts:136-160`).

4. Atualização de UI
- Fechar modal, `toast` de sucesso e chamar `loadContacts()` (`src/pages/Contacts.tsx:97-143`).

## Kanban com CRM
1. Alternar visualização
- Incluir `Tabs` com duas visualizações: `Lista` (atual) e `Kanban`. `Tabs` já importado (`src/pages/Contacts.tsx:6`), ajustar retorno para conter `TabsList`/`TabsTrigger` e `TabsContent`.

2. Board Kanban (frontend)
- Criar componente `ContactsKanban.tsx` (React) com colunas por estágio.
- Dependência de arrastar/soltar: adicionar `@dnd-kit/core` e `@dnd-kit/sortable` para drag-and-drop (não há libs DnD existentes no projeto). Cards mostram `name`, `phone_number` (formatação via `formatPhone` `src/pages/Contacts.tsx:209-219`).

3. Estágios
- Caso sem CRM integrado: usar estágios locais (ex.: `novo`, `qualificado`, `em_negociacao`, `ganho`, `perdido`). Persistência em banco:
  - Adicionar coluna `crm_status` em `contacts` (enum ou texto com check), default `novo`.
  - Índice por `tenant_id, crm_status` para eficiência.
  - RLS: permitir `update crm_status` para proprietário do `tenant_id`/`user_id`.
- Caso com CRM integrado (Salesforce/HubSpot/Pipedrive): exibir board de `leads` agrupados por `lead.status` (ou `dealstage`/`StageName`).
  - Sincronização: acionar `POST /api/integrations/crm/:id/sync/leads` (`src/lib/api/integrations.ts:176-206`).
  - Listagem de leads: adicionar endpoint `GET /api/integrations/crm/:id/leads` no backend que chama `crmIntegration.getLeads()` e retorna ao frontend (seguindo padrão de rotas de `integrations.ts`).
  - Mapeamento para contato: por `phone` quando disponível; fallback por `email`/nome. Se houver correspondência, exibir avatar/telefone do contato no card.

4. Persistência de drag
- Ao mover um card:
  - Sem CRM: atualizar `contacts.crm_status` via `supabase.from('contacts').update({ crm_status: novoStatus }).eq('id', contactId)`.
  - Com CRM: atualizar status do lead via backend (`PATCH /api/integrations/crm/:id/leads/:leadId`) a ser adicionado; para Salesforce usar `updateLead` (`src/lib/integrations/crm.ts:301-327`). Registrar mudanças localmente em uma tabela `leads` (ver abaixo) para histórico.

5. Tabela `leads` (se não existir)
- Criar tabela `leads` com campos: `id` (uuid), `tenant_id`, `contact_id` (nullable), `email`, `name`, `status`, `value` (numérico), `provider` (`salesforce|hubspot|pipedrive`), `external_id`, `created_at`, `updated_at`.
- Índices: `tenant_id`, `status`, `external_id`.
- RLS: leitura/escrita por `tenant_id`.
- Sincronizadores no backend escrevem/atualizam `leads` (conforme já sugerido por upserts em `src/lib/integrations/crm.ts`).

## UX e Acessibilidade
- Empty state no Kanban: instruir configuração de CRM quando sem integração ativa; botão para "Sincronizar Leads".
- Feedbacks: toasts em operações (mover card, inserir contato).
- Performance: paginação/virtualização simples por coluna (limitar 50 itens por coluna, lazy load).

## Segurança
- Não logar dados sensíveis.
- Respeitar RLS do Supabase e `tenant_id`.
- Sanitizar inputs no modal (trim, somente dígitos no telefone).

## Testes e Verificação
- Testar manualmente inserção e deduplicação.
- Testar formato de telefone e exibição em lista e Kanban.
- Testar drag-and-drop com atualização de `crm_status` local e, com CRM ativo, atualizar `lead.status` via backend.
- Verificar quotas ao criar.

## Entregáveis Técnicos
- `ContactCreateModal` (novo) usando `Dialog`.
- Atualização de `src/pages/Contacts.tsx` para botão, abertura de modal e Tabs Kanban.
- `ContactsKanban.tsx` com DnD.
- Migração SQL para `contacts.crm_status` e tabela `leads` + políticas.
- Endpoints backend `GET /api/integrations/crm/:id/leads` e `PATCH /api/integrations/crm/:id/leads/:leadId`.

## Observações
- Mantemos o estilo shadcn/Radix e Tailwind já usados na página.
- Sem dependências DnD atualmente; a escolha é `@dnd-kit` por maturidade.
- Caso prefira, podemos começar com Kanban local (sem CRM) e, numa etapa seguinte, ligar aos provedores.

Confirma prosseguir com esta implementação?
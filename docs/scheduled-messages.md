# Scheduled Messages (Mensagens Agendadas)

Este projeto possui funcionalidades de agendamento de envio de mensagens em massa via hook `useMessages` (funções `sendBulkMessages`, `getScheduledMessages` e `cancelScheduledMessage`). Para que funcionem corretamente, é necessário criar a tabela `public.scheduled_messages` no Supabase.

## Criar tabela no Supabase

Execute o script SQL em `supabase/scheduled_messages.sql` no seu projeto Supabase (via SQL Editor ou CLI):

```sql
-- veja arquivo supabase/scheduled_messages.sql
```

A tabela inclui:
- id (uuid, PK)
- user_id (uuid, FK -> auth.users)
- instance_id (uuid, FK -> public.whatsapp_instances)
- contact_number (varchar)
- message (text)
- media_url (text, opcional)
- scheduled_at (timestamp com timezone)
- status (pending|scheduled|sent|failed|canceled)
- created_at, updated_at

Há índices para eficiência e políticas RLS permitindo que usuários autenticados gerenciem suas próprias mensagens agendadas.

## Fluxo de uso
- Envio em massa com agendamento: `useMessages.sendBulkMessages` insere registros em `scheduled_messages` quando `scheduledAt` é fornecido.
- Listagem: `useMessages.getScheduledMessages` lê os registros do usuário atual.
- Cancelamento: `useMessages.cancelScheduledMessage` remove um registro específico do usuário.

## Alternativa: remover funcionalidades
Se você não desejar suportar agendamento agora, duas alternativas:
- Ocultar/Desativar opções de agendamento nas telas que usam `scheduledAt` (CreateCampaign, Scheduling) e ajustar o hook `useMessages` para ignorar o branch que insere em `scheduled_messages`.
- Manter o código e não criar a tabela: a listagem retornará array vazio com log no console; porém o envio agendado falhará com erro.

Recomendação: criar a tabela `scheduled_messages` para manter a funcionalidade consistente e evitar erros ao agendar.
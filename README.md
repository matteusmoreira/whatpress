# Sistema SaaS WhatsApp

Frontend em React + Vite integrado ao Supabase e Evolution API para gerenciar instâncias do WhatsApp (criar, conectar, verificar status, QR Code, mensagens). Inclui um servidor de webhook (Express) para receber eventos da Evolution API e atualizar o Supabase.

## Stack
- React + Vite + TypeScript
- Supabase (Auth, DB)
- Evolution API
- Express (webhook-server.js)
- Tailwind + Radix UI

## Pré-requisitos
- Node.js 18+ e npm
- Conta no Supabase com banco e chaves
- Evolution API (URL e API Key)

## Variáveis de ambiente
Use `.env` localmente (NÃO COMITAR). Exemplo de variáveis:

Frontend (build Vite):
- `VITE_EVOLUTION_API_URL`
- `VITE_EVOLUTION_API_KEY`
- `VITE_WEBHOOK_URL` (URL pública do endpoint de webhook)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Servidor (não expostas no cliente):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE`
- `WEBHOOK_SECRET` (opcional para validar assinaturas)

> Importante: `.env` está ignorado pelo `.gitignore`. Jamais comitar `SUPABASE_SERVICE_ROLE`.

## Desenvolvimento local
1. Instalar deps: `npm install`
2. Rodar frontend: `npm run dev` (Vite)
3. Rodar webhook: `npm run webhook` (Express em `http://localhost:3001`)
4. Healthcheck webhook: `GET http://localhost:3001/health`

## Webhook
O arquivo `webhook-server.js`:
- Recebe eventos: `connection.update`, `qr.updated`, `instance.status`.
- Atualiza tabela `whatsapp_instances` no Supabase (status, last_activity, qr_code, phone_number).
- Endpoints úteis:
  - `POST /webhook`
  - `GET /health`
  - `POST /simulate/connection` (simulação)

Em ambiente de produção, o webhook precisa de uma URL pública. Em Vercel, o ideal é migrar para uma Function em `api/webhook`.

## Deploy na Vercel (Plano)
1. GitHub: enviar este projeto para um repositório.
2. Importar no Vercel (New Project).
3. Configurar **Environment Variables** no Vercel:
   - Em `Production` e `Preview`:
     - `VITE_EVOLUTION_API_URL`
     - `VITE_EVOLUTION_API_KEY`
     - `VITE_WEBHOOK_URL` (apontar para `https://<seu-domínio>/api/webhook` quando migrarmos)
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
   - Somente Serverless Functions (não expor ao cliente):
     - `SUPABASE_URL`
     - `SUPABASE_SERVICE_ROLE`
     - `WEBHOOK_SECRET`
4. Build & Deploy. O frontend ficará público.
5. Migrar `webhook-server.js` para uma Function `api/webhook` (próxima tarefa) para receber os eventos diretamente no domínio público do Vercel.

## Scripts
- `npm run dev` — frontend
- `npm run webhook` — servidor de webhook local

## Segurança
- `.env` está ignorado; mantenha as chaves em variáveis de ambiente.
- Nunca expor `SUPABASE_SERVICE_ROLE` no código cliente.

## Licença
Defina a licença conforme sua preferência.
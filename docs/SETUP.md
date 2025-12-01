# Guia de Configuração - WhatPress

## 🚀 Configuração Inicial

### 1. Criar arquivo `.env`

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```bash
# FRONTEND (Vite)
VITE_SUPABASE_URL=https://qafghfpmjvrfltpprssb.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhZmdoZnBtanZyZmx0cHByc3NiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NTg4ODgsImV4cCI6MjA3NTUzNDg4OH0.NUtD9_LM9ekDwFFCnSajECGvKGnYSueh3dO7ZfuXVqs
VITE_EVOLUTION_API_URL=https://api.whatpress.pro/
VITE_EVOLUTION_API_KEY=c5176bf19a9b2e240204522e45236822
VITE_EVOLUTION_INSTANCE_NAME=default-instance
VITE_WEBHOOK_URL=http://localhost:3001/webhook

# BACKEND (Serverless)
SUPABASE_URL=https://qafghfpmjvrfltpprssb.supabase.co
SUPABASE_SERVICE_ROLE=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhZmdoZnBtanZyZmx0cHByc3NiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk1ODg4OCwiZXhwIjoyMDc1NTM0ODg4fQ.JftUE5xGvK3dxQ6gw-axy5p5iFc-FoNI5tnN4pSdcF8
WEBHOOK_SECRET=whatpress-webhook-secret-2024

# SEGURANÇA (Opcional)
VITE_ENCRYPTION_ENABLED=true
VITE_MASTER_ENCRYPTION_KEY=whatpress-master-key-change-in-production-32chars
```

### 2. Instalar dependências

```bash
npm install
```

### 3. Rodar localmente

```bash
# Frontend + Webhook server
npm run dev:full

# Ou separadamente:
npm run dev      # Frontend (porta 8000)
npm run webhook  # Webhook server (porta 3001)
```

### 4. Acessar aplicação

- Frontend: http://localhost:8000
- Webhook: http://localhost:3001/health

## 📋 Próximos Passos

1. ✅ Configurar `.env`
2. ✅ Rodar aplicação localmente
3. 🔄 Implementar Templates (em andamento)
4. ⏳ Configurar pagamentos
5. ⏳ Deploy no Vercel

## 🔐 Segurança

- **NUNCA** comite o arquivo `.env` no Git
- O `.gitignore` já está configurado para bloquear `.env`
- Para produção, configure as variáveis no Vercel Dashboard

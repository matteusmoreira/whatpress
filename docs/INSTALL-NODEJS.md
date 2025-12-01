# Instalação do Node.js - WhatPress

## ❌ Problema Detectado

Node.js não está instalado no seu sistema. O WhatPress requer Node.js 18+ para funcionar.

---

## 📥 Como Instalar Node.js

### Opção 1: Instalador Oficial (Recomendado)

1. **Baixar Node.js**
   - Acesse: https://nodejs.org/
   - Baixe a versão **LTS** (Long Term Support)
   - Versão recomendada: **Node.js 20.x LTS**

2. **Executar o instalador**
   - Execute o arquivo `.msi` baixado
   - Clique em "Next" em todas as etapas
   - **IMPORTANTE**: Marque a opção "Automatically install the necessary tools"
   - Aguarde a instalação completar

3. **Verificar instalação**
   - Abra um **novo** PowerShell (feche o atual)
   - Execute:
   ```powershell
   node --version
   npm --version
   ```
   - Deve mostrar as versões instaladas (ex: v20.11.0 e 10.2.4)

### Opção 2: Winget (Windows 11)

```powershell
# Instalar Node.js via winget
winget install OpenJS.NodeJS.LTS

# Verificar instalação
node --version
npm --version
```

### Opção 3: Chocolatey

```powershell
# Instalar Chocolatey (se não tiver)
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Instalar Node.js
choco install nodejs-lts -y

# Verificar instalação
node --version
npm --version
```

---

## 🚀 Após Instalar Node.js

### 1. Fechar e reabrir o PowerShell

**IMPORTANTE**: Você DEVE fechar o PowerShell atual e abrir um novo para que as variáveis de ambiente sejam atualizadas.

### 2. Navegar até o projeto

```powershell
cd C:\Users\Maria\Desktop\whatpress\whatpress
```

### 3. Instalar dependências

```powershell
npm install
```

Este comando pode levar 2-5 minutos. Aguarde até completar.

### 4. Criar arquivo .env

Crie um arquivo chamado `.env` na raiz do projeto com o seguinte conteúdo:

```bash
# Frontend
VITE_SUPABASE_URL=https://qafghfpmjvrfltpprssb.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhZmdoZnBtanZyZmx0cHByc3NiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NTg4ODgsImV4cCI6MjA3NTUzNDg4OH0.NUtD9_LM9ekDwFFCnSajECGvKGnYSueh3dO7ZfuXVqs
VITE_EVOLUTION_API_URL=https://api.whatpress.pro/
VITE_EVOLUTION_API_KEY=c5176bf19a9b2e240204522e45236822
VITE_EVOLUTION_INSTANCE_NAME=default-instance
VITE_WEBHOOK_URL=http://localhost:3001/webhook

# Backend
SUPABASE_URL=https://qafghfpmjvrfltpprssb.supabase.co
SUPABASE_SERVICE_ROLE=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhZmdoZnBtanZyZmx0cHByc3NiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk1ODg4OCwiZXhwIjoyMDc1NTM0ODg4fQ.JftUE5xGvK3dxQ6gw-axy5p5iFc-FoNI5tnN4pSdcF8
WEBHOOK_SECRET=whatpress-webhook-secret-2024

# Segurança
VITE_ENCRYPTION_ENABLED=true
VITE_MASTER_ENCRYPTION_KEY=whatpress-master-key-change-in-production-32chars
```

**Como criar o arquivo .env:**

```powershell
# No PowerShell, dentro da pasta do projeto:
notepad .env
# Cole o conteúdo acima e salve
```

### 5. Iniciar o sistema

```powershell
# Opção 1: Frontend + Webhook juntos
npm run dev:full

# Opção 2: Apenas frontend
npm run dev

# Opção 3: Apenas webhook (em outro terminal)
npm run webhook
```

### 6. Acessar a aplicação

- **Frontend**: http://localhost:8000
- **Webhook Health**: http://localhost:3001/health

---

## 🔧 Troubleshooting

### Erro: "npm não é reconhecido"

**Solução**: Feche e reabra o PowerShell após instalar Node.js

### Erro: "Cannot find module"

**Solução**: Execute `npm install` novamente

### Erro: "Port 8000 already in use"

**Solução**: 
```powershell
# Matar processo na porta 8000
netstat -ano | findstr :8000
# Anote o PID e execute:
taskkill /PID <PID> /F
```

### Erro ao criar .env

**Solução**: Use o Notepad ou VS Code:
```powershell
code .env  # Se tiver VS Code
# ou
notepad .env
```

---

## 📋 Checklist de Instalação

- [ ] Baixar Node.js LTS de https://nodejs.org/
- [ ] Executar instalador
- [ ] Fechar e reabrir PowerShell
- [ ] Verificar `node --version` e `npm --version`
- [ ] Navegar até pasta do projeto
- [ ] Executar `npm install`
- [ ] Criar arquivo `.env`
- [ ] Executar `npm run dev:full`
- [ ] Acessar http://localhost:8000

---

## ⏭️ Próximos Passos

Após instalar Node.js e seguir os passos acima, me avise que vou:

1. ✅ Verificar se tudo está funcionando
2. ✅ Abrir o navegador automaticamente
3. ✅ Testar as funcionalidades principais
4. ✅ Validar o sistema de Templates

---

## 💡 Dica

Para facilitar, você pode usar o **Windows Terminal** que permite múltiplas abas:
- Aba 1: Frontend (`npm run dev`)
- Aba 2: Webhook (`npm run webhook`)

Baixe em: https://aka.ms/terminal

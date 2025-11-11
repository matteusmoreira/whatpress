# Segurança e LGPD - WhatPress

## Visão Geral

O WhatPress implementa medidas robustas de segurança e conformidade com a Lei Geral de Proteção de Dados (LGPD) do Brasil, garantindo que os dados dos usuários estejam sempre protegidos e em conformidade com as regulamentações vigentes.

## 🔐 Funcionalidades de Segurança

### 1. Criptografia de Dados
- **Criptografia AES-256-GCM** para dados sensíveis em repouso
- **Criptografia em trânsito** via HTTPS/TLS 1.3
- **Gerenciamento de chaves** com rotação automática
- **Derivação de chaves PBKDF2** com salt único

### 2. Auditoria e Logs
- **Logs de auditoria detalhados** para todas as operações críticas
- **Categorização de eventos** por tipo e severidade
- **Retenção configurável** de logs (padrão: 90 dias)
- **Exportação de logs** para análise e conformidade

### 3. Controle de Acesso
- **Autenticação baseada em JWT** com tokens de curta duração
- **Autorização por roles** (usuário, administrador, superadmin)
- **Controle de permissões granulares** por recurso
- **Sessões seguras** com invalidação automática

### 4. Proteção contra Ameaças
- **Rate limiting** para prevenir abuso de API
- **Validação de entrada** para prevenir injeção de código
- **Sanitização de dados** para prevenir XSS
- **CORS configurável** para segurança de origem

## 📋 Conformidade LGPD

### Direitos do Titular
O sistema garante os seguintes direitos aos titulares de dados:

1. **Acesso aos dados pessoais**
   - Interface de exportação de dados pessoais
   - Formato JSON estruturado e legível
   - Inclui todos os dados fornecidos pelo usuário

2. **Correção de dados**
   - Interface de edição de perfil
   - Validação de dados em tempo real
   - Histórico de alterações

3. **Portabilidade dos dados**
   - Exportação em formato estruturado
   - Dados prontos para migração
   - Inclui metadados e timestamps

4. **Exclusão dos dados**
   - Solicitação de exclusão via interface
   - Processamento em até 30 dias
   - Confirmação por email

5. **Revogação do consentimento**
   - Opção de revogar consentimento a qualquer momento
   - Efeitos imediatos sobre novos processamentos
   - Manutenção de dados necessários por obrigação legal

### Consentimento
- **Consentimento explícito** para coleta de dados sensíveis
- **Registro de consentimento** com timestamp e IP
- **Revogação fácil** a qualquer momento
- **Consentimento por finalidade** específica

### Medidas de Segurança
- **Criptografia** de dados pessoais sensíveis
- **Pseudonimização** quando possível
- **Anonimização** para análises e relatórios
- **Backup regular** com criptografia
- **Monitoramento contínuo** de acessos

## 🛠️ Configuração

### Variáveis de Ambiente

```bash
# Criptografia
VITE_ENCRYPTION_ENABLED=true
VITE_MASTER_ENCRYPTION_KEY=sua_chave_mestra_de_32_caracteres_minimo

# Auditoria
VITE_AUDIT_LOG_RETENTION_DAYS=90

# Rate Limiting
VITE_RATE_LIMIT_REQUESTS_PER_MINUTE=60
VITE_RATE_LIMIT_REQUESTS_PER_HOUR=1000

# Backup
VITE_BACKUP_ENABLED=true
VITE_BACKUP_INTERVAL_HOURS=24
```

### Gerando a Chave Mestra

```bash
# Linux/MacOS
openssl rand -base64 32

# Windows (PowerShell)
[System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((New-Guid).ToString() + (New-Guid).ToString()))
```

## 📊 Monitoramento

### Dashboard de Segurança
Acesse `/dashboard/security` para:
- Visualizar status da criptografia
- Rotacionar chaves de criptografia
- Exportar dados pessoais
- Solicitar exclusão de dados
- Visualizar logs de auditoria

### Métricas de Segurança
- Número de eventos de segurança por categoria
- Taxa de sucesso/falha de autenticação
- Tentativas de acesso não autorizado
- Rotação de chaves de criptografia

## 🚨 Incidentes e Resposta

### Em caso de incidente de segurança:
1. **Notificação imediata** à equipe de segurança
2. **Isolamento** do sistema afetado
3. **Investigação** e documentação detalhada
4. **Notificação** à autoridade competente (em até 72 horas)
5. **Comunicação** aos titulares afetados
6. **Medidas corretivas** e prevenção de recorrência

### Contato
- **Email de segurança**: seguranca@whatpress.com.br
- **Telefone**: +55 11 99999-9999
- **SLA de resposta**: 4 horas úteis

## 📚 Documentação Adicional

- [Política de Privacidade](./PRIVACY.md)
- [Termos de Serviço](./TERMS.md)
- [Política de Cookies](./COOKIES.md)
- [Guia de Configuração](./docs/security-setup.md)

## 🔒 Boas Práticas

### Para Desenvolvedores
1. Sempre usar **prepared statements** para queries SQL
2. Validar e sanitizar **todas as entradas** do usuário
3. Implementar **princípio do menor privilégio**
4. Usar **HTTPS** para todas as comunicações
5. Manter **logs de auditoria** para operações críticas
6. Implementar **rate limiting** em APIs públicas
7. Usar **tokens CSRF** em formulários
8. Configurar **headers de segurança** apropriados

### Para Administradores
1. Realizar **backups regulares** e testar restauração
2. Manter **sistema atualizado** com últimos patches
3. Monitorar **logs de segurança** diariamente
4. Implementar **autenticação de múltiplos fatores**
5. Realizar **auditorias periódicas** de segurança
6. Treinar equipe sobre **phishing e segurança**
7. Ter **plano de resposta a incidentes** testado
8. Manter **inventário de ativos** atualizado

## 📞 Suporte

Para dúvidas sobre segurança e conformidade:
- **Documentação**: [docs.whatpress.com.br/security](https://docs.whatpress.com.br/security)
- **Suporte**: suporte@whatpress.com.br
- **Reportar vulnerabilidade**: security@whatpress.com.br

---

**Última atualização**: Dezembro 2024
**Versão**: 1.0.0
**Classificação**: Público
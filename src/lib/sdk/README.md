# WhatsPress JavaScript/TypeScript SDK

O SDK oficial para integração com a API WhatsPress. Facilita a integração com pagamentos, webhooks e gestão de API Keys.

## Instalação

```bash
npm install @whatpress/sdk
# ou
yarn add @whatpress/sdk
# ou
pnpm add @whatpress/sdk
```

## Uso Básico

```typescript
import { WhatsPressClient } from '@whatpress/sdk';

const client = new WhatsPressClient({
  apiKey: 'sua-api-key-aqui',
  baseURL: 'https://api.whatpress.com', // opcional
});

// Criar um pagamento
const payment = await client.createPayment({
  amount: 100.00,
  currency: 'BRL',
  provider: 'stripe',
  customer: {
    name: 'João Silva',
    email: 'joao@example.com',
    phone: '+5511999999999',
  },
  metadata: {
    orderId: '12345',
    description: 'Assinatura mensal',
  },
});

console.log('Pagamento criado:', payment.id);
```

## Exemplos de Uso

### Pagamentos

```typescript
// Listar pagamentos
const payments = await client.listPayments({
  status: 'succeeded',
  limit: 10,
});

// Obter pagamento específico
const payment = await client.getPayment('pay_123');

// Confirmar pagamento
const confirmed = await client.confirmPayment('pay_123');

// Cancelar pagamento
const cancelled = await client.cancelPayment('pay_123');

// Reembolsar pagamento
const refunded = await client.refundPayment('pay_123', 50.00);
```

### Gestão de API Keys

```typescript
// Criar nova API Key
const apiKey = await client.createAPIKey({
  name: 'Minha Aplicação',
  permissions: {
    payments: ['create', 'read'],
    customers: ['read'],
  },
  usageLimits: {
    daily: 1000,
    monthly: 10000,
  },
});

// Listar API Keys
const apiKeys = await client.listAPIKeys({
  status: 'active',
});

// Atualizar permissões
const updated = await client.updateAPIKey('key_123', {
  permissions: {
    payments: ['create', 'read', 'update'],
    webhooks: ['read'],
  },
});

// Suspender API Key
const suspended = await client.suspendAPIKey('key_123');

// Ativar API Key
const activated = await client.activateAPIKey('key_123');

// Revogar API Key
await client.deleteAPIKey('key_123');
```

### Webhooks

```typescript
// Listar entregas de webhooks
const deliveries = await client.listWebhookDeliveries({
  status: 'failed',
  limit: 20,
});

// Reprocessar falhas
await client.retryFailedWebhookDeliveries();
```

### Operações em Lote

```typescript
// Criar múltiplos pagamentos
const payments = await client.createPayments([
  { amount: 100, currency: 'BRL', provider: 'stripe', customer: {...} },
  { amount: 200, currency: 'BRL', provider: 'asaas', customer: {...} },
]);

// Obter múltiplos pagamentos
const paymentIds = ['pay_123', 'pay_456', 'pay_789'];
const payments = await client.getPayments(paymentIds);

// Confirmar múltiplos pagamentos
const confirmed = await client.confirmPayments(['pay_123', 'pay_456']);
```

## Configuração Avançada

```typescript
const client = new WhatsPressClient({
  apiKey: 'sua-api-key-aqui',
  baseURL: 'https://api.whatpress.com',
  timeout: 30000, // 30 segundos
  retries: 3, // número de tentativas
  retryDelay: 1000, // delay entre tentativas (ms)
});

// Modificar configurações após criação
client.setApiKey('nova-api-key');
client.setBaseURL('https://api.staging.whatpress.com');
client.setTimeout(45000);
client.setRetryConfig(5, 2000);
```

## Tratamento de Erros

```typescript
try {
  const payment = await client.createPayment({
    amount: 100,
    currency: 'BRL',
    provider: 'stripe',
    customer: { name: 'João', email: 'joao@example.com' },
  });
} catch (error) {
  if (error instanceof WhatsPressError) {
    console.error('Erro WhatsPress:', error.message);
    console.error('Código:', error.code);
    console.error('Status HTTP:', error.statusCode);
    console.error('Detalhes:', error.details);
  } else {
    console.error('Erro desconhecido:', error);
  }
}
```

## Health Check

```typescript
// Verificar status da API
const health = await client.healthCheck();
console.log('Status:', health.status);
console.log('Timestamp:', health.timestamp);
console.log('Versão:', health.version);
```

## Tipos TypeScript

O SDK inclui tipos TypeScript completos para todas as operações:

```typescript
import type {
  Payment,
  PaymentCreateRequest,
  APIKey,
  APIKeyPermissions,
  WebhookEvent,
  WhatsPressError,
} from '@whatpress/sdk';
```

## Suporte

Para reportar bugs ou solicitar recursos, acesse: https://github.com/whatpress/sdk-javascript

## Licença

MIT License - veja o arquivo LICENSE para detalhes.
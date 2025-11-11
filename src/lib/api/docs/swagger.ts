import { Router, Request, Response } from 'express';

export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'WhatsPress API',
    version: '1.0.0',
    description: 'API completa para gestão de mensagens WhatsApp Business com múltiplos gateways de pagamento',
    contact: {
      name: 'WhatsPress Support',
      email: 'support@whatpress.com',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: 'https://api.whatpress.com',
      description: 'Production server',
    },
    {
      url: 'http://localhost:3000',
      description: 'Development server',
    },
  ],
  components: {
    securitySchemes: {
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API Key para autenticação',
      },
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token para autenticação',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            description: 'Mensagem de erro',
          },
          code: {
            type: 'string',
            description: 'Código do erro',
          },
          details: {
            type: 'object',
            description: 'Detalhes adicionais do erro',
          },
        },
      },
      Payment: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'ID único do pagamento',
          },
          amount: {
            type: 'number',
            description: 'Valor do pagamento',
          },
          currency: {
            type: 'string',
            description: 'Moeda do pagamento (BRL, USD, EUR)',
          },
          status: {
            type: 'string',
            enum: ['pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded'],
            description: 'Status do pagamento',
          },
          provider: {
            type: 'string',
            enum: ['stripe', 'asaas', 'mercadopago'],
            description: 'Provedor de pagamento',
          },
          paymentMethod: {
            type: 'string',
            enum: ['credit_card', 'debit_card', 'pix', 'boleto', 'bank_transfer'],
            description: 'Método de pagamento',
          },
          customer: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              email: { type: 'string' },
              name: { type: 'string' },
              phone: { type: 'string' },
              document: { type: 'string' },
            },
          },
          metadata: {
            type: 'object',
            description: 'Metadados adicionais do pagamento',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Data de criação',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Data de atualização',
          },
        },
      },
      PaymentCreate: {
        type: 'object',
        required: ['amount', 'currency', 'paymentMethod', 'customer'],
        properties: {
          amount: {
            type: 'number',
            minimum: 0.01,
            description: 'Valor do pagamento',
          },
          currency: {
            type: 'string',
            enum: ['BRL', 'USD', 'EUR'],
            description: 'Moeda do pagamento',
          },
          paymentMethod: {
            type: 'string',
            enum: ['credit_card', 'debit_card', 'pix', 'boleto', 'bank_transfer'],
            description: 'Método de pagamento',
          },
          provider: {
            type: 'string',
            enum: ['stripe', 'asaas', 'mercadopago'],
            description: 'Provedor de pagamento (opcional - sistema escolhe automaticamente)',
          },
          customer: {
            type: 'object',
            required: ['email', 'name'],
            properties: {
              email: { type: 'string', format: 'email' },
              name: { type: 'string' },
              phone: { type: 'string' },
              document: { type: 'string' },
            },
          },
          metadata: {
            type: 'object',
            description: 'Metadados adicionais',
          },
        },
      },
      WebhookEvent: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'ID único do evento',
          },
          type: {
            type: 'string',
            description: 'Tipo do evento',
          },
          provider: {
            type: 'string',
            enum: ['stripe', 'asaas', 'mercadopago'],
            description: 'Provedor que originou o evento',
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp do evento',
          },
          data: {
            type: 'object',
            description: 'Dados do evento',
          },
        },
      },
      APIKey: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'ID único da API Key',
          },
          name: {
            type: 'string',
            description: 'Nome descritivo da API Key',
          },
          key: {
            type: 'string',
            description: 'Chave da API (apenas visível na criação)',
          },
          permissions: {
            type: 'object',
            properties: {
              payments: {
                type: 'object',
                properties: {
                  read: { type: 'boolean' },
                  write: { type: 'boolean' },
                  create: { type: 'boolean' },
                  update: { type: 'boolean' },
                  delete: { type: 'boolean' },
                },
              },
              customers: {
                type: 'object',
                properties: {
                  read: { type: 'boolean' },
                  write: { type: 'boolean' },
                },
              },
              webhooks: {
                type: 'object',
                properties: {
                  read: { type: 'boolean' },
                  write: { type: 'boolean' },
                },
              },
              analytics: {
                type: 'object',
                properties: {
                  read: { type: 'boolean' },
                },
              },
              admin: {
                type: 'object',
                properties: {
                  read: { type: 'boolean' },
                  write: { type: 'boolean' },
                },
              },
            },
          },
          usageLimits: {
            type: 'object',
            properties: {
              requestsPerMinute: { type: 'number' },
              requestsPerHour: { type: 'number' },
              requestsPerDay: { type: 'number' },
            },
          },
          status: {
            type: 'string',
            enum: ['active', 'suspended', 'revoked'],
            description: 'Status da API Key',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Data de criação',
          },
          lastUsedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Último uso',
          },
        },
      },
      Health: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['healthy', 'degraded', 'unhealthy'],
            description: 'Status geral do sistema',
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp da verificação',
          },
          services: {
            type: 'object',
            properties: {
              database: {
                type: 'object',
                properties: {
                  status: { type: 'string' },
                  latency: { type: 'number' },
                },
              },
              redis: {
                type: 'object',
                properties: {
                  status: { type: 'string' },
                  latency: { type: 'number' },
                },
              },
              paymentProviders: {
                type: 'object',
                properties: {
                  stripe: { type: 'string' },
                  asaas: { type: 'string' },
                  mercadopago: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'Verificar saúde do sistema',
        description: 'Retorna o status de saúde de todos os serviços',
        tags: ['Health'],
        responses: {
          '200': {
            description: 'Sistema está saudável',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Health',
                },
              },
            },
          },
          '503': {
            description: 'Sistema está com problemas',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/payments': {
      post: {
        summary: 'Criar novo pagamento',
        description: 'Cria um novo pagamento com o provedor e método especificados',
        tags: ['Payments'],
        security: [{ apiKey: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PaymentCreate',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Pagamento criado com sucesso',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Payment',
                },
              },
            },
          },
          '400': {
            description: 'Dados inválidos',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Não autorizado',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '429': {
            description: 'Rate limit excedido',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
      get: {
        summary: 'Listar pagamentos',
        description: 'Retorna uma lista de pagamentos com filtros opcionais',
        tags: ['Payments'],
        security: [{ apiKey: [] }],
        parameters: [
          {
            name: 'status',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded'],
            },
            description: 'Filtrar por status',
          },
          {
            name: 'provider',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['stripe', 'asaas', 'mercadopago'],
            },
            description: 'Filtrar por provedor',
          },
          {
            name: 'limit',
            in: 'query',
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20,
            },
            description: 'Número de resultados por página',
          },
          {
            name: 'offset',
            in: 'query',
            schema: {
              type: 'integer',
              minimum: 0,
              default: 0,
            },
            description: 'Número de resultados para pular',
          },
        ],
        responses: {
          '200': {
            description: 'Lista de pagamentos',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    payments: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/Payment',
                      },
                    },
                    total: {
                      type: 'integer',
                      description: 'Total de pagamentos',
                    },
                    limit: {
                      type: 'integer',
                      description: 'Limite por página',
                    },
                    offset: {
                      type: 'integer',
                      description: 'Offset atual',
                    },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Não autorizado',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/payments/{id}': {
      get: {
        summary: 'Obter pagamento por ID',
        description: 'Retorna os detalhes de um pagamento específico',
        tags: ['Payments'],
        security: [{ apiKey: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'ID do pagamento',
          },
        ],
        responses: {
          '200': {
            description: 'Pagamento encontrado',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Payment',
                },
              },
            },
          },
          '404': {
            description: 'Pagamento não encontrado',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Não autorizado',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/payments/{id}/confirm': {
      post: {
        summary: 'Confirmar pagamento',
        description: 'Confirma um pagamento pendente',
        tags: ['Payments'],
        security: [{ apiKey: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'ID do pagamento',
          },
        ],
        responses: {
          '200': {
            description: 'Pagamento confirmado',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Payment',
                },
              },
            },
          },
          '404': {
            description: 'Pagamento não encontrado',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '400': {
            description: 'Pagamento não pode ser confirmado',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/payments/{id}/cancel': {
      post: {
        summary: 'Cancelar pagamento',
        description: 'Cancela um pagamento pendente ou em processamento',
        tags: ['Payments'],
        security: [{ apiKey: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'ID do pagamento',
          },
        ],
        responses: {
          '200': {
            description: 'Pagamento cancelado',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Payment',
                },
              },
            },
          },
          '404': {
            description: 'Pagamento não encontrado',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '400': {
            description: 'Pagamento não pode ser cancelado',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/payments/{id}/refund': {
      post: {
        summary: 'Reembolsar pagamento',
        description: 'Reembolsa um pagamento bem-sucedido',
        tags: ['Payments'],
        security: [{ apiKey: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'ID do pagamento',
          },
          {
            name: 'amount',
            in: 'query',
            schema: {
              type: 'number',
              minimum: 0.01,
            },
            description: 'Valor do reembolso (padrão: valor total)',
          },
        ],
        responses: {
          '200': {
            description: 'Pagamento reembolsado',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Payment',
                },
              },
            },
          },
          '404': {
            description: 'Pagamento não encontrado',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '400': {
            description: 'Pagamento não pode ser reembolsado',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/webhooks/stripe': {
      post: {
        summary: 'Webhook Stripe',
        description: 'Endpoint para receber webhooks do Stripe',
        tags: ['Webhooks'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                description: 'Payload do webhook Stripe',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Webhook processado com sucesso',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Payload inválido',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Assinatura inválida',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/webhooks/asaas': {
      post: {
        summary: 'Webhook Asaas',
        description: 'Endpoint para receber webhooks do Asaas',
        tags: ['Webhooks'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                description: 'Payload do webhook Asaas',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Webhook processado com sucesso',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Payload inválido',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/webhooks/mercadopago': {
      post: {
        summary: 'Webhook Mercado Pago',
        description: 'Endpoint para receber webhooks do Mercado Pago',
        tags: ['Webhooks'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                description: 'Payload do webhook Mercado Pago',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Webhook processado com sucesso',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Payload inválido',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/api-keys': {
      post: {
        summary: 'Criar nova API Key',
        description: 'Cria uma nova API Key com permissões específicas',
        tags: ['API Keys'],
        security: [{ apiKey: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'permissions'],
                properties: {
                  name: {
                    type: 'string',
                    description: 'Nome descritivo da API Key',
                  },
                  permissions: {
                    type: 'object',
                    description: 'Permissões da API Key',
                  },
                  usageLimits: {
                    type: 'object',
                    properties: {
                      requestsPerMinute: { type: 'number' },
                      requestsPerHour: { type: 'number' },
                      requestsPerDay: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'API Key criada com sucesso',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/APIKey',
                },
              },
            },
          },
          '400': {
            description: 'Dados inválidos',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Não autorizado',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
      get: {
        summary: 'Listar API Keys',
        description: 'Retorna uma lista de API Keys',
        tags: ['API Keys'],
        security: [{ apiKey: [] }],
        parameters: [
          {
            name: 'status',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['active', 'suspended', 'revoked'],
            },
            description: 'Filtrar por status',
          },
          {
            name: 'limit',
            in: 'query',
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20,
            },
            description: 'Número de resultados por página',
          },
        ],
        responses: {
          '200': {
            description: 'Lista de API Keys',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    apiKeys: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/APIKey',
                      },
                    },
                    total: {
                      type: 'integer',
                      description: 'Total de API Keys',
                    },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Não autorizado',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/api-keys/{id}': {
      get: {
        summary: 'Obter API Key por ID',
        description: 'Retorna os detalhes de uma API Key específica',
        tags: ['API Keys'],
        security: [{ apiKey: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'ID da API Key',
          },
        ],
        responses: {
          '200': {
            description: 'API Key encontrada',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/APIKey',
                },
              },
            },
          },
          '404': {
            description: 'API Key não encontrada',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Não autorizado',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
      put: {
        summary: 'Atualizar API Key',
        description: 'Atualiza as permissões ou limites de uma API Key',
        tags: ['API Keys'],
        security: [{ apiKey: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'ID da API Key',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: {
                    type: 'string',
                    description: 'Novo nome da API Key',
                  },
                  permissions: {
                    type: 'object',
                    description: 'Novas permissões',
                  },
                  usageLimits: {
                    type: 'object',
                    properties: {
                      requestsPerMinute: { type: 'number' },
                      requestsPerHour: { type: 'number' },
                      requestsPerDay: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'API Key atualizada',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/APIKey',
                },
              },
            },
          },
          '404': {
            description: 'API Key não encontrada',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Não autorizado',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
      delete: {
        summary: 'Revogar API Key',
        description: 'Revoga permanentemente uma API Key',
        tags: ['API Keys'],
        security: [{ apiKey: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'ID da API Key',
          },
        ],
        responses: {
          '200': {
            description: 'API Key revogada',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
          '404': {
            description: 'API Key não encontrada',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Não autorizado',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/api-keys/{id}/suspend': {
      post: {
        summary: 'Suspender API Key',
        description: 'Suspende temporariamente uma API Key',
        tags: ['API Keys'],
        security: [{ apiKey: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'ID da API Key',
          },
        ],
        responses: {
          '200': {
            description: 'API Key suspensa',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/APIKey',
                },
              },
            },
          },
          '404': {
            description: 'API Key não encontrada',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Não autorizado',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/api-keys/{id}/activate': {
      post: {
        summary: 'Ativar API Key',
        description: 'Ativa uma API Key suspensa',
        tags: ['API Keys'],
        security: [{ apiKey: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'ID da API Key',
          },
        ],
        responses: {
          '200': {
            description: 'API Key ativada',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/APIKey',
                },
              },
            },
          },
          '404': {
            description: 'API Key não encontrada',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Não autorizado',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
  },
  tags: [
    {
      name: 'Health',
      description: 'Endpoints de saúde do sistema',
    },
    {
      name: 'Payments',
      description: 'Gestão de pagamentos',
    },
    {
      name: 'Webhooks',
      description: 'Endpoints para webhooks de provedores de pagamento',
    },
    {
      name: 'API Keys',
      description: 'Gestão de chaves de API',
    },
  ],
};

export function setupSwaggerDocs(router: Router): void {
  // Serve Swagger UI
  router.get('/docs/swagger.json', (req: Request, res: Response) => {
    res.json(swaggerDocument);
  });

  // Simple HTML interface for Swagger
  router.get('/docs', (req: Request, res: Response) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>WhatsPress API Documentation</title>
        <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui.css" />
        <style>
          html {
            box-sizing: border-box;
            overflow: -moz-scrollbars-vertical;
            overflow-y: scroll;
          }
          *, *:before, *:after {
            box-sizing: inherit;
          }
          body {
            margin: 0;
            background: #fafafa;
          }
        </style>
      </head>
      <body>
        <div id="swagger-ui"></div>
        <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-bundle.js"></script>
        <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-standalone-preset.js"></script>
        <script>
          window.onload = function() {
            const ui = SwaggerUIBundle({
              url: "/api/v1/docs/swagger.json",
              dom_id: '#swagger-ui',
              deepLinking: true,
              presets: [
                SwaggerUIBundle.presets.apis,
                SwaggerUIStandalonePreset
              ],
              plugins: [
                SwaggerUIBundle.plugins.DownloadUrl
              ],
              layout: "StandaloneLayout"
            });
            window.ui = ui;
          };
        </script>
      </body>
      </html>
    `);
  });
}
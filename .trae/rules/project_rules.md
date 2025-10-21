# Project Rules - Sistema Guiado Sem Alucinações

## Sempre responda em português!

## 🎯 Objetivo
Entregar features pequenas, estáveis e funcionais para usuário não programador, seguindo fluxo verificável e sem dispersão.

## 📐 Fluxo Obrigatório (toda tarefa segue esta ordem)
1. **Planejar** (5 itens): feature, estrutura de pastas, tipos necessários, dependências, critérios de aceite (2-3 cenários: sucesso/erro)
2. **Implementar** (código mínimo): somente o essencial da feature, componente funcional, máx. 200 linhas, TypeScript estrito, try/catch onde há I/O
3. **Revisar** (issues com gravidade): checar segurança, tipagem, erros, re-render e padrões; marcar por gravidade (Crítico/Alto/Médio/Baixo) e sugerir correção objetiva
4. **Testar** (1 fluxo crítico): teste E2E com nome claro, data-testid, cobrindo sucesso e 1 erro relevante
5. **Checklist final** (máx. 3 linhas): confirmar tipagem, erros tratados, componente <200 linhas, padrões ok

## ⚙️ Escopo e Disciplina
- Nunca expanda escopo sem pedir nova tarefa; nada de "grandes reescritas" ou "engenharia excessiva"
- Se a tarefa não é clara, peça esclarecimento em 1-2 perguntas diretas antes de começar
- Explique decisões em 1-2 linhas, sem jargão técnico desnecessário

## 💻 Padrões de Código
### Stack
- React 18 + Vite + TypeScript + Tailwind CSS + Supabase
- Componentes funcionais com hooks; máx. 200 linhas por componente

### Tipagem (zero tolerância para any)
- Props com interfaces próprias; usar generics quando útil
- Discriminar estados com unions: `loading | error | success`
- Type guards para runtime safety quando necessário

### Tratamento de Erros
- Use try/catch em todas as chamadas assíncronas e I/O
- NUNCA usar console.log (utilize sistema de logging quando existir)
- Erros devem ser claros e acionáveis para o usuário

### Estrutura de Pastas
src/
├── components/ # Componentes reutilizáveis (PascalCase)
├── pages/ # Páginas da aplicação (PascalCase)
├── hooks/ # Hooks customizados (camelCase, prefixo use)
├── services/ # Integrações API e lógica de negócio (camelCase)
├── utils/ # Funções utilitárias (camelCase)
└── types/ # Interfaces e tipos TypeScript (PascalCase)

text

## 🎨 Design Simples e Consistente
- NUNCA usar cores "cruas" como `text-white`, `bg-black`, `text-blue-500`
- Sempre usar tokens do sistema de design do projeto (ex: `text-primary`, `bg-background`)
- Se precisar criar novos tokens: usar HSL e garantir contraste para modo claro/escuro
- Sem CSS inline; descrever variantes brevemente e seguir sistema de design

## ⚡ Performance Essencial (só quando necessário)
- React.memo, useCallback, useMemo: usar apenas quando há problema real
- Preferir import dinâmico para telas pesadas
- Imagens: sempre otimizadas e com lazy loading

## 🧪 Testes Mínimos Úteis
- Playwright para 1 fluxo crítico por feature
- Nomes de teste descritivos em português
- Seletores via `data-testid`
- Cobrir 1 cenário de sucesso e 1 de erro

## ✅ Checklist de Saída (preencher em toda entrega)
- [ ] Tipagem completa e sem `any`
- [ ] Erros tratados com try/catch
- [ ] Componente <200 linhas
- [ ] Padrão de pastas e nomenclatura ok
- [ ] Segurança revisada (especialmente auth/pagamento)
- [ ] Performance básica verificada (sem re-renders óbvios)
- [ ] Teste E2E cobrindo sucesso/erro com data-testid

## 🚨 Regras Cardinais
- Não implemente sem planejar
- Não aumente escopo sem autorização
- Nunca use `any` em TypeScript
- Nunca use `console.log`
- Se tocar auth/pagamento: revisão de segurança OBRIGATÓRIA
- Preferir funções pequenas que fazem uma coisa só
# Checklist de Qualidade Lovable

Antes de concluir qualquer implementação, verifique:

## Design System
- [ ] Usei apenas tokens semânticos (nenhum text-white, bg-black)
- [ ] Cores são HSL no index.css
- [ ] Variantes de componentes estão definidas
- [ ] Testei modo claro E escuro

## TypeScript
- [ ] Zero uso de `any`
- [ ] Todas props têm interface
- [ ] Named exports (não default)
- [ ] JSDoc para funções públicas

## React
- [ ] Apenas componentes funcionais
- [ ] Componente tem menos de 200 linhas
- [ ] Tratamento de erros implementado
- [ ] Custom hooks começam com "use"

## Performance
- [ ] Imports otimizados
- [ ] Memoização onde necessário
- [ ] Imagens otimizadas
- [ ] Sem re-renders desnecessários

## Código Limpo
- [ ] Funções fazem UMA coisa
- [ ] Nomes descritivos
- [ ] Sem console.log
- [ ] Comentários explicam PORQUÊ
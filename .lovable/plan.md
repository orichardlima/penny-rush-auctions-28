

## Plano: Sinalizar visualmente que valores de conta Demo são simulados

### Problema
A conta Demo exibe aporte (R$ 9.999), teto (R$ 20.000), progresso e todas as métricas financeiras como se fosse uma conta real. O banner roxo existe (linha 553) mas é discreto e não impede a confusão visual.

### Solução
Aplicar tratamento visual diferenciado em todo o dashboard quando `contract.is_demo === true`:

1. **Cards de estatísticas** (linhas 665-718): Adicionar badge "DEMO" e opacidade reduzida nos valores financeiros
2. **Card de resumo** (linhas 587-662): Adicionar indicador visual "Demonstração" ao lado do plano
3. **Card de progresso** (linhas 722-740): Adicionar nota de que valores são simulados
4. **Tabs de repasses/saques**: Desabilitar ou sinalizar como indisponíveis para demo

### Alterações

| Local | Mudança |
|---|---|
| `PartnerDashboard.tsx` | Extrair `const isDemo = (contract as any)?.is_demo === true` no topo do render |
| Cards financeiros | Envolver valores com estilo `opacity-50` + badge "Demo" quando `isDemo` |
| Banner demo | Tornar mais proeminente (amarelo/warning ao invés de roxo discreto) |
| Tabs de Saques/Repasses | Mostrar alerta de que funcionalidades estão desabilitadas em modo demo |

Nenhuma alteração SQL necessária — apenas tratamento visual no frontend.


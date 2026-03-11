

# Correção do Modal de Edição de Comissão

## Problema
O modal `EditCommissionModal` usa `useState` para inicializar os campos do formulário. O React só usa o valor inicial na primeira montagem — mudanças posteriores no prop `affiliate` são ignoradas. Resultado: o modal exibe valores padrão (10%) em vez dos reais (50%).

## Solução
Adicionar um `useEffect` em `src/components/Affiliate/EditCommissionModal.tsx` que sincroniza o estado do formulário sempre que o modal abrir ou o afiliado mudar.

### Alteração única no arquivo `src/components/Affiliate/EditCommissionModal.tsx`:

1. Adicionar `useEffect` ao import do React (linha 1)
2. Inserir um `useEffect` logo após as declarações de `useState` (~linha 49) que atualiza todos os campos:
   - `commissionType` ← `affiliate.commission_type`
   - `percentageRate` ← `affiliate.commission_rate`
   - `cpaValue` ← `affiliate.cpa_value_per_conversion`
   - `cpaTarget` ← `affiliate.cpa_conversions_target`
   - `repurchaseRate` ← `affiliate.repurchase_commission_rate`

Isso garante que ao abrir o modal para qualquer afiliado, os valores reais do banco serão exibidos corretamente.


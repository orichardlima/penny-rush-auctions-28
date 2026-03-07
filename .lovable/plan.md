

## Plano: Corrigir redirecionamento de parceiros no Dashboard

### Problema
A página `/dashboard` redireciona automaticamente parceiros ativos para `/minha-parceria`. Quando o parceiro clica em "Meus Lances", ele é levado ao painel do parceiro em vez de ver seus lances/leilões.

### Solução
Remover o redirecionamento automático de parceiros no `src/pages/Dashboard.tsx` (linhas 23-46). Parceiros devem poder acessar o dashboard de lances normalmente. Quem quiser acessar o painel de parceria já tem o menu "Minha Parceria" disponível.

### Alteração

**Arquivo: `src/pages/Dashboard.tsx`**
- Remover o `useEffect` que verifica `partner_contracts` e redireciona para `/minha-parceria` (linhas 23-46)
- Remover o estado `checkingPartner` e sua verificação no loading (linha 12, 49)
- Resultado: parceiros acessam `/dashboard` normalmente como qualquer usuário




## Plano: Contrato Demo — Flag interna no contrato, sem plano público

### Abordagem
Em vez de criar um "plano demo" visível na tabela `partner_plans`, a solução é adicionar uma flag `is_demo` diretamente na tabela `partner_contracts`. Isso mantém os planos públicos intactos e torna o demo uma decisão administrativa por contrato.

O admin ativa qualquer plano existente (Start, Pro, Elite, Legend) para o líder, mas marca como "Demo". O líder aparece na rede, pode indicar, mas não gera custos.

### Alterações

**1. Migration SQL**

- Adicionar coluna `is_demo BOOLEAN DEFAULT false` em `partner_contracts`
- Recriar `ensure_partner_referral_bonuses()` com guard: se o contrato sendo processado tem `is_demo = true`, retornar imediatamente (sem bônus de indicação para ninguém, sem pontos)
- Recriar `place_in_binary_tree_v2()` para pular `propagate_binary_points` quando `is_demo = true` (posiciona na árvore, mas sem pontos binários)

**2. Edge Function `partner-weekly-payouts`**

- Adicionar `is_demo` na interface `Contract`
- Filtrar contratos demo no loop de processamento: pular contratos com `is_demo = true`

**3. Frontend `AdminUserManagement.tsx` — Ativação manual**

- Adicionar checkbox/switch "Contrato Demo (sem repasses, sem bônus)" no dialog de atribuição de plano
- Passar `is_demo: true` no INSERT do contrato quando marcado
- Não creditar bônus de lances quando demo

**4. Frontend `AdminPartnerManagement.tsx` — Gestão**

- Badge "DEMO" na listagem de contratos
- Botão "Converter para Regular" que faz UPDATE `is_demo = false` e dispara `ensure_partner_referral_bonuses` + `propagate_binary_points` retroativamente

**5. Frontend `PartnerDashboard.tsx` — Aviso ao parceiro**

- Banner informativo quando `is_demo = true`: "Seu contrato está em modo demonstração."

### Regra importante
Indicados diretos de um parceiro demo que **pagaram de verdade** funcionam normalmente — geram bônus e pontos. A flag `is_demo` só bloqueia o impacto financeiro do próprio contrato demo.

### Arquivos afetados
| Arquivo | Tipo |
|---|---|
| Nova migration SQL | Coluna + guards nas funções |
| `supabase/functions/partner-weekly-payouts/index.ts` | Filtrar demos |
| `src/components/AdminUserManagement.tsx` | Switch demo na ativação |
| `src/components/Admin/AdminPartnerManagement.tsx` | Badge + converter |
| `src/components/Partner/PartnerDashboard.tsx` | Banner informativo |


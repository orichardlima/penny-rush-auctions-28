

## Investigação: Origem das 2 solicitações de saque do João Batista Sena

### Quem é
- **Parceiro:** João Batista Sena Nascimento (joaobatistasena@hotmail.com)
- **Plano:** Legend, 2 cotas, aporte R$ 19.998
- **Contrato:** `236eac8e-c587-44cb-bfad-9f78b38a21ce`
- **PIX recebedor:** CPF `04012260502` (titular João Fabio Quennede Araujo Sena)

### As 2 solicitações em tela
| ID | Valor | Taxa | Líquido | Criado em | Status |
|---|---|---|---|---|---|
| `252401ac…` | R$ 980,28 | R$ 49,01 | R$ 931,27 | 20/04/2026 10:33:**12.315** | APPROVED |
| `b0e02402…` | R$ 980,28 | R$ 49,01 | R$ 931,27 | 20/04/2026 10:33:**13.406** | APPROVED |

**Foram criadas com ~1,1 segundo de diferença, valores idênticos, mesmo PIX.** Foi gerada pelo próprio parceiro, no dashboard dele em `Partner/PartnerWithdrawalSection.tsx` → `handleRequestWithdrawal` → `requestWithdrawal` (`usePartnerWithdrawals.ts`). Não foi o admin que criou — saques de parceiro são auto-aprovados (status `APPROVED` direto, com `approved_at` preenchido automaticamente).

### Por que foram 2 (e não 1)
Causa raiz: **double-click / clique duplo no botão "Confirmar Saque"** (provavelmente no celular, com lag de rede). O fluxo atual tem 3 brechas que permitem isso:

1. **Sem trava no clique**: o botão usa apenas `disabled={submitting}` — entre o primeiro clique e o `setSubmitting(true)` do React, há uma janela de alguns ms onde um segundo clique passa. Os timestamps `10:33:12.315` e `10:33:13.406` confirmam o padrão de duplo-toque.
2. **Verificação de "saque pendente" feita só no estado local**: `withdrawals.find(w => w.status === 'APPROVED')` usa o `state` em memória, que ainda não foi recarregado quando a 2ª chamada parte.
3. **Sem constraint no banco**: não há `UNIQUE` impedindo 2 saques `APPROVED` ativos no mesmo `partner_contract_id`.

### Problema financeiro decorrente
O contrato tem:
- Total recebido em payouts PAID: **R$ 1.656,28**
- Já sacado (PAID): **R$ 676,00** (R$ 176 + R$ 500 pagos em datas anteriores)
- Saldo real disponível: R$ 1.656,28 − R$ 676,00 = **R$ 980,28**
- Comprometido nos 2 saques APPROVED: **R$ 1.960,56** ⚠️

**Ou seja: as 2 solicitações somadas (R$ 1.960,56) ultrapassam em R$ 980,28 o saldo real do parceiro.** Se ambas forem pagas, a empresa pagará em duplicidade. A verificação `calculateAvailableBalance` em `usePartnerWithdrawals.ts` já considera APPROVED no comprometido, mas como as 2 inserts foram quase simultâneas, ambas viram o mesmo saldo "livre" antes da outra ser persistida.

### Resposta direta
As 2 solicitações vieram do próprio parceiro (não do admin), através do dashboard do parceiro, em uma única ação de clique duplo. **Uma é legítima, a outra é duplicata acidental e não deve ser paga.**

### Ação recomendada (a aplicar quando você aprovar)

1. **Imediato (operacional, no painel admin):** rejeitar/cancelar uma das duas solicitações `APPROVED` (sugestão: a `b0e02402…`, criada 1s depois) com motivo "Duplicidade — clique duplo". Pagar apenas uma de R$ 980,28 (líquido R$ 931,27).
2. **Correção de código (preventiva)** — em `src/components/Partner/PartnerWithdrawalSection.tsx` e `src/hooks/usePartnerWithdrawals.ts`:
   - Travar o botão imediatamente (`isSubmittingRef` via `useRef` setado *antes* do `await`, além do `submitting` atual).
   - Antes do `insert`, **revalidar saldo e duplicidade direto no banco** (re-fetch de `partner_withdrawals` com `.in('status', ['APPROVED','PENDING'])` para esse contrato).
   - Mostrar a mensagem "Saque em andamento" também quando o estado local ainda não atualizou.
3. **Correção de banco (preventiva)** — migration:
   - Criar índice único parcial: `CREATE UNIQUE INDEX uniq_partner_active_withdrawal ON partner_withdrawals(partner_contract_id) WHERE status IN ('PENDING','APPROVED');` para que o próprio Postgres rejeite a 2ª inserção concorrente.

Quer que eu prossiga com a operação (cancelar a duplicata) e/ou com as correções preventivas (código + migration)?


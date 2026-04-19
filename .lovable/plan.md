
Preciso oferecer uma solução de plano para creditar manualmente. A melhor abordagem aqui é simular o fluxo do webhook para o txId dele, que vai:
1. Marcar `bid_purchases.payment_status = 'completed'`
2. Creditar os 15 lances no `profiles.bids_balance`
3. Processar comissão de afiliado se houver

Isso pode ser feito de duas formas:
- **Opção A (rápida):** rodar uma migração SQL pontual que credita os 15 lances e atualiza o status
- **Opção B (estrutural):** criar uma edge function `admin-confirm-pending-purchase` que o admin pode usar sempre que isso acontecer (reutilizável)

Recomendo a Opção B porque esse problema vai acontecer de novo e o admin precisa de uma ferramenta. Mas para o caso do Wellington, a correção imediata via SQL resolve agora.

## Plano: Creditar pagamento do Wellington + criar ferramenta admin para casos futuros

### Parte 1 — Correção imediata (Wellington)
Migração SQL que:
1. Atualiza `bid_purchases` ID `70030b2f-dcf5-44fa-a2cc-40aeb512c8fd` para `payment_status = 'completed'`
2. Credita +15 lances no `profiles.bids_balance` do user `4b6ee529...`
3. Processa comissões de afiliado pendentes (se houver) via lógica idêntica ao webhook
4. Registra log em `admin_audit_log` com motivo "Confirmação manual — webhook MagenPay não chegou. Comprovante validado em 17/04."

### Parte 2 — Ferramenta admin reutilizável
Adicionar no painel admin (aba "Compras Recentes" / `RecentPurchasesTab.tsx`) um botão **"Confirmar manualmente"** que aparece apenas em compras com `payment_status = 'pending'`.

Ao clicar:
- Abre dialog pedindo justificativa obrigatória (mín. 20 caracteres) e o ID/comprovante MagenPay
- Chama nova edge function `admin-confirm-pending-purchase`:
  - Valida admin
  - Replica a lógica do `magen-webhook` → `processBidPurchase` (status, saldo, comissões)
  - Registra em `admin_audit_log` com `action_type='manual_purchase_confirmation'`

### Componentes
- **Migração SQL:** correção pontual do Wellington
- **Nova Edge Function:** `supabase/functions/admin-confirm-pending-purchase/index.ts`
- **Novo componente:** `src/components/Admin/ConfirmPendingPurchaseDialog.tsx`
- **Edição:** `src/components/AdminDashboard/RecentPurchasesTab.tsx` — botão de confirmação para compras pendentes

### Fora de escopo
- Não altera o webhook MagenPay
- Não altera o fluxo normal de compra
- Não altera UI do usuário final

### Resultado esperado
- Wellington recebe os 15 lances imediatamente
- Admin tem botão para resolver casos futuros sem precisar pedir SQL manual
- Tudo auditado em `admin_audit_log`

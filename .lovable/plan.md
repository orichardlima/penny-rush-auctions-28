

# Correção: Saldo de comissões do Luis Paulo Mota

## Problemas encontrados

1. **`commission_balance` e `total_commission_earned` = R$ 756,50** — valor inflado por scripts retroativos que incrementaram sem verificar o saldo real
2. **17 comissões pendentes** cujas compras já foram pagas (`completed`) — deveriam ser `approved`
3. **1 comissão aprovada** cuja compra **não foi paga** (`pending`) — deveria ser `pending`

## Valor correto

- Comissões aprovadas de compras pagas: **R$ 326,50**
- Comissões pendentes de compras pagas (serão aprovadas): **R$ 205,00**
- **Total correto: R$ 531,50**

## Ações (via migration SQL)

### 1. Aprovar as 17 comissões pendentes com compras já pagas

```sql
UPDATE affiliate_commissions ac
SET status = 'approved', approved_at = NOW()
FROM bid_purchases bp
WHERE ac.purchase_id = bp.id
  AND ac.affiliate_id = '92e39f3b-4ea7-4b9d-a193-5ab981b4112a'
  AND ac.status = 'pending'
  AND bp.payment_status = 'completed';
```

### 2. Reverter a comissão aprovada cuja compra não foi paga

```sql
UPDATE affiliate_commissions
SET status = 'pending', approved_at = NULL
WHERE affiliate_id = '92e39f3b-4ea7-4b9d-a193-5ab981b4112a'
  AND status = 'approved'
  AND purchase_id IN (
    SELECT id FROM bid_purchases WHERE payment_status = 'pending'
  );
```

### 3. Corrigir o saldo para o valor real

```sql
UPDATE affiliates
SET commission_balance = 531.50,
    total_commission_earned = 531.50
WHERE id = '92e39f3b-4ea7-4b9d-a193-5ab981b4112a';
```

## Resultado

- Saldo corrigido de R$ 756,50 → **R$ 531,50**
- 17 comissões promovidas de `pending` → `approved`
- 1 comissão revertida de `approved` → `pending`

| Arquivo | Mudança |
|---|---|
| Migration SQL | Corrigir status das comissões e saldo do afiliado |


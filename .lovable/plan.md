## Diagnóstico

Os 3 bônus de indicação da Géssica (R$ 8.500,00 total) estão com status `AVAILABLE` na tabela `partner_referral_bonuses` desde 18-20/05/2026, mas **não entram no saldo de saque**.

### Causa raiz

O fluxo de saldo do parceiro hoje considera apenas:
- `partner_payouts` (status PAID) — gerado pelo cron `partner-weekly-payouts` a partir do *rendimento do aporte*
- Menos `partner_withdrawals` (PENDING/APPROVED/PAID)

O cron `release-referral-bonuses` apenas faz `UPDATE status = 'AVAILABLE'` na tabela `partner_referral_bonuses` — **não credita o `bonus_value` em lugar nenhum** que o fluxo de saque enxergue. Resultado: o parceiro vê "Disponível" no painel de bônus, mas não consegue sacar.

Validei: Géssica tem `partner_payouts` PAID = R$ 1.225, sacou R$ 625, sobra R$ 600 de rendimento. Os R$ 8.500 de bônus de indicação ficam órfãos.

## Plano de correção

### 1. Atualizar `release_pending_referral_bonuses()` para creditar no saldo

Quando o bônus passar de PENDING → AVAILABLE, também:
- Inserir um registro em `partner_payouts` (tipo "referral_bonus") OU somar direto em `partner_contracts.available_balance` do referrer
- Marcar `paid_at` ou um novo campo `credited_at` para evitar duplo crédito

Decisão técnica: **somar em `partner_contracts.available_balance`** é mais simples e segue o mesmo padrão do binary_bonuses (que já faz `UPDATE partner_contracts SET available_balance = available_balance + v_bonus`). Mas o `calculateAvailableBalance` no frontend usa `partner_payouts - partner_withdrawals`, ignorando `available_balance`. Então a opção correta é **inserir em `partner_payouts`**.

Novo comportamento da função:
```sql
FOR cada bônus pendente liberado LOOP
  INSERT INTO partner_payouts (
    partner_contract_id, amount, calculated_amount,
    period_start, period_end, status, paid_at,
    source -- novo campo opcional: 'referral_bonus'
  ) VALUES (
    referrer_contract_id, bonus_value, bonus_value,
    available_at::date, available_at::date, 'PAID', now(),
    'referral_bonus'
  );
  
  UPDATE partner_referral_bonuses SET status='AVAILABLE' WHERE id=...;
END LOOP;
```

### 2. Migration: backfill da Géssica (e qualquer outro parceiro afetado)

```sql
INSERT INTO partner_payouts (partner_contract_id, amount, calculated_amount, period_start, period_end, status, paid_at)
SELECT referrer_contract_id, bonus_value, bonus_value,
       available_at::date, available_at::date, 'PAID', available_at
FROM partner_referral_bonuses
WHERE status = 'AVAILABLE'
  AND NOT EXISTS (
    SELECT 1 FROM partner_payouts pp
    WHERE pp.partner_contract_id = partner_referral_bonuses.referrer_contract_id
      AND pp.amount = partner_referral_bonuses.bonus_value
      AND pp.paid_at = partner_referral_bonuses.available_at
  );
```

Vou rodar primeiro um `SELECT` de auditoria mostrando o impacto total antes de aplicar.

### 3. Verificações

- Confirmar que Géssica passa a ter R$ 8.500 + R$ 600 = **R$ 9.100,00 disponível para saque**
- Listar quantos outros parceiros foram afetados pelo bug histórico
- Garantir que o teto total (`total_cap`) **não** se aplica a bônus de indicação (eles são pagos separados do rendimento — confirmar com você)

## Pergunta importante antes de executar

**Os bônus de indicação contam para o `total_cap` do contrato?**
- Se SIM: preciso somar em `total_received` também e checar fechamento
- Se NÃO (mais provável, segundo a memória do projeto): o bônus de indicação é um sistema separado e o backfill é direto

Me confirme isso e eu sigo com a migration.
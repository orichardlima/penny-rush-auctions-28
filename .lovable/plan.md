

# Plano: Aplicar 5 Correções de Segurança Restantes

A tabela `auctions` permanece pública como está — winner_name, bidders e dados de leilão são intencionalmente públicos.

## Correções

### 1. `affiliate_referrals` — Forçar `converted = false` no INSERT

O frontend (`useReferralTracking.ts`) insere referrals para tracking de cliques antes do login (precisa de `anon`). O problema é que a policy atual permite inserir com `converted = true`, fabricando conversões falsas.

```sql
DROP POLICY "Anyone can insert referrals" ON affiliate_referrals;
CREATE POLICY "Anyone can insert referrals" ON affiliate_referrals
  FOR INSERT TO anon, authenticated
  WITH CHECK (converted = false);
```

### 2. `bid_purchases` — Remover INSERT do usuário

O INSERT é feito exclusivamente pelo edge function `mercado-pago-payment` (service_role). O frontend NÃO faz insert direto — chama `supabase.functions.invoke()`. Policy desnecessária e explorável.

```sql
DROP POLICY "Users can insert their own purchases" ON bid_purchases;
```

### 3. `partner_referral_bonuses` — Remover INSERT do usuário

O INSERT é feito pelo trigger `ensure_partner_referral_bonuses` (server-side). Nenhum código frontend insere nesta tabela.

```sql
DROP POLICY IF EXISTS "Users can create referral bonuses for their referrals" ON partner_referral_bonuses;
```

### 4. `partner_upgrades` — Remover INSERT do usuário

O INSERT é feito pelo webhook `partner-payment-webhook` (server-side). Nenhum código frontend insere nesta tabela.

```sql
DROP POLICY IF EXISTS "Users can insert own upgrades" ON partner_upgrades;
```

### 5. `partner_contracts` — Restringir UPDATE a campos de pagamento

O único UPDATE feito pelo usuário no frontend é em `usePartnerWithdrawals.ts` — atualiza apenas `pix_key`, `pix_key_type`, e `bank_details`. A policy atual permite alterar campos financeiros como `total_received`, `available_balance`, `total_cap`.

Reforçar o trigger `protect_partner_contract_fields` para bloquear alteração de campos financeiros por non-admins.

```sql
CREATE OR REPLACE FUNCTION protect_partner_contract_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT is_admin_user(auth.uid()) THEN
    NEW.status := OLD.status;
    NEW.total_cap := OLD.total_cap;
    NEW.weekly_cap := OLD.weekly_cap;
    NEW.aporte_value := OLD.aporte_value;
    NEW.total_received := OLD.total_received;
    NEW.total_withdrawn := OLD.total_withdrawn;
    NEW.available_balance := OLD.available_balance;
    NEW.total_referral_points := OLD.total_referral_points;
    NEW.plan_name := OLD.plan_name;
    NEW.referral_code := OLD.referral_code;
    NEW.payment_status := OLD.payment_status;
    NEW.bonus_bids_received := OLD.bonus_bids_received;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Impacto no Frontend

**Zero mudanças no frontend.** Todos os INSERTs removidos já são feitos server-side. O UPDATE de `partner_contracts` continua funcionando para os campos PIX que o usuário realmente precisa alterar.

## Resumo

| Tabela | Ação | Risco eliminado |
|---|---|---|
| `affiliate_referrals` | Forçar `converted=false` | Conversões falsas |
| `bid_purchases` | Drop INSERT policy | Compras fabricadas |
| `partner_referral_bonuses` | Drop INSERT policy | Bônus fabricados |
| `partner_upgrades` | Drop INSERT policy | Upgrades fabricados |
| `partner_contracts` | Trigger protege campos financeiros | Alteração de saldos |


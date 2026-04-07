
# Bloqueio de bônus para parceiros inadimplentes

## Resumo

Quando um parceiro tem `financial_status != 'paid'`, os bônus de indicação gerados para ele devem ter status `SUSPENDED` em vez de `PENDING`. Pontos binários continuam propagando (não faz sentido bloquear pois a árvore binária é estrutural), mas o bônus financeiro fica retido. Quando o parceiro regulariza (`financial_status` volta a `'paid'`), os bônus `SUSPENDED` são automaticamente convertidos para `PENDING` com `available_at` recalculado.

## Alterações

### 1. Migration SQL — 3 partes

**a) Alterar `ensure_partner_referral_bonuses`**: Antes de inserir cada bônus (níveis 1, 2, 3), verificar o `financial_status` do contrato receptor (`v_level1_contract`, `v_level2_contract`, `v_level3_contract`). Se `!= 'paid'`, inserir com status `'SUSPENDED'` e `available_at = NULL` em vez de `'PENDING'` com 7 dias.

**b) Alterar `release_pending_referral_bonuses`**: Adicionar condição para ignorar bônus `SUSPENDED` (já ignora naturalmente pois filtra `status = 'PENDING'`). Nenhuma mudança necessária aqui.

**c) Criar trigger/function para liberação automática**: Um trigger `AFTER UPDATE OF financial_status` na tabela `partner_contracts` que, quando `financial_status` muda para `'paid'`, converte todos os bônus `SUSPENDED` do contrato para `PENDING` com `available_at = NOW() + INTERVAL '7 days'`.

### 2. Frontend — exibir status SUSPENDED

**`src/hooks/usePartnerReferrals.ts`**:
- Adicionar `'SUSPENDED'` ao type `PartnerReferralBonus.status`
- Adicionar label "Suspenso (Inadimplente)" em `getStatusLabel`
- Adicionar cor vermelha/laranja em `getStatusColor`
- Adicionar contagem `suspended` nas stats

### 3. Componente de exibição

**`src/components/Partner/PartnerReferralSection.tsx`** (ou equivalente): Nenhuma mudança estrutural — o status `SUSPENDED` será exibido automaticamente via os helpers atualizados.

## Lógica SQL detalhada

Na função `ensure_partner_referral_bonuses`, para cada nível, o status será determinado assim:

```sql
-- Determinar status baseado no financial_status do receptor
v_bonus_status := CASE 
  WHEN v_level1_contract.financial_status = 'paid' THEN 'PENDING'
  ELSE 'SUSPENDED'
END;
v_bonus_available_at := CASE
  WHEN v_level1_contract.financial_status = 'paid' THEN NOW() + INTERVAL '7 days'
  ELSE NULL
END;
```

Trigger de liberação automática:

```sql
CREATE FUNCTION unsuspend_bonuses_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.financial_status = 'paid' AND OLD.financial_status != 'paid' THEN
    UPDATE partner_referral_bonuses
    SET status = 'PENDING', available_at = NOW() + INTERVAL '7 days'
    WHERE referrer_contract_id = NEW.id AND status = 'SUSPENDED';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Impacto

- Bônus de inadimplentes ficam congelados até regularização
- Pontos binários continuam propagando (estrutura da rede não é afetada)
- Liberação é automática ao pagar — sem intervenção manual
- 1 migration + 1 arquivo frontend editado

## Arquivos

| Tipo | Arquivo |
|------|---------|
| Migration SQL | Reescreve `ensure_partner_referral_bonuses` + cria trigger `unsuspend_bonuses_on_payment` |
| Frontend | `src/hooks/usePartnerReferrals.ts` — adicionar SUSPENDED ao type e helpers |

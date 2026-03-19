

# Creditar 50 lances bônus para Jose Alcanjo Valerio

## Situação

- Contrato START ativo (ID: `373f0548-aeb1-49a0-9d33-333ce1289cfa`)
- `bonus_bids_received`: 50 (registrado no contrato)
- `bids_balance`: 0.00 (nunca creditado no perfil)
- Lances dados em leilões: 0
- Compras de pacotes: 0

O erro de constraint (`partner_referral_bonuses_referred_contract_level_key`) que corrigimos anteriormente interrompeu a transação de ativação antes que o crédito de lances fosse efetivado no perfil.

## Correção

### Migration SQL

Atualizar o `bids_balance` do perfil do Jose Alcanjo com +50 lances:

```sql
UPDATE profiles 
SET bids_balance = bids_balance + 50,
    updated_at = now()
WHERE user_id = '6684eb32-8e9b-4539-9792-db3bbbc5f1e8'
  AND bids_balance = 0;
```

A condição `bids_balance = 0` é uma segurança para evitar crédito duplicado caso já tenha sido corrigido por outro meio.

### Nenhuma alteração de frontend necessária

A correção é puramente no banco de dados.


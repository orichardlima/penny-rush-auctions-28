

# Fix: Bônus de upgrade Nível 1 faltante + error handling

## Resumo
Inserir o bônus faltante de R$ 2.400,16 para Tiago Mendes e adicionar tratamento de erro nos inserts de bônus de upgrade para evitar falhas silenciosas no futuro.

## Etapas

### 1. Inserir bônus faltante via migration SQL
Inserir registro na tabela `partner_referral_bonuses` com:
- referrer_contract_id: be3406be (Tiago Mendes)
- referred_contract_id: 1ab45a69 (Henrique)
- aporte_value: 15001, bonus_percentage: 16%, bonus_value: 2400.16
- source_event: 'upgrade', status: 'PENDING', available_at: now() + 7 dias

### 2. Adicionar error handling em useAdminPartners.ts
Na função `upgradeContractPlan` e `upgradeContractCotas`, envolver cada insert de bônus com checagem de erro e toast de alerta ao admin em caso de falha.

## Arquivos alterados
- Nova migration SQL (insert do bônus)
- `src/hooks/useAdminPartners.ts` (error handling nos inserts de bônus de upgrade)


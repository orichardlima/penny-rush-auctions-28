## Contexto

A última manutenção recalculou retroativamente o b\u00f4nus de indica\u00e7\u00e3o de TODO o hist\u00f3rico, recriando como AVAILABLE valores que j\u00e1 haviam sido sacados ou compensados de forma indireta. Resultado: **R$ 62.074,44 em 69 b\u00f4nus** apareceram indevidamente no saldo de v\u00e1rios parceiros.

## Data de corte

Cadastro da parceira **Géssica Teixeira Ramos** — contrato criado em **11/05/2026 14:22 (BRT)**. Tudo anterior a esse instante deve sair do saldo.

## Estado atual no banco

| status | qtd | total |
|---|---|---|
| AVAILABLE antes do corte | 69 | R$ 62.074,44 |
| CANCELLED antes do corte | 6 | R$ 5.175,12 |
| AVAILABLE/CANCELLED após o corte | mantém | — |

Nenhum b\u00f4nus est\u00e1 em status PAID, ent\u00e3o n\u00e3o h\u00e1 risco de mexer em registros j\u00e1 quitados pela plataforma.

## O que fazer

### 1. Migração: cancelar b\u00f4nus pré-corte

Atualizar os 69 b\u00f4nus `AVAILABLE` criados antes de `2026-05-11 14:22:36+00` para status `CANCELLED`, preenchendo:
- `cancellation_reason` (ou campo equivalente existente; se n\u00e3o existir, usar `notes`/`source_event`) com `"Cancelado por corte de recálculo - vigência a partir de 11/05/2026"`
- mantém `bonus_value`, `created_at`, refer\u00eancias e demais campos para hist\u00f3rico/auditoria.

Isso faz com que sumam imediatamente do `available_balance` e da listagem "Disponível" do escrit\u00f3rio virtual, mas continuem vis\u00edveis no hist\u00f3rico.

### 2. Trava de seguran\u00e7a contra novos recálculos

Inserir registro em `system_settings`:
- `referral_bonus_cutoff_date = 2026-05-11T14:22:36-03:00`

E criar trigger `BEFORE INSERT` em `partner_referral_bonuses` que:
- l\u00ea esse setting;
- se `NEW.created_at < cutoff` **ou** o contrato indicado (`referred_contract_id`) foi criado antes do cutoff, marca `NEW.status = 'CANCELLED'` e `source_event = 'pre_cutoff_skip'`, evitando que qualquer futura rotina de recálculo volte a "ressuscitar" valores antigos.

### 3. Sem mudan\u00e7as de UI/fluxo

Nenhuma altera\u00e7\u00e3o no frontend, no escrit\u00f3rio virtual, no fluxo de saque ou em outros b\u00f4nus (bin\u00e1rio, fast start, etc.). Os hooks `useReferralBonuses` e `usePartnerCashflow` j\u00e1 filtram corretamente por status — CANCELLED j\u00e1 n\u00e3o entra como dispon\u00edvel.

## Detalhes técnicos

- 1 migração SQL contendo: `UPDATE partner_referral_bonuses ...`, `INSERT INTO system_settings ...`, `CREATE OR REPLACE FUNCTION enforce_referral_bonus_cutoff()` + `CREATE TRIGGER`.
- Antes de aplicar o UPDATE, conferir se a tabela tem coluna `cancellation_reason`. Se n\u00e3o tiver, usar `source_event` (j\u00e1 existe nos inserts vistos).
- Salvar memória do projeto registrando a data de corte e o motivo.

## Como validar após aplicar

1. `SELECT SUM(bonus_value) FROM partner_referral_bonuses WHERE status='AVAILABLE' AND created_at < '2026-05-11 14:22:36+00'` → deve retornar 0.
2. Abrir o escrit\u00f3rio virtual de um parceiro afetado → saldo "Bônus disponível" reduz no valor cancelado.
3. Tentar reexecutar uma rotina de recálculo de teste → novos registros pré-corte j\u00e1 nascem CANCELLED.
# Separação definitiva entre Repasses Semanais e Bônus de Rede

## Objetivo
Garantir que **repasses de parceria** e **bônus de rede** (incluindo o Bônus de Expansão) sejam mecanismos totalmente independentes: nunca se compensam, nunca se limitam e nunca se misturam no teto contratual de 200%/220%.

---

## 1. Banco de dados

### 1.1 Classificação obrigatória em `partner_payouts`
Adicionar colunas (com backfill inteligente e default seguro):
- `payout_type TEXT NOT NULL` — enum textual com CHECK:
  - `partnership_weekly_repass`
  - `direct_referral_bonus`
  - `indirect_referral_bonus`
  - `fast_start_bonus`
  - `expansion_bonus`
  - `leadership_bonus`
- `source_type TEXT`, `source_id UUID`, `source_ref TEXT`
- `gross_amount NUMERIC(18,2)`, `adjustment_amount NUMERIC(18,2) DEFAULT 0`, `final_amount NUMERIC(18,2)`
- Índice único parcial em `(source_type, source_ref)` onde `source_ref IS NOT NULL` — evita duplicidade.

### 1.2 Backfill
- Registros históricos existentes de `partner_payouts` (gerados pelo sistema de repasse semanal) → `payout_type = 'partnership_weekly_repass'`.
- Nenhum registro atual pertence a bônus de rede (esses viviam em `referral_bonuses`, `fast_start_achievements`, `binary_bonuses`, etc., que **não entram** em `partner_payouts`).

### 1.3 Regra imutável do teto contratual
Alterar TODAS as funções que calculam `total_received` / consumo do teto do contrato para considerar **exclusivamente** `payout_type = 'partnership_weekly_repass'`. Alvos:
- `close_binary_cycle`, `check_and_close_partner_contract`, `calculate_early_termination`
- Views/RPCs de dashboard financeiro do parceiro
- Qualquer soma em `partner_contracts.total_received`

A regra `network_bonuses_count_toward_contract_total_cap = false` fica **hardcoded** na lógica; não haverá flag admin.

### 1.4 Bônus de Expansão em `partner_payouts`
Atualizar `expansion_release_bonus` para inserir o payout com:
```
payout_type = 'expansion_bonus'
source_type = 'expansion_snapshot'
source_ref  = snapshot_id
```
O crédito na carteira acontece na coluna certa (ver 1.5).

### 1.5 Carteira separada por categoria
Em `partner_contracts`, adicionar colunas somatórias:
- `network_bonus_balance NUMERIC(18,2) DEFAULT 0` — saldo disponível de bônus de rede
- `network_bonus_total_received NUMERIC(18,2) DEFAULT 0`

`available_balance` e `total_received` continuam existindo mas passam a refletir **apenas** repasses de parceria.
`expansion_release_bonus` credita em `network_bonus_balance` / `network_bonus_total_received`, nunca em `total_received`.

---

## 2. Backend / Edge Functions
- Ajustar edge functions de saque para permitir sacar dos dois saldos (repasse e bônus de rede) sem misturá-los na contabilidade do teto.
- Ajustar qualquer RPC de resumo do contrato (`get_partner_performance_summary`, etc.) para devolver os dois blocos separados.

---

## 3. Frontend

### 3.1 Escritório do parceiro
Dois quadros distintos na tela financeira:

**Quadro do Contrato**
- Valor do aporte
- Total de repasses recebidos
- Saldo restante até o teto (200%/220%)
- Teto total do contrato

**Quadro de Bônus de Rede**
- Bônus de indicação (direta/indireta)
- Bônus de Expansão
- Fast Start / Liderança / demais bônus
- Total acumulado de bônus

### 3.2 Histórico
Filtros por categoria: Repasses, Indicação, Expansão, Outros.

### 3.3 Painel administrativo
- Filtro por `payout_type` no histórico de payouts.
- Relatório financeiro com quebra por tipo.
- Coluna clara "Categoria" em cada lançamento.

---

## 4. Testes automatizados
Suíte cobrindo os 7 cenários exigidos, com asserts diretos sobre `partner_contracts.total_received`, `available_balance` e `network_bonus_balance`.

---

## 5. Execução (fases curtas, uma migration cada)

1. **Migration A** — colunas em `partner_payouts` + backfill + índice único.
2. **Migration B** — colunas de saldo de rede em `partner_contracts` + funções de crédito revisadas + atualização de `expansion_release_bonus`.
3. **Migration C** — reescrita das funções de teto contratual filtrando por `payout_type`.
4. **Frontend** — dois quadros no escritório + filtros no admin.
5. **Testes** — cenários 1 a 7.

Cada migration entra individualmente e você aprova antes da próxima, evitando lock/timeout.

---

## Detalhes técnicos (referência)

- CHECK constraint textual (não usar ENUM) para permitir novos tipos sem `ALTER TYPE`.
- `expansion_release_bonus` já é atômico; apenas troca a coluna de destino do crédito e passa a preencher `payout_type`.
- Cálculo do teto passa a ser: `SUM(final_amount) FILTER (WHERE payout_type='partnership_weekly_repass' AND status='PAID')`.
- Nenhuma alteração no motor de VQE / snapshots / cron de fechamento — a separação é puramente contábil.

Confirma que posso iniciar pela Migration A?

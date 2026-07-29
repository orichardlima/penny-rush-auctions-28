# Consumo de VQE com Saldo Acumulado por Equipe

## Objetivo
Substituir a lógica atual de "janela semanal independente" por um modelo de **saldo acumulado de bonificação por equipe raiz**, com consumo determinístico do VQE a cada fechamento semanal. Pontos históricos de carreira permanecem intocados.

## Regras aprovadas
1. Cada equipe raiz (parceiro indicado diretamente pelo titular) possui um **saldo de bonificação** próprio, independente do histórico de carreira.
2. No fechamento semanal:
   - Somar ao saldo anterior de cada equipe os pontos líquidos elegíveis da semana.
   - `largest_team` = equipe com maior saldo disponível.
   - `others_sum` = soma dos saldos das demais equipes.
   - `available_vqe = LEAST(largest, others_sum)`.
   - `max_payable_vqe = plan_weekly_cap / expansion_bonus_rate`.
   - `payable_vqe = LEAST(available_vqe, max_payable_vqe)`.
   - `final_bonus = payable_vqe × expansion_bonus_rate`.
3. Consumo:
   - Debitar `payable_vqe` do saldo da maior equipe.
   - Debitar `payable_vqe` do conjunto das demais, **proporcionalmente** ao saldo disponível de cada uma, com arredondamento determinístico (maior resto primeiro) para garantir soma exata.
4. Sobras permanecem acumuladas para semanas futuras (em todas as equipes).
5. **Carreira/qualificação continua usando pontos brutos históricos** — o consumo só afeta o saldo de bonificação.
6. Idempotência total: reprocessar a mesma semana não pode consumir os mesmos pontos duas vezes; reversões geram carryforward negativo rastreável.

## Estrutura de dados

Nova tabela `expansion_team_balances`:
- `partner_id` (titular) + `team_root_id` (equipe raiz)
- `bonus_balance` numeric — saldo atual disponível para bonificação
- `lifetime_earned` numeric — total bruto histórico (informativo; carreira lê do ledger)
- `lifetime_consumed` numeric — total já consumido em bônus
- `last_period_start` date — última semana processada
- unique(partner_id, team_root_id)

Nova tabela `expansion_period_team_movements` (auditoria por semana × equipe):
- `snapshot_id` FK → `expansion_period_snapshots`
- `partner_id`, `team_root_id`
- `opening_balance`, `points_added`, `points_consumed`, `closing_balance`
- `role` enum: `largest` | `other`
- `consumption_share` numeric (proporção usada no rateio)

Colunas novas em `expansion_period_snapshots`:
- `available_vqe`, `payable_vqe`, `max_payable_vqe`
- `total_consumed` (= 2 × payable_vqe)
- `total_carryforward` (soma dos closing_balances)
- `reprocess_count`, `reprocessed_at`

## Motor de cálculo

Substituir/estender `expansion_compute_period(partner_id, week_start)`:

```text
BEGIN
  lock em expansion_team_balances FOR UPDATE (partner_id)
  se snapshot existente e status='final' → abortar (idempotência)
  se reprocessando → estornar movimentos anteriores desta semana
    (somar de volta points_consumed em cada team_balance,
     debitar points_added se aplicável — carryforward negativo se necessário)

  para cada team_root do partner:
    opening = team_balance.bonus_balance
    added   = SUM(points_ledger WHERE team_root_id=X AND week=W AND eligible)
    working = opening + added

  largest_team = argmax(working)
  others_sum   = sum(working) - working[largest]
  available_vqe = LEAST(working[largest], others_sum)
  max_payable   = plan_weekly_cap / rate
  payable_vqe   = LEAST(available_vqe, max_payable)
  bonus         = payable_vqe * rate

  debitar payable_vqe de working[largest]
  distribuir payable_vqe entre as demais proporcional a working[i]/others_sum
    → arredondamento por maior-resto para fechar soma exata

  UPDATE expansion_team_balances SET bonus_balance=closing, lifetime_consumed+=consumed
  INSERT expansion_period_team_movements (auditoria por equipe)
  INSERT/UPDATE expansion_period_snapshots (status='simulation', bonus, VQEs, totals)
  INSERT expansion_bonus_lines (status='simulation', payout desabilitado)
COMMIT
```

Todo o cálculo em transação única com `FOR UPDATE` no partner para evitar corrida.

## Reversão / carryforward negativo

RPC `expansion_reverse_period(partner_id, week_start, reason)`:
- Só executa se `expansion_bonus_payout_enabled = false` ou linha ainda não paga.
- Reverte movimentos: soma `points_consumed` de volta ao `bonus_balance`, subtrai `points_added`.
- Se resultado ficar negativo (pontos já consumidos em semanas posteriores), registra `carryforward_debt` na `expansion_team_balances` — próximas adições abatem essa dívida antes de somar ao saldo disponível.
- Marca snapshot como `reversed`, mantém histórico.

## Backfill / migração

- Criar `expansion_team_balances` inicializando `bonus_balance = 0` para todas as memberships existentes (não migrar histórico como saldo — pontos anteriores ao corte 2026-07-29 já foram tratados como janela semanal).
- Primeira execução após deploy começa do zero de saldo; pontos novos da semana entram normalmente.

## Cron
Manter cron semanal 00:30 America/Bahia processando todos os partners ativos via `expansion_compute_period`. Sem alteração de horário.

## Guardrails
- `expansion_bonus_payout_enabled` permanece `false`: cálculo grava tudo como `status='simulation'`, nada vira crédito real.
- Auditoria completa em `expansion_admin_audit` (quem disparou, snapshot antes/depois).
- `expansion_period_team_movements` permite reconstruir qualquer semana.
- Testes automatizados cobrindo o exemplo dado (João 4k / Maria 3k / Carlos 2k / Fernanda 1k → bônus R$ 800, carryforward 0/1000/667/333) e casos: teto do plano ativo, equipe única, reversão, reprocesso.

## Fases
1. **Migration**: criar tabelas `expansion_team_balances` e `expansion_period_team_movements`, colunas novas em `expansion_period_snapshots`, GRANTs + RLS. Backfill de saldos zerados.
2. **Motor**: reescrever `expansion_compute_period` com a lógica de consumo e rateio proporcional determinístico.
3. **Reversão**: RPC `expansion_reverse_period` com carryforward negativo.
4. **Testes SQL** rodando o exemplo canônico e edge cases.
5. **UI admin**: exibir na simulação semanal, por equipe, `saldo inicial → +adicionados → −consumidos → saldo final`, além de VQE disponível, VQE pagável e teto aplicado. Sem alterar UI do parceiro nesta fase.

## Fora de escopo
- Ativação de pagamentos (continua desligada).
- Mudanças em carreira/qualificação (continuam lendo pontos brutos do ledger).
- Alterações no fluxo de pontos de expansão (ledger e triggers permanecem como estão).

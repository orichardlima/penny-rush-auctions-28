
# Correção do Pipeline de Pontos Show

## Diagnóstico (dados reais do banco)

O programa está **totalmente ligado** (todas as flags `true`, regra ativa 12→1, loja com 3 itens, audiência `all`). Porém **nenhum ponto está sendo gerado** por dois motivos:

1. **Bug SQL bloqueante:** 4 lances já foram lançados na fila `points_bid_reconciliation_queue` com o erro `column reference "source" is ambiguous`. Toda tentativa de consumir lotes de lance para gerar pontos aborta com esse erro e o lance é enviado para a fila em vez de virar ponto.
2. **Data de corte no futuro:** `points_accrual_started_at = 2026-07-28 07:57 UTC` (ainda faltam ~4h). Antes desse horário nenhum lance é elegível — comportamento correto, apenas informativo.
3. **Zero `bid_lots` com `eligible_for_points=true` no banco inteiro** — indica que o webhook de compra paga ainda não marcou nenhum lote como elegível (ou ninguém comprou lances desde a virada de schema). Precisa validação após a correção do bug.

## O que corrigir

### 1. Bug "column source is ambiguous"
Localizar a função SQL que faz JOIN entre `bid_lots` e `bid_lot_consumptions` (ambas têm coluna `source`) sem qualificar. Candidatas prováveis:
- `consume_bid_lots_for_bid`
- `commit_bid_lot_consumptions`
- `consume_bid_lots`

Qualificar todas as referências a `source` com o alias da tabela (`bl.source` vs `blc.source`) e criar migration única com a versão corrigida (`CREATE OR REPLACE FUNCTION`).

### 2. Reprocessar a fila
Após a função corrigida, disparar reprocessamento dos 4 itens em `points_bid_reconciliation_queue` para não perderem elegibilidade retroativa (ou marcar como "corte anterior" se caírem antes de `points_accrual_started_at`).

### 3. Verificação pós-correção
- Confirmar que a função executa sem erro em um lance de teste.
- Confirmar que, quando um `bid_lot` pago é consumido em um leilão que o usuário não vence, um `points_ledger` (`EARN_AUCTION`) é criado e `points_wallets.available_points` incrementa a cada 12 lances.
- Confirmar que a fila `points_bid_reconciliation_queue` para de crescer.

## Fora de escopo (não mexer)
- Data de corte (`points_accrual_started_at`) — usuário definiu; só documentar que antes desse horário não gera pontos.
- Regras 12→1, audiência, catálogo, UI admin, flags — tudo já validado e funcionando.
- Nenhuma alteração em UI/UX; correção é 100% backend (função SQL).

## Detalhes técnicos
- Migration única `CREATE OR REPLACE FUNCTION` para as funções afetadas, mantendo assinatura idêntica.
- Sem `DROP`, sem alteração de schema, sem novas tabelas.
- Após aplicar, rodar `SELECT` na fila para provar que reason mudou (ou está vazia).

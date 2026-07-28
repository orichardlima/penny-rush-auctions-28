## Diagnóstico — Programa Pontos Show em produção

Verifiquei o estado real do sistema no banco (horário atual: **28/07/2026 13:29 UTC**, corte configurado: **28/07 07:57 UTC** — já passou).

### ✅ Infraestrutura: 100% operacional
- Todas as flags ligadas: `points_program_enabled`, `points_accrual_enabled`, `points_lot_consumption_enabled`, `points_store_enabled`, `points_redemption_enabled`, `webhooks_validated`.
- Regra ativa: **12 lances pagos elegíveis = 1 Ponto Show**.
- Data de corte já vigente.
- Trigger anti-bot funcionando (nenhum lance de bot marcado como elegível).

### ❌ Pontos ainda NÃO estão sendo gerados — e o motivo não é bug

Contadores reais desde o corte:

| Métrica | Valor |
|---|---|
| Compras PIX pagas após o corte (`bid_purchases` payment_status='paid') | **0** |
| Compras PIX pagas em toda a história da tabela | **0** |
| Lotes elegíveis criados (`bid_lots.eligible_for_points=true`) | **0** |
| Lances de usuários **reais** após o corte | **0** |
| Lances de **bots** após o corte | 5.729 (corretamente inelegíveis) |
| Consumos FIFO elegíveis (`bid_lot_consumptions`) | 0 |
| Entradas no ledger (`points_ledger`) | 0 |
| Carteiras criadas (`points_wallets`) | 0 |
| Liquidações de leilão (`auction_points_settlements`) | 0 |
| Fila de reconciliação pendente | 0 (limpa) |

### 🎯 Conclusão

O sistema está **pronto e destravado**, mas **nenhum usuário real comprou lances via PIX após o corte**. Sem compra paga → sem lote elegível → sem consumo elegível → sem ponto. É o comportamento esperado das regras que você aprovou.

Um detalhe estranho vale registrar: a tabela `bid_purchases` mostra **0 compras com `payment_status='paid'` em toda a história** (833 registros, nenhum "paid"). Isso pode indicar que o status "paid" nunca é usado (talvez seja "approved", "confirmed", "completed" etc.) — vale investigar antes do teste real de R$ 5,00 para garantir que o webhook Veopag vai marcar o lote como elegível corretamente.

### Próximos passos propostos

1. **Confirmar o vocabulário de status** que o webhook Veopag grava em `bid_purchases.payment_status` (checar valores distintos existentes e o código do webhook), para garantir que o gatilho de elegibilidade dispara.
2. **Fazer a compra real de R$ 5,00** que você já autorizou, e acompanhar em tempo real:
   - lote criado com `eligible_for_points=true`
   - lance consumido em leilão perdido gera `bid_lot_consumptions.eligible_for_points=true`
   - `auction_points_settlements` cria pontos ao final
   - `points_wallets.available_points` do usuário aumenta
3. Só então declarar o pilot como validado end-to-end.

Confirma seguir por aí? Posso começar pelo passo 1 (auditar o vocabulário de status e o caminho do webhook) sem mexer em nada de UI/negócio.
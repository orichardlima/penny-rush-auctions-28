## Diagnóstico confirmado

O Richard já deu **5 lances depois do corte** e esses lances consumiram um lote pago real, mas a tela mostra `0/12` porque o consumo foi gravado como **não elegível**.

O ponto principal encontrado:

- O lote pago do Richard está correto: `eligible_for_points=true`.
- A função FIFO `preview_consume_bid_lots` só considera o lote elegível se `bid_lots.purchased_at` estiver preenchido e maior que o corte.
- Os lotes criados pela função atual `credit_paid_bid_purchase` preenchem `payment_confirmed_at`, mas deixam `purchased_at` vazio.
- Resultado: o lote pago cai na segunda fila como inelegível, mesmo sendo uma compra MagenPay concluída depois do corte.

## Plano de correção

1. **Corrigir a função de crédito de compra paga**
   - Atualizar `credit_paid_bid_purchase` para preencher `purchased_at` com a data de confirmação do pagamento.
   - Manter `payment_confirmed_at` como está, sem remover rastreabilidade.
   - Não alterar fluxo de pagamento, saldo, PIX, MagenPay, Veopag legado ou UI.

2. **Corrigir a regra FIFO dos pontos**
   - Ajustar `preview_consume_bid_lots` para usar `COALESCE(purchased_at, payment_confirmed_at, created_at)` como data efetiva da compra.
   - Assim, lotes já criados corretamente por webhook, mas sem `purchased_at`, passam a ser lidos como elegíveis quando forem realmente pagos após o corte.

3. **Backfill seguro dos lotes já pagos**
   - Para lotes `paid_purchase` com `payment_confirmed_at` preenchido e `purchased_at` vazio, preencher `purchased_at = payment_confirmed_at`.
   - Isso corrige os lotes já existentes sem inventar compra falsa.

4. **Corrigir os 5 consumos do Richard que foram classificados errado**
   - Reclassificar somente os consumos que:
     - pertencem ao Richard;
     - vieram de lote `eligible_for_points=true`;
     - têm pagamento confirmado depois de `points_accrual_started_at`;
     - estão marcados hoje como `eligible_for_points=false` por causa desse bug.
   - Marcar os lances correspondentes como elegíveis.
   - Como os leilões desses lances ainda estão ativos, eles devem aparecer no progresso como **5/12 lances elegíveis**, mas ainda **não viram ponto** até o leilão terminar e ele não vencer.

5. **Verificar no banco depois da correção**
   - Confirmar que Richard passa de `0/12` para `5/12` no bucket/progresso.
   - Confirmar que a carteira continua com `0 pontos` enquanto os leilões ainda estiverem ativos.
   - Confirmar que o sistema continua respeitando a regra: só credita ponto fechado quando o leilão termina e o usuário não é vencedor.

## Resultado esperado

Após aplicar:

- A tela **Meus Pontos Show** deve mostrar o progresso real dos lances pagos usados pelo Richard.
- Compras MagenPay futuras já nascerão com rastreabilidade completa.
- Lances pagos consumidos depois do corte serão contabilizados corretamente.
- Nenhum ponto será dado indevidamente antes do fim do leilão.
- Nenhum lance de bot será contabilizado.
# Pagamento da Juliana Ferreira Santos (plano PRO, R$ 1.499) não reconhecido

## O que foi encontrado
- Juliana (jullyyf67@gmail.com) gerou dois PIX hoje: ELITE R$ 2.999 às 08:44 UTC (não pago) e **PRO R$ 1.499 às 08:47 UTC** (código `xmF356TpVgUpirwgexHQdpXflyYbp5Xgmlc`). O comprovante, pago às 08:48 (horário de Brasília), é de R$ 1.499 e corresponde ao PRO.
- Os dois pedidos continuam "pendentes" e ela não tem contrato. Patrocinador: Carlos Eugenio (PO0SDN2U).
- **Causa:** a confirmação MagenPay continua bloqueada para ativação de plano. Esse bloqueio vem da contenção de 27/10. Na correção de ontem, liberei só a compra de lances, e avisei que contrato e upgrade continuavam bloqueados. Por isso a tela consulta o pagamento, mas recebe "pendente" sem perguntar à MagenPay.

## O que será feito (só no fluxo MagenPay, nada da VeoPag)
1. Liberar a confirmação MagenPay para ativação de plano e upgrades, com as mesmas travas usadas nos lances:
   - o código do PIX precisa ser o mesmo salvo no pedido quando o PIX foi gerado;
   - a MagenPay precisa responder "pago" para esse código;
   - um código já usado não ativa outro pedido (registro anti-reuso).
2. Antes de ativar, consultar a MagenPay para confirmar que o código do pedido PRO está pago.
3. Se estiver pago, ativar o contrato PRO da Juliana pelo fluxo normal: 150 lances bônus, vínculo com Carlos Eugenio e bônus de indicação pelas regras atuais. Fazer isso mesmo que o prazo do PIX já tenha vencido.
4. Deixar o pedido ELITE como está, pendente e sem efeito.
5. Conferir no banco o contrato ativo, o pedido marcado como pago e os lances creditados.

## Detalhes técnicos
- `magen-check-status`: tirar `intentId`/`upgradeRef` do kill switch `LEGACY_PAYMENT_WEBHOOKS_ENABLED`. Validar `txId === payment_id` do intent (ou upgrade). Gravar em `payment_confirmations`. Antes de mudar, revisar se `processPartnerIntent` recusa intents vencidos.
- Não mexer em contratos, saldos ou vínculos de outros parceiros.

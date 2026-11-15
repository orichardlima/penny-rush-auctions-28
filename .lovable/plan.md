# Confirmação automática do PIX Magen com a tela fechada

## Objetivo
Todo PIX efetivamente pago no Banco Magen deve ser identificado e liberado automaticamente (lances, ativação, upgrade, pedido), mesmo que o cliente feche a tela — sem duplicidade e sem tocar na VeoPag.

## Causa atual
A recuperação depende só do agendador interno do banco, que está sobrecarregado ("job startup timeout", centenas de falhas/dia). Quando ele falha, a cobrança paga fica parada até alguém verificar manualmente (caso do Eduardo).

## O que será feito
1. **Disparo externo independente**: a recuperação passa a ser chamada também pelo cron-job.org (o mesmo já usado nos leilões), a cada 2 minutos, protegida por uma chave secreta. Se não houver cobrança pendente, a chamada termina na hora, sem custo relevante.
2. **Agendador interno continua como reserva**: nada é removido; os dois caminhos usam a mesma fila com trava, então uma cobrança nunca é processada duas vezes.
3. **Janela de busca**: cobranças pendentes das últimas 48h são verificadas no Magen; após o prazo ficam "em revisão" (sem baixa automática por suposição).
4. **Alerta de fila parada**: se houver cobrança paga/pendente sem verificação há mais de 10 minutos, aparece um aviso no painel admin (Status do Sistema).
5. **Teste real**: gerar cobrança, simular tela fechada, confirmar que a chamada externa libera o benefício uma única vez.

## O que NÃO muda
- Fluxo VeoPag, validações de valor/titular/identificador, trava anti-reuso de transação.
- As 59 cobranças antigas em revisão (conciliação por extrato fica para aprovação separada).
- Demais tarefas agendadas.

## O que você precisará fazer
- Cadastrar no cron-job.org o endereço e a chave que eu fornecer (1 minuto), ou me autorizar a usar a conta já configurada para os leilões.

## Detalhes técnicos
- `magen-recover-payments`: aceitar, além do `ticket` atual, header `x-cron-secret` comparado em tempo constante com novo secret `MAGEN_RECOVERY_CRON_SECRET` (gerado via secrets tool). Sem ticket/secret válido → 401.
- Fast path: `magenpay_claim_pending` vazio → retorna `{checked:0}` sem chamar `magenpay_refresh_recovery`.
- Alerta: RPC admin-only `magenpay_queue_health()` (pendentes com `next_retry_at` vencido > 10 min, último sucesso) consumida pela tela de status existente.
- Lease/`FOR UPDATE SKIP LOCKED` já existentes garantem exclusão mútua entre cron externo e interno.

# Caixa de Crédito de Confiança para Líderes

Uma carteira de crédito concedida pela empresa a líderes selecionados, usada **exclusivamente** para ativar parceiros indicados. O líder recebe o valor depois do prospecto e devolve à empresa via PIX.

## Como funciona

1. O admin concede um limite de crédito a um líder específico (valor e prazo de devolução em dias).
2. O líder vê no painel um card "Crédito de Confiança" com limite, saldo usado e disponível.
3. Ao ativar um indicado, ele escolhe a origem do pagamento: saldo próprio ou crédito de confiança.
4. Cada ativação com crédito gera uma **dívida** com data de vencimento.
5. O líder quita a dívida gerando um PIX no próprio painel; a confirmação é automática pelo webhook.
6. Enquanto houver dívida vencida: bloqueio de novos usos do crédito **e** bloqueio de solicitações de saque.

## Regras confirmadas

- O crédito é uma carteira separada — nunca entra em `available_balance`, não é sacável e não abate teto de recebimento.
- Devolução via PIX com prefixo próprio (`credit:{debt_id}`), roteado no webhook existente.
- Inadimplência bloqueia novos usos do crédito e saques do líder.
- Limite definido manualmente pelo admin, por líder (sem regra automática nesta fase).

## Escopo técnico

**Banco de dados (migration)**
- `partner_credit_lines`: user_id, limit_amount, used_amount, default_term_days, status (ACTIVE/SUSPENDED), notes. RLS: líder lê a própria; admin gerencia tudo.
- `partner_credit_debts`: credit_line_id, user_id, contract_id gerado, amount, due_date, status (OPEN/PAID/OVERDUE/WRITTEN_OFF), paid_at, payment_intent_id.
- `partner_credit_transactions`: histórico auditável (GRANT, USE, REPAYMENT, ADJUSTMENT).
- Função `partner_credit_available(user_id)` e `partner_credit_is_blocked(user_id)` (true se houver dívida vencida).
- GRANTs explícitos para authenticated/service_role em todas as tabelas.

**Backend**
- `sponsor-activate-partner`: novo parâmetro `paymentSource: 'balance' | 'credit'`. Com `credit`, valida limite disponível e bloqueio, debita a linha de crédito, cria a dívida e registra a transação (em vez de debitar `available_balance`). Todo o restante do fluxo (contrato, referrer real, lances bônus, intents) permanece idêntico.
- Nova função `partner-credit-repay`: gera cobrança PIX VeoPag com external_id `credit:{debt_id}`.
- `veopag-webhook`: nova rota para o prefixo `credit:` → marca dívida PAID, reduz `used_amount`, registra transação.
- Cron diário: marca dívidas vencidas como OVERDUE.
- Bloqueio de saque: validação em `partner_withdrawals` (RPC/edge de solicitação) usando `partner_credit_is_blocked`.

**Frontend**
- `SponsorActivateDialog`: seletor de origem do pagamento (saldo x crédito), com saldo/limite e aviso de prazo de devolução.
- Novo card no painel do parceiro: limite, disponível, dívidas em aberto com vencimento e botão "Devolver via PIX".
- Aba admin "Crédito de Confiança": conceder/ajustar limite, listar líderes com crédito, dívidas abertas/vencidas, baixa manual.

## Fora do escopo

- Sem juros, multa ou correção nesta fase.
- Sem desconto automático do repasse semanal (pode ser fase 2).
- Nenhuma alteração em regras de comissão, pontos de expansão ou teto — ativação por crédito gera exatamente os mesmos efeitos de uma ativação paga.

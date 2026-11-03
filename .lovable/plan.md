# Card "Saques" mostra só saques pagos

No painel do administrador, em Detalhes do Parceiro, o card "Saques" vai somar apenas os saques **pagos**.

- Valor principal: soma dos saques pagos. No caso do João Batista, R$ 11.100,47 (20 registros).
- Linha pequena embaixo: "X pendentes · R$ Y". Conta os saques aprovados ou pendentes que ainda não foram pagos. Só aparece quando existir algum.
- Saques recusados ou cancelados deixam de entrar na conta.
- A aba "Saques", com a lista completa, continua igual.

Nenhum outro card, cálculo de saldo ou regra muda.

## Detalhes técnicos
- `src/components/Admin/PartnerDetailModal.tsx`: `totalWithdrawals` filtra `status` PAID/paid. Novo `pendingWithdrawals` para PENDING/APPROVED (sem diferenciar maiúsculas). O contador do card passa a mostrar o número de pagos.

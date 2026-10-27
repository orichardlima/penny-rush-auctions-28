# Como os cadastros falsos foram ativados

## O que já foi confirmado no banco
- **Não foi pelo Painel do ADM.** Nenhum dos contratos falsos tem registro no histórico de ações dos administradores, e nenhum foi ativado por patrocinador.
- **Não houve pagamento real.** Os códigos de pagamento dos contratos são inventados: `fake-asaas-...`, `fake-diamond-...`, `fake-bypass-2026`, `pentest-diamond-upgrade-...`.
- **Como funcionou:** usando o próprio login, o atacante gravou direto no banco, sem passar pelo site:
  1. criou um "pedido de pagamento" de plano já marcado como **aprovado** (o sistema aceitava qualquer situação enviada pelo usuário);
  2. criou o próprio contrato já como **ATIVO / pago**, com saldo, bônus de lances e bônus de rede preenchidos à mão (ex.: R$ 999,99);
  3. pediu saques sobre esse contrato e marcou como "Pago".
- Os passos 2 e 3 funcionavam por causa da falha já corrigida no dia 26 (a trava de campos protegidos não valia). Hoje esses dois estão fechados e testados.

## O que ainda está aberto
- O "pedido de pagamento" (passo 1) **ainda pode ser criado pelo próprio usuário com qualquer situação**, inclusive "aprovado". Hoje isso não ativa nada sozinho, mas é uma porta que não deveria existir.
- O usuário ainda tem permissão de criar e editar o próprio contrato no banco (as travas impedem o abuso, mas a permissão continua lá).

## O que proponho fazer
1. **Pedido de pagamento:** o usuário só pode criar com situação "pendente"; só o sistema de pagamento (confirmação do PIX) ou admin muda para "aprovado".
2. **Contratos:** tirar do usuário a permissão de criar/editar contrato direto; contratos só nascem pela confirmação do PIX, pelo admin ou pela ativação por patrocinador (essas rotinas já rodam no servidor e não são afetadas).
3. **Varredura:** listar todos os pedidos "aprovados" e contratos ativos cujo código de pagamento não existe nos registros do provedor (VeoPag/Magen), para achar outros casos além das contas já bloqueadas. Só relatório, nada apagado.
4. **Teste como usuário comum:** tentar criar pedido aprovado e contrato → deve ser recusado; ativação normal via PIX e por patrocinador continua funcionando.

Nada é apagado; nenhum valor de parceiro legítimo é alterado.

## Detalhes técnicos
- `partner_payment_intents`: política INSERT atual só checa `auth.uid() = user_id`; adicionar trigger BEFORE INSERT/UPDATE que força `payment_status='pending'` para não-privilegiados (`_is_privileged_writer()`).
- `partner_contracts`: remover políticas "Users can create/update their own contracts" após confirmar que o frontend não faz insert/update direto (rg em `src/`); se fizer, mover para RPC SECURITY DEFINER.
- Varredura: cruzar `payment_id` de intents aprovados/contratos ACTIVE com `bot_webhook_logs`/registros de webhook; marcar suspeitos em relatório.

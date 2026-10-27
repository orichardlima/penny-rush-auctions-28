# Correção definitiva da fraude de contratos

## Como a fraude aconteceu (confirmado no banco)
- Não foi pelo Painel do ADM: nenhum contrato falso tem registro de ação de administrador nem de ativação por patrocinador.
- Não houve pagamento: os códigos são inventados (`fake-asaas-...`, `fake-diamond-...`, `fake-bypass-2026`, `pentest-diamond-upgrade-...`).
- O atacante, com o próprio login, gravou direto no banco: (1) pedido de pagamento já "aprovado"; (2) contrato já "ATIVO/pago" com saldo e bônus digitados; (3) saques marcados "Pago". Os passos 2 e 3 estão travados desde o dia 26; o passo 1 ainda está aberto.

## Fluxos legítimos conferidos no código
- Criação de pedido de pagamento: feita no servidor (rotina de pagamento de plano).
- Ativação por PIX confirmado e upgrades: feita no servidor (confirmação VeoPag).
- Ativação por patrocinador: feita no servidor.
- Ações do admin: pelo painel, com permissão de admin.
- O único ponto em que o próprio usuário grava no contrato pelo site: **atualizar chave PIX/dados bancários**.

## O que será feito
1. **Pedidos de pagamento**
   - Usuário comum deixa de poder criar ou editar pedidos direto no banco; só o servidor cria (sempre "pendente", com plano e valores lidos do cadastro de planos).
   - Qualquer tentativa de gravar status/valor por usuário comum é **recusada com erro** (não sobrescrita em silêncio).
   - Só a confirmação bancária no servidor ou o admin muda para "aprovado", com registro em auditoria.
2. **Contratos**
   - Removidas as permissões de criar e editar contrato pelo usuário comum.
   - Troca de chave PIX passa a usar uma rotina própria no servidor que só altera chave PIX e dados bancários do próprio contrato. Tela continua igual.
   - Trigger de proteção passa a recusar (erro) em vez de reverter em silêncio alterações de saldo, plano, status, bônus e valor por não-admin.
3. **Confirmações de pagamento**
   - Revisar `magen-webhook`, `magen-check-status`, `veopag-webhook` e `credit_purchase_bids`: só confirmam com pedido existente e pendente, valor igual, identificador único da transação.
   - Trava de duplicidade: o mesmo identificador de transação não pode confirmar dois pedidos/contratos/compras (índice único + checagem).
   - Sem mexer na integração Magen/VPS em si e sem movimentar dinheiro.
4. **Varredura histórica (só relatório)**
   - Desde o início: contratos ativos sem pagamento confiável, pedidos aprovados sem passagem pelo servidor, códigos inventados, contratos sem admin/patrocinador, e todos os bônus, repasses, pontos e saques derivados.
   - Classificação: comprovadamente fraudulento / suspeito / legítimo. Cruzamento com extratos dos provedores fica indicado onde não houver acesso.
   - Nada apagado, nada revertido.
5. **Testes com conta comum (API direta)**
   - Criar pedido aprovado; mudar pedido para pago; criar/ativar contrato; mexer em saldo/bônus; reaproveitar confirmação; criar saque fraudulento; virar admin → todos devem falhar.
   - Conferir que troca de chave PIX, cadastro, pagamento legítimo e ações de admin continuam funcionando.
6. **Entrega**: relatório com o que foi executado, permissões removidas, testes e pendências. Evidências de 25/10 preservadas.

## Detalhes técnicos
- `partner_payment_intents`: drop policy "Users can insert own intents"; manter SELECT próprio; trigger BEFORE INSERT/UPDATE que dá `RAISE EXCEPTION` se não `_is_privileged_writer()`.
- `partner_contracts`: drop "Users can create their own contracts" e "Users can update their own contracts"; nova RPC `partner_update_payment_details(contract_id, pix_key, pix_key_type, bank_details)` SECURITY DEFINER validando `auth.uid()` dono; `usePartnerWithdrawals.updateContractPaymentDetails` passa a chamar essa RPC.
- `protect_partner_contract_fields`: trocar revert por `RAISE EXCEPTION` para não-privilegiados.
- Índices únicos parciais em `payment_id` de intents/contratos/compras (após verificar duplicatas existentes, sem apagar).
- Edge functions de webhook: validar intent `pending`, valor e unicidade antes de creditar.

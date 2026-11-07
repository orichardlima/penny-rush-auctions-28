# Comprovantes de pagamento nos saques

## Minha sugestão
Cada saque pago ganha um comprovante guardado no próprio site. Assim, em caso de contestação, basta abrir o saque.

## O que muda para o administrador (aba Saques)
- Na coluna Ações, ao lado de "Pago em...", um botão **Anexar comprovante** (imagem ou PDF, até 5 MB; aceita colar print com Ctrl+V).
- Saque com comprovante mostra um ícone de clipe; clicar abre a visualização e permite baixar.
- Possível anexar mais de um arquivo (ex.: pagamento dividido) e excluir arquivo anexado por engano (fica registrado quem excluiu).
- Novo filtro: "Com comprovante / Sem comprovante", para achar saques pagos ainda sem prova.
- Ao marcar um saque como pago, o anexo aparece como opcional na mesma janela.

## O que muda para o parceiro
- Pergunta para você decidir: o parceiro pode ver o próprio comprovante no histórico de saques? Sugiro que sim — reduz as contestações. Se preferir, fica só para o administrador.

## Segurança
- Arquivos em pasta privada: só administradores (e, se aprovado, o dono do saque) abrem, por links temporários.
- Cada envio/exclusão registrado no histórico de auditoria; nada de pagamento, saldo ou status é alterado.
- O fluxo de aprovação e pagamento atual continua igual.

## Detalhes técnicos
- Bucket privado `withdrawal-receipts`, caminho `{withdrawal_id}/{arquivo}`.
- Tabela `partner_withdrawal_receipts` (withdrawal_id, file_path, mime, size, uploaded_by, deleted_at/by) com grants e RLS: admin total; parceiro só leitura dos próprios (opcional).
- Políticas em `storage.objects` espelhando a tabela; download via `createSignedUrl` (60s).
- UI: novo `WithdrawalReceiptDialog` usado na tabela de saques admin e, se aprovado, em `PartnerWithdrawalSection`.

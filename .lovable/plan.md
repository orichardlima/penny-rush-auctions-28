# Resumo simples da correção da fraude (27/10)

## O que aconteceu
O invasor criou contas falsas e, usando o próprio login, gravou direto no banco:
1. um pedido de pagamento já "aprovado" (com código inventado, ex.: `fake-diamond`);
2. um contrato de parceiro já "ativo", com saldo e bônus digitados;
3. saques já marcados como "Pago".

Não passou pelo painel do administrador nem por nenhum patrocinador.

## O que foi fechado hoje
- **Pedidos de pagamento**: o usuário não consegue mais criar nem alterar. Só o sistema cria.
- **Contratos**: o usuário não consegue mais criar nem mudar status, saldo, plano ou bônus. Antes o sistema desfazia em silêncio; agora recusa com erro.
- **Chave PIX**: o parceiro continua trocando a própria chave, por um caminho próprio que registra cada troca.
- **Pedidos de leilão**: o vencedor não consegue mais se marcar como "pago".
- **Crédito de lances**: ninguém mais consegue se dar lances de graça.
- **Confirmação do PIX (VeoPag)**: cada cobrança leva uma assinatura secreta. Aviso de pagamento sem essa assinatura é recusado. Um mesmo PIX não serve para confirmar duas compras.
- **Avisos antigos sem proteção** (Magen, Asaas e o antigo de parceiros): desligados.

## Testes feitos (com conta comum, sem alterar nada de verdade)
Todas as tentativas do invasor foram recusadas. A troca de chave PIX funcionou normalmente.

## Situação dos contratos
- 8 falsos comprovados: suspensos (R$ 184.999), nenhum saque pago.
- 4 sem comprovante: Tiago Prazeres, conta Administrador e 2 contas de teste. Nenhum saque pago. Precisam da sua conferência.
- 46 sem código do banco, mas com pedido aprovado ou registro de administrador: provavelmente legítimos, a conferir com o extrato.
- 9 com código do banco: normais.
Nada foi apagado e nenhum parceiro legítimo teve valor revertido.

## Cuidados agora
- PIX gerado **antes** da correção, se for pago, pode não ativar sozinho: confirme manualmente.
- Ainda falta conferir o valor pago direto na VeoPag.
- O caso Magen (R$ 3.069) segue em investigação, dependendo dos registros do banco e da VPS.

## Próximos passos possíveis (se aprovar, escolho um com você)
1. Listar os PIX antigos que podem precisar de confirmação manual.
2. Detalhar os 4 contratos sem comprovante.
3. Cruzar os 46 contratos com os extratos que você enviar.

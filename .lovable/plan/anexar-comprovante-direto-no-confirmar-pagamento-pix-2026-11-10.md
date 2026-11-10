# Anexar comprovante direto no "Confirmar Pagamento PIX"

## O que muda
No modal "Confirmar Pagamento PIX" entra o botão **Anexar comprovante**, logo acima de "Confirmar Pagamento Manual". Ele abre o mesmo anexador que já existe na lista de saques: imagem ou PDF até 5 MB, colar print (Ctrl/Cmd+V), vários arquivos.

Fluxo sugerido:
1. Copiar os dados e fazer o PIX no banco.
2. Colar o print do comprovante no modal.
3. Clicar em "Confirmar Pagamento Manual".

O modal mostra quantos comprovantes já foram anexados. O comprovante é opcional, então a confirmação continua funcionando sem ele.

## O que não muda
- A confirmação manual, o PIX automático MagenPay e os valores continuam iguais.
- O botão de comprovante na lista de saques continua lá.

## Detalhes técnicos
- Em `AdminPartnerManagement.tsx`, renderizar `<WithdrawalReceiptDialog withdrawalId={selected.id} />` no modal de confirmação (perto da linha 2100).
- A tabela e o bucket já aceitam saques APPROVED, então não é preciso mexer no banco.

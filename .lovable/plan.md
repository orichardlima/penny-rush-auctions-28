

# Teste da Integração MagenPay (após atualização do VPS_AUTH_TOKEN)

## O que será feito

Chamar a Edge Function `veopag-payment` via `curl_edge_functions` com dados de teste para verificar se o erro 401 foi resolvido e o QR Code PIX é gerado corretamente pela MagenPay.

## Passos

1. **Invocar `veopag-payment`** com um pacote real (ex: Pacote Iniciante, ID `879c4b1a-7250-43c3-82a5-8d5807733ffe`) e o usuário admin (`c793d66c-06c5-4fdf-9c2c-0baedd2694f6`)
2. **Verificar a resposta**: se retorna `pixCopyPaste`, `qrCodeBase64` e `purchaseId` — integração OK
3. **Se falhar**: consultar logs da edge function para diagnóstico

## Resultado esperado

- Status 200 com dados do PIX (em vez do erro 401 anterior)
- Log mostrando `✅ VPS proxy retornou:` no lugar de `❌ VPS proxy MagenPay falhou: 401`


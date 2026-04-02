
# Corrigir Integração MagenPay — Secret com Porta Errada

## Problema

Os logs mostram claramente:
```
💳 Enviando para VPS MagenPay: http://76.13.162.10:3000/pix/criar
```

A variável de ambiente `VPS_MAGEN_URL` está salva com a porta **3000** (antiga), sobrescrevendo o default do código que é **3333**. Por isso a requisição retorna 404 — o servidor na porta 3000 não tem o endpoint `/pix/criar`.

## Solução

### 1. Atualizar o secret `VPS_MAGEN_URL`

Atualizar o valor para: `http://76.13.162.10:3333`

### 2. Redeployar as Edge Functions

Após atualizar o secret, redeployar todas as funções que usam `magen-auth.ts`:
- `veopag-payment`
- `partner-payment`
- `order-pix-payment`
- `partner-upgrade-payment`
- `partner-regularize-payment`
- `magen-webhook`

### Nenhuma alteração de código necessária

O código em `magen-auth.ts` já está correto. O problema é exclusivamente o valor do secret.

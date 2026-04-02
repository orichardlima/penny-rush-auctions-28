

# Corrigir Erro 404 na URL do MagenPay

## Problema

O erro `Cannot POST /pagamento/pix/criar` indica que a variável de ambiente `VPS_MAGEN_URL` contém o valor antigo com `/pagamento` no path. A regex atual na linha 2 só remove `/pix...`, então o resultado fica `http://76.13.162.10:3333/pagamento` + `/pix/criar` = URL errada.

## Correção

### `supabase/functions/_shared/magen-auth.ts` (linha 2)

Atualizar a regex para também remover `/pagamento` do path:

```typescript
// De:
const VPS_BASE_URL = VPS_MAGEN_RAW.replace(/\/pix.*$/, '').replace(/\/$/, '')

// Para:
const VPS_BASE_URL = VPS_MAGEN_RAW.replace(/\/(pix|pagamento).*$/, '').replace(/\/$/, '')
```

### Redeploy

Redeployar todas as Edge Functions que importam `magen-auth.ts`:
- `veopag-payment`
- `partner-payment`
- `order-pix-payment`
- `partner-upgrade-payment`
- `partner-regularize-payment`
- `magen-webhook`

### Nenhum outro arquivo alterado


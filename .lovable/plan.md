

# Correção do webhook Asaas + crédito dos lances da Meriane

## Contexto confirmado

- Webhook configurado no painel Asaas (v3, URL correta)
- Meriane tem **6 compras pendentes** de 15 lances cada (total: 90 lances, R$90)
- Saldo atual: **0 lances**

## Mudanças

### 1. Adicionar `callbackUrl` na criação da cobrança (`supabase/functions/asaas-payment/index.ts`)

Na função `createPixCharge` (linha 67-74), adicionar o campo:
```
callbackUrl: "https://tlcdidkkxigofdhxnzzo.supabase.co/functions/v1/asaas-webhook"
```

Isso garante que cada cobrança individual notifique o endpoint correto, como redundância à configuração global.

### 2. Corrigir lances da Meriane (migration SQL)

Você confirmou que ela pagou. Vou atualizar as 6 compras para `completed` e creditar 90 lances no perfil:

```sql
UPDATE bid_purchases 
SET payment_status = 'completed' 
WHERE user_id = '56158a8e-29a5-405f-9c18-d10cbcb5db1d' 
  AND payment_status = 'pending';

UPDATE profiles 
SET bids_balance = bids_balance + 90, updated_at = now() 
WHERE user_id = '56158a8e-29a5-405f-9c18-d10cbcb5db1d';
```

### 3. Deploy da edge function

Deploy automático da `asaas-payment` após a edição.

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/asaas-payment/index.ts` | Adicionar `callbackUrl` na cobrança PIX |
| Migration SQL | Corrigir compras + saldo da Meriane |

## Pergunta importante

Todas as 6 compras da Meriane foram pagas? Ou apenas algumas? Se apenas algumas, me diga quais para eu creditar o valor correto.


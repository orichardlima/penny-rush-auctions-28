

# Correção definitiva: unificar processamento de webhooks

## Problema confirmado pelos logs

- `asaas-webhook`: **0 logs** -- nunca recebeu nenhuma notificação
- `partner-payment-webhook`: recebe TUDO, inclusive pagamentos de lances (pay_7g3icvoo46lnl9os com "Pacote Popular - 65 lances")
- Quando recebe pagamento de lances, cai no fallback "Payment not related to partner contracts, ignoring" e descarta

## Solução

Modificar o `partner-payment-webhook` para, quando não encontrar contrato de parceiro, verificar se é uma compra de lances (`bid_purchases`) e processá-la. Isso elimina a dependência de dois webhooks separados.

### Arquivo: `supabase/functions/partner-payment-webhook/index.ts`

Na função `processLegacyContractPayment`, no bloco onde o contrato não é encontrado (linha 164-167), em vez de apenas ignorar:

1. Buscar na tabela `bid_purchases` pelo `paymentId` ou `externalReference`
2. Se encontrar, processar a compra: atualizar status para `completed`, creditar lances no perfil, aprovar comissões de afiliado
3. Se não encontrar em nenhuma tabela, aí sim ignorar

Isso é essencialmente copiar a lógica de `processBidPurchase` do `asaas-webhook` para dentro do `partner-payment-webhook`.

### Correção manual: Richard Lima (pay_7g3icvoo46lnl9os)

Baseado nos logs, Richard Lima comprou "Pacote Popular - 65 lances" (R$50), pagou via PIX (status RECEIVED), mas os lances não foram creditados. Corrigir via migration SQL:

```sql
UPDATE bid_purchases SET payment_status = 'completed' 
WHERE payment_id = 'pay_7g3icvoo46lnl9os' AND payment_status = 'pending';

UPDATE profiles SET bids_balance = bids_balance + 65, updated_at = now() 
WHERE user_id = '18c062cb-1bd6-4889-b20f-c359da2f5971';
```

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/partner-payment-webhook/index.ts` | Adicionar fallback para processar `bid_purchases` quando não encontrar contrato |
| Migration SQL | Creditar 65 lances do Richard Lima |

## Resultado

- Um único webhook (`partner-payment-webhook`) processa tudo: parceiros, upgrades E compras de lances
- Não depende mais do `asaas-webhook` receber notificações (que nunca recebeu)
- Qualquer compra futura será processada automaticamente


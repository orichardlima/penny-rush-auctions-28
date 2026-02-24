
# Simplificar Edge Function para fluxo semi-automatico

## O que muda

A Edge Function `process-partner-withdrawal` sera simplificada para apenas marcar o saque como PAID no banco de dados e atualizar o contrato, sem chamar a API do Mercado Pago. O admin faz o PIX manualmente fora do sistema.

## Mudancas

### 1. Edge Function: `supabase/functions/process-partner-withdrawal/index.ts`

Remover toda a logica do Mercado Pago:
- Remover a verificacao do `MERCADO_PAGO_ACCESS_TOKEN`
- Remover o mapeamento de tipos de chave PIX para formato MP
- Remover a chamada `fetch` para `api.mercadopago.com`
- Remover o tratamento de resposta do Mercado Pago

Manter:
- Validacao de autenticacao admin
- Busca do withdrawal e verificacao de status APPROVED
- Atualizacao do withdrawal para PAID com `paid_at` e `paid_by`
- Atualizacao do `total_withdrawn` no contrato

O `payment_details` sera atualizado com `paid_via: 'manual'` em vez de dados do Mercado Pago.

### 2. Frontend: `src/hooks/useAdminPartners.ts`

Ajuste minimo na funcao `markWithdrawalAsPaid`:
- Atualizar a mensagem de sucesso de "PIX enviado com sucesso" para "Saque marcado como pago"
- Remover referencia ao `mp_transaction_id` no toast

### Nenhuma outra mudanca

- Interface visual do parceiro (`PartnerWithdrawalSection`) permanece identica
- Nenhum outro componente, hook ou pagina sera alterado

## Secao tecnica

**Edge Function -- antes:**
```text
1. Valida admin
2. Busca withdrawal (status=APPROVED)
3. Extrai dados PIX
4. Mapeia tipo chave -> formato MP
5. Chama API Mercado Pago (transaction-intents/process)
6. Trata resposta MP
7. Atualiza withdrawal -> PAID
8. Atualiza contrato total_withdrawn
```

**Edge Function -- depois:**
```text
1. Valida admin
2. Busca withdrawal (status=APPROVED)
3. Atualiza withdrawal -> PAID (paid_via: 'manual')
4. Atualiza contrato total_withdrawn
5. Retorna sucesso com dados PIX para o admin copiar
```

A resposta da funcao incluira os dados PIX do saque (`pix_key`, `pix_key_type`, `holder_name`, `amount`) para que o admin possa facilmente fazer o PIX manual.

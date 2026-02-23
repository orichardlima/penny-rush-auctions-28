

# Automatizar pagamento PIX de saques (semi-automatico)

## Como vai funcionar

```text
Parceiro solicita saque --> Admin clica "Pagar" --> Edge Function envia PIX via API MP --> Status atualizado automaticamente
```

O admin continua tendo controle (pode rejeitar ou aprovar), mas ao clicar "Pagar", o PIX e enviado automaticamente sem precisar fazer transferencia manual.

## Mudancas necessarias

### 1. Nova Edge Function: `process-partner-withdrawal`
Criar `supabase/functions/process-partner-withdrawal/index.ts` que:
- Recebe o `withdrawal_id` do admin autenticado
- Valida que o saque esta com status APPROVED
- Busca os dados PIX do saque (chave, tipo, valor)
- Chama a API do Mercado Pago (endpoint `POST /v1/transaction-intents/process`) para enviar o PIX
- Se o MP retornar sucesso: atualiza o saque para PAID e incrementa `total_withdrawn` no contrato
- Se falhar: mantem o status APPROVED e retorna o erro para o admin tentar novamente
- Registra o `transaction_id` do MP no campo `payment_details` do saque para rastreabilidade

### 2. Atualizar Admin UI: `src/components/Admin/AdminPartnerManagement.tsx`
- O botao "Marcar como Pago" passa a chamar a Edge Function ao inves de apenas atualizar o status no banco
- Adicionar feedback visual de loading enquanto o PIX esta sendo processado
- Mostrar mensagem de sucesso com o ID da transacao MP ou erro detalhado

### 3. Atualizar Hook: `src/hooks/useAdminPartners.ts`
- Modificar a funcao `markWithdrawalAsPaid` para invocar `supabase.functions.invoke('process-partner-withdrawal', ...)` ao inves de fazer update direto no banco
- Tratar erros retornados pela Edge Function (saldo insuficiente no MP, chave PIX invalida, etc.)

### 4. Configuracao: `supabase/config.toml`
- Adicionar `[functions.process-partner-withdrawal]` com `verify_jwt = false` (validacao manual no codigo)

## O que NAO muda

- Interface do parceiro para solicitar saque permanece identica
- Fluxo de rejeicao de saque permanece igual
- Historico de saques, dados de pagamento e calculo de saldo continuam inalterados
- Nenhuma outra tela ou funcionalidade e afetada

## Secao Tecnica

**API do Mercado Pago utilizada:**
- Endpoint: `POST https://api.mercadopago.com/v1/transaction-intents/process`
- Secret ja configurada: `MERCADO_PAGO_ACCESS_TOKEN`
- Formato do corpo da requisicao: inclui valor, chave PIX destino e referencia externa (withdrawal_id)

**Mapeamento de tipo de chave PIX:**
- CPF, CNPJ, email, telefone, chave aleatoria -- cada um tem um formato especifico na API do MP

**Tratamento de erros:**
- Saldo insuficiente na conta MP
- Chave PIX invalida ou inexistente
- Timeout/falha de rede (saque permanece APPROVED para retry)
- Resposta inesperada do MP (log detalhado para debug)

**Arquivos criados/modificados:**
1. `supabase/functions/process-partner-withdrawal/index.ts` (novo)
2. `supabase/config.toml` (adicionar config da nova funcao)
3. `src/hooks/useAdminPartners.ts` (alterar markWithdrawalAsPaid)
4. `src/components/Admin/AdminPartnerManagement.tsx` (ajustar botao e feedback)



## Eliminar rótulo "Parceria pendente de pagamento" quando contrato já está ATIVO

### Causa raiz (confirmada na inspeção)

`src/components/UserProfileCard.tsx` (linhas 95-144) busca o "indicador" assim:
1. Tenta `partner_contracts` filtrando `referred_by_user_id IS NOT NULL`.
2. Se não encontra, cai no fallback de `partner_payment_intents` e marca `pending: true`.

Quando um parceiro é ativado por **patrocinador via saldo** (`sponsor-activate-partner`) ou outros fluxos que não preenchem `referred_by_user_id` no contrato, a etapa 2 falha → cai no fallback 3 (intent antiga) → exibe "Parceria pendente de pagamento" mesmo o contrato estando ATIVO. Foi exatamente o caso do Luis Fernando.

A função `admin-confirm-pending-purchase` lida com `bid_purchases` (pacotes de lances), **não** com `partner_payment_intents` — então não precisa mudança. Removo do escopo.

### Correções a aplicar

#### 1. Frontend — `src/components/UserProfileCard.tsx`

Adicionar verificação prévia: se o usuário tem contrato ATIVO, **forçar `pending: false`** independente da fonte do indicador. Mudanças:

- Antes da query de `referralInfo`, já existe `partnerContract` (contrato ATIVO) na linha 32-43. Reutilizar.
- Quando o fallback de `partner_payment_intents` for acionado e o usuário já tiver contrato ATIVO, marcar `pending: false` (e idealmente `signupLink: true` para não exibir nada confuso). Resultado: o rótulo "Parceria pendente de pagamento" só aparece para usuários SEM contrato ativo.

#### 2. Edge Function — `supabase/functions/sponsor-activate-partner/index.ts`

Após criar o contrato ATIVO (passo 9, linha 207-223), adicionar:

```ts
// Marcar intents pendentes do usuário como aprovadas (evita órfãs)
await adminClient
  .from('partner_payment_intents')
  .update({ payment_status: 'approved' })
  .eq('user_id', referredUser.id)
  .eq('payment_status', 'pending');
```

Não acrescenta nenhum risco: apenas limpa o estado consistente após ativação bem-sucedida.

#### 3. Migration de limpeza one-shot

```sql
UPDATE partner_payment_intents ppi
SET payment_status = 'approved'
WHERE ppi.payment_status = 'pending'
  AND EXISTS (
    SELECT 1 FROM partner_contracts pc
    WHERE pc.user_id = ppi.user_id 
      AND pc.status = 'ACTIVE'
  );
```

Sincroniza os 7 registros órfãos identificados.

### Garantias

- **Nenhuma UI ou fluxo fora do escopo é tocado**.
- Fluxo VeoPag (`veopag-webhook`) já marca intents corretamente — não muda.
- A correção da UI é defensiva: mesmo que sobre uma intent órfã no futuro, o rótulo "pendente" não aparece se já houver contrato ATIVO.
- Migration é idempotente.

### Resultado esperado

- Luis Fernando e os outros 6 casos órfãos: o rótulo "Parceria pendente de pagamento" desaparece imediatamente após a migration.
- Novas ativações via patrocinador: intents pendentes são limpas automaticamente, sem deixar resíduo.
- UI passa a ser tolerante a qualquer inconsistência futura entre `partner_payment_intents` e `partner_contracts`.

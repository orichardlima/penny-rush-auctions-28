
## Plano: Corrigir Persistência de Dados de Pagamento PIX

### Problema Identificado

Ao cadastrar a chave PIX no formulário de "Dados de Pagamento", o usuário vê a mensagem de sucesso "Dados atualizados!", mas ao verificar novamente, aparece "Nenhum dado cadastrado".

**Causa Raiz:**
Os campos `pix_key`, `pix_key_type` e `bank_details` não estão sendo mapeados para o objeto `contract` no hook `usePartnerContract`. Embora os dados sejam buscados do banco (`select('*')`), eles são ignorados na construção do objeto retornado.

---

### Fluxo Atual (com bug)

```text
1. Usuário preenche PIX → updateContractPaymentDetails() → UPDATE OK no banco ✅
2. onRefresh() → refreshData() → fetchContract() → SELECT * OK ✅
3. fetchContract mapeia data → contractWithSponsor → IGNORA pix_key, pix_key_type ❌
4. PartnerWithdrawalSection recebe contract.pix_key = undefined ❌
5. UI mostra "Nenhum dado cadastrado" ❌
```

---

### Alterações Necessárias

#### 1. Atualizar Interface `PartnerContract` (usePartnerContract.ts)

Adicionar os campos de pagamento ao tipo:

```typescript
export interface PartnerContract {
  // ... campos existentes ...
  
  // Campos de pagamento PIX
  pix_key?: string | null;
  pix_key_type?: string | null;
  bank_details?: {
    holder_name?: string;
    bank_name?: string;
    agency?: string;
    account?: string;
  } | null;
}
```

---

#### 2. Mapear campos no `fetchContract` (usePartnerContract.ts)

Incluir os campos de pagamento na construção do objeto:

```typescript
const contractWithSponsor: PartnerContract = {
  id: data.id,
  user_id: data.user_id,
  plan_name: data.plan_name,
  // ... outros campos existentes ...
  referral_code: data.referral_code,
  sponsor_name: sponsorName,
  sponsor_plan_name: sponsorPlanName,
  
  // NOVOS - Campos de pagamento
  pix_key: data.pix_key || null,
  pix_key_type: data.pix_key_type || null,
  bank_details: data.bank_details || null,
};
```

---

#### 3. Remover Type Assertion desnecessário (PartnerDashboard.tsx)

Após a correção, o cast manual não será mais necessário:

**Antes:**
```tsx
const contractWithPix = contract as typeof contract & {
  pix_key?: string | null;
  pix_key_type?: string | null;
  bank_details?: any;
};
```

**Depois:**
```tsx
// Remover - contract já terá esses campos
// Usar contract diretamente
```

---

### Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/usePartnerContract.ts` | Adicionar `pix_key`, `pix_key_type`, `bank_details` ao tipo e mapeamento |
| `src/components/Partner/PartnerDashboard.tsx` | Remover type assertion desnecessário, usar `contract` diretamente |

---

### Fluxo Corrigido

```text
1. Usuário preenche PIX → updateContractPaymentDetails() → UPDATE OK ✅
2. onRefresh() → refreshData() → fetchContract() → SELECT * OK ✅
3. fetchContract mapeia TODOS os campos incluindo pix_key ✅
4. PartnerWithdrawalSection recebe contract.pix_key = "05311193514" ✅
5. UI mostra "PIX: 05311193514 | Tipo: cpf" ✅
```

---

### Seção Técnica

**Linhas a modificar em `usePartnerContract.ts`:**

Interface (linha ~19-38):
```typescript
export interface PartnerContract {
  id: string;
  user_id: string;
  plan_name: string;
  aporte_value: number;
  weekly_cap: number;
  total_cap: number;
  total_received: number;
  status: 'ACTIVE' | 'CLOSED' | 'SUSPENDED';
  closed_at: string | null;
  closed_reason: string | null;
  created_at: string;
  updated_at: string;
  bonus_bids_received: number;
  referred_by_user_id: string | null;
  referral_code: string | null;
  sponsor_name?: string | null;
  sponsor_plan_name?: string | null;
  // Campos de pagamento
  pix_key?: string | null;
  pix_key_type?: string | null;
  bank_details?: Record<string, any> | null;
}
```

Mapeamento (linhas ~140-158):
```typescript
const contractWithSponsor: PartnerContract = {
  id: data.id,
  user_id: data.user_id,
  plan_name: data.plan_name,
  aporte_value: data.aporte_value,
  weekly_cap: data.weekly_cap,
  total_cap: data.total_cap,
  total_received: data.total_received,
  status: data.status as 'ACTIVE' | 'CLOSED' | 'SUSPENDED',
  closed_at: data.closed_at,
  closed_reason: data.closed_reason,
  created_at: data.created_at,
  updated_at: data.updated_at,
  bonus_bids_received: data.bonus_bids_received || 0,
  referred_by_user_id: data.referred_by_user_id,
  referral_code: data.referral_code,
  sponsor_name: sponsorName,
  sponsor_plan_name: sponsorPlanName,
  // Campos de pagamento
  pix_key: data.pix_key || null,
  pix_key_type: data.pix_key_type || null,
  bank_details: data.bank_details || null,
};
```

**Linhas a modificar em `PartnerDashboard.tsx` (~421-426):**

Remover:
```tsx
// Extend contract with pix fields for WithdrawalSection
const contractWithPix = contract as typeof contract & {
  pix_key?: string | null;
  pix_key_type?: string | null;
  bank_details?: any;
};
```

Alterar uso de `contractWithPix` para `contract` onde for passado ao `PartnerWithdrawalSection`.



## Plano: Opção para Créditos Não Consumirem do Teto

### Objetivo
Adicionar uma opção no modal de crédito manual que permite ao administrador escolher se o valor creditado deve ou não consumir do teto total do parceiro (`total_cap`).

---

### Análise do Problema

**Situação Atual:**
- Quando um crédito manual é adicionado, a função `addManualCredit` sempre atualiza o `total_received` do contrato
- Isso faz com que o crédito avance a progressão do parceiro em direção ao seu teto máximo
- Resultado: créditos "extras" acabam reduzindo o espaço disponível para recebimentos futuros

**Solução:**
- Adicionar um novo campo `consumes_cap: boolean` na tabela `partner_manual_credits`
- Adicionar um Switch no modal para o admin escolher
- Modificar a lógica para só atualizar `total_received` quando `consumes_cap = true`

---

### Alterações Necessárias

#### 1. Migração do Banco de Dados

Adicionar coluna `consumes_cap` na tabela `partner_manual_credits`:

```sql
ALTER TABLE public.partner_manual_credits 
ADD COLUMN consumes_cap boolean NOT NULL DEFAULT true;
```

---

#### 2. Atualizar o Hook `useAdminPartners.ts`

**Modificar a assinatura da função:**

```tsx
const addManualCredit = async (
  contractId: string, 
  amount: number, 
  description: string,
  creditType: 'bonus' | 'correction' | 'compensation' | 'other',
  consumesCap: boolean = true  // novo parâmetro
)
```

**Ajustar a lógica de inserção:**

```tsx
// 1. Registrar o crédito manual com a flag consumes_cap
const { error: creditError } = await supabase
  .from('partner_manual_credits')
  .insert({
    partner_contract_id: contractId,
    amount,
    description: description.trim(),
    credit_type: creditType,
    created_by: user.id,
    consumes_cap: consumesCap  // novo campo
  });

// 3. Atualizar total_received APENAS se consumesCap = true
if (consumesCap) {
  const { error: updateError } = await supabase
    .from('partner_contracts')
    .update({
      total_received: contract.total_received + amount,
      updated_at: new Date().toISOString()
    })
    .eq('id', contractId);

  if (updateError) throw updateError;
}
```

---

#### 3. Atualizar o Modal em `AdminPartnerManagement.tsx`

**Novo estado:**

```tsx
const [creditConsumesCap, setCreditConsumesCap] = useState(true);
```

**Novo elemento no modal (após "Tipo de Crédito"):**

```tsx
{/* Consume Cap Option */}
<div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
  <div className="space-y-1">
    <Label htmlFor="consumes-cap" className="text-sm font-medium">
      Consome do teto do parceiro?
    </Label>
    <p className="text-xs text-muted-foreground">
      Se desativado, o valor será um bônus extra que não afeta a progressão do contrato.
    </p>
  </div>
  <Switch
    id="consumes-cap"
    checked={creditConsumesCap}
    onCheckedChange={setCreditConsumesCap}
  />
</div>
```

**Atualizar a chamada da função:**

```tsx
await addManualCredit(
  selectedContractForCredit.id, 
  amount, 
  creditDescription, 
  creditType,
  creditConsumesCap  // novo parâmetro
);
```

**Atualizar o warning dinâmico:**

```tsx
<div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
  <p className="text-xs text-amber-700">
    {creditConsumesCap ? (
      <>⚠️ Este valor será adicionado ao saldo disponível e <strong>consumirá do teto</strong> do parceiro.</>
    ) : (
      <>✅ Este valor será um <strong>bônus extra</strong> disponível para saque, sem afetar a progressão do contrato.</>
    )}
  </p>
</div>
```

**Reset do estado ao fechar:**

```tsx
// Ao abrir o dialog
setSelectedContractForCredit(contract);
setCreditAmount('');
setCreditType('bonus');
setCreditDescription('');
setCreditConsumesCap(true);  // reset para valor padrão
setIsCreditDialogOpen(true);
```

---

### Interface Visual Atualizada

```text
┌─────────────────────────────────────────────────────────────────────┐
│ 💳 Adicionar Crédito Manual                                         │
├─────────────────────────────────────────────────────────────────────┤
│ Parceiro: João Silva                                                │
│ Plano: Pro (R$ 1.500) | Saldo atual: R$ 450,00 / R$ 4.500,00        │
│                                                                     │
│ Valor do Crédito:                                                   │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ R$ [ 100,00 ]                                                 │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ Tipo de Crédito:                                                    │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ ○ Bônus Especial  ○ Correção/Ajuste                           │   │
│ │ ○ Compensação     ○ Outro                                     │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ Consome do teto do parceiro?                        [ ON/OFF] │   │
│ │ Se desativado, será um bônus extra.                           │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ Descrição/Motivo:                                                   │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ [ Bônus por atingir meta de indicações               ]        │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ ✅ Este valor será um BÔNUS EXTRA disponível para saque,            │
│    sem afetar a progressão do contrato.                             │
│                                                                     │
│                              [Cancelar]  [✅ Adicionar Crédito]     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Resumo das Alterações

| Componente | Arquivo | Alteração |
|------------|---------|-----------|
| **Banco** | Migration | Adicionar coluna `consumes_cap boolean DEFAULT true` |
| **Hook** | useAdminPartners.ts | Novo parâmetro `consumesCap` na função `addManualCredit` |
| **UI** | AdminPartnerManagement.tsx | Novo estado + Switch + warning dinâmico |

---

### Comportamento

| Opção | Consome Teto | Comportamento |
|-------|--------------|---------------|
| **ON** (padrão) | Sim | Atualiza `total_received`, avança progressão do contrato |
| **OFF** | Não | Apenas cria o payout PAID, saldo disponível para saque sem afetar teto |

---

### Seção Técnica

**Import a adicionar:**
```tsx
import { Switch } from '@/components/ui/switch';
```

**Migração SQL:**
```sql
-- Adicionar coluna consumes_cap na tabela partner_manual_credits
ALTER TABLE public.partner_manual_credits 
ADD COLUMN consumes_cap boolean NOT NULL DEFAULT true;

-- Comentário para documentação
COMMENT ON COLUMN public.partner_manual_credits.consumes_cap IS 
'Se true, o crédito consome do teto total do parceiro. Se false, é um bônus extra.';
```

**Atualização nos tipos TypeScript:**
A regeneração automática do Supabase adicionará `consumes_cap?: boolean` ao tipo.


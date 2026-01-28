

## Plano: Crédito Manual de Saldo para Parceiros

### Objetivo
Permitir que o administrador adicione créditos/saldo avulso manualmente para um parceiro específico, sem estar vinculado ao processamento semanal. Útil para correções, bônus especiais, ajustes e compensações.

---

### Análise do Sistema Atual

O saldo disponível do parceiro é calculado dinamicamente:

```
Saldo Disponível = Σ(Payouts PAID) - Σ(Withdrawals PENDING/APPROVED/PAID)
```

**Estratégia escolhida:** Criar um payout especial com tipo "MANUAL_CREDIT" que é automaticamente marcado como PAID, permitindo que o valor seja imediatamente disponibilizado para saque.

---

### Alterações Necessárias

#### 1. Criar Nova Tabela para Créditos Manuais

Criar tabela `partner_manual_credits` para registrar histórico de ajustes manuais:

```sql
CREATE TABLE public.partner_manual_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_contract_id uuid NOT NULL REFERENCES partner_contracts(id),
  amount numeric NOT NULL,
  description text NOT NULL,
  credit_type text NOT NULL DEFAULT 'bonus',
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('America/Sao_Paulo', now())
);

-- RLS Policies
ALTER TABLE partner_manual_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage manual credits"
  ON partner_manual_credits FOR ALL
  USING (is_admin_user(auth.uid()));

CREATE POLICY "Users can view their own credits"
  ON partner_manual_credits FOR SELECT
  USING (partner_contract_id IN (
    SELECT id FROM partner_contracts WHERE user_id = auth.uid()
  ));
```

---

#### 2. Interface na Gestão de Parceiros

**Arquivo: `src/components/Admin/AdminPartnerManagement.tsx`**

Adicionar novo botão na tabela de contratos e modal para inserir crédito:

```
┌─────────────────────────────────────────────────────────────────────┐
│ 💳 Adicionar Crédito Manual                                         │
├─────────────────────────────────────────────────────────────────────┤
│ Parceiro: João Silva                                                │
│ Plano: Pro (R$ 1.500) | Saldo atual: R$ 450,00                      │
│                                                                     │
│ Valor do Crédito:                                                   │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ R$ [ 100,00 ]                                                 │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ Tipo de Crédito:                                                    │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ ○ Bônus Especial                                              │   │
│ │ ○ Correção/Ajuste                                             │   │
│ │ ○ Compensação                                                 │   │
│ │ ○ Outro                                                       │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ Descrição/Motivo:                                                   │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ [ Bônus por atingir meta de indicações               ]        │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ ⚠️ Este valor será adicionado ao saldo disponível para saque do     │
│    parceiro imediatamente. Será registrado no log de auditoria.     │
│                                                                     │
│                              [Cancelar]  [✅ Adicionar Crédito]     │
└─────────────────────────────────────────────────────────────────────┘
```

---

#### 3. Hook para Gerenciar Créditos

**Arquivo: `src/hooks/useAdminPartners.ts`**

Adicionar nova função `addManualCredit()`:

```tsx
const addManualCredit = async (
  contractId: string, 
  amount: number, 
  description: string,
  creditType: 'bonus' | 'correction' | 'compensation' | 'other'
) => {
  setProcessing(true);
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Admin não autenticado');

    // 1. Registrar o crédito manual na nova tabela
    const { error: creditError } = await supabase
      .from('partner_manual_credits')
      .insert({
        partner_contract_id: contractId,
        amount,
        description,
        credit_type: creditType,
        created_by: user.id
      });

    if (creditError) throw creditError;

    // 2. Criar um payout PAID para disponibilizar o saldo imediatamente
    const today = new Date().toISOString().split('T')[0];
    const { error: payoutError } = await supabase
      .from('partner_payouts')
      .insert({
        partner_contract_id: contractId,
        period_start: today,
        period_end: today,
        calculated_amount: amount,
        amount: amount,
        status: 'PAID',
        paid_at: new Date().toISOString(),
        weekly_cap_applied: false,
        total_cap_applied: false
      });

    if (payoutError) throw payoutError;

    // 3. Atualizar total_received do contrato
    const contract = contracts.find(c => c.id === contractId);
    if (contract) {
      const { error: updateError } = await supabase
        .from('partner_contracts')
        .update({
          total_received: contract.total_received + amount,
          updated_at: new Date().toISOString()
        })
        .eq('id', contractId);

      if (updateError) throw updateError;
    }

    toast({
      title: "Crédito adicionado!",
      description: `R$ ${amount.toFixed(2)} creditado com sucesso.`
    });

    await Promise.all([fetchContracts(), fetchPayouts()]);
  } catch (error: any) {
    console.error('Error adding manual credit:', error);
    toast({
      variant: "destructive",
      title: "Erro ao adicionar crédito",
      description: error.message
    });
  } finally {
    setProcessing(false);
  }
};
```

---

#### 4. Componente de Modal

**Estados a adicionar em AdminPartnerManagement.tsx:**

```tsx
const [isCreditDialogOpen, setIsCreditDialogOpen] = useState(false);
const [selectedContractForCredit, setSelectedContractForCredit] = useState<any>(null);
const [creditAmount, setCreditAmount] = useState<number>(0);
const [creditType, setCreditType] = useState<string>('bonus');
const [creditDescription, setCreditDescription] = useState('');
```

**Botão na tabela de contratos:**

```tsx
<Button 
  variant="outline" 
  size="icon" 
  onClick={() => {
    setSelectedContractForCredit(contract);
    setIsCreditDialogOpen(true);
  }}
  title="Adicionar crédito manual"
>
  <Plus className="h-4 w-4" />
</Button>
```

---

### Fluxo de Funcionamento

1. Admin clica no botão de adicionar crédito no contrato desejado
2. Modal abre mostrando informações do parceiro
3. Admin insere valor, tipo e descrição
4. Sistema cria registro na tabela `partner_manual_credits`
5. Sistema cria um `partner_payout` com status PAID
6. Sistema atualiza `total_received` do contrato
7. Saldo fica imediatamente disponível para saque
8. Ação é registrada no audit log

---

### Resumo das Alterações

| Componente | Arquivo | Alteração |
|------------|---------|-----------|
| **Banco** | Migration | Nova tabela `partner_manual_credits` |
| **Hook** | useAdminPartners.ts | Nova função `addManualCredit()` |
| **UI** | AdminPartnerManagement.tsx | Novo botão + Dialog para crédito manual |

---

### Tipos de Crédito Disponíveis

| Tipo | Código | Uso |
|------|--------|-----|
| Bônus Especial | `bonus` | Recompensas por metas, promoções |
| Correção/Ajuste | `correction` | Correção de erros de cálculo |
| Compensação | `compensation` | Compensação por problemas/atrasos |
| Outro | `other` | Qualquer outro motivo |

---

### Segurança

- Apenas admins podem adicionar créditos manuais (RLS)
- Todas as operações são registradas na tabela de créditos
- Log de auditoria com admin responsável, valor e descrição
- Parceiro pode visualizar seu histórico de créditos recebidos

---

### Seção Técnica

**Imports a adicionar:**
```tsx
import { Coins, BadgePlus } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
```

**SQL da Migração:**
```sql
-- Tabela para créditos manuais
CREATE TABLE public.partner_manual_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_contract_id uuid NOT NULL,
  amount numeric NOT NULL,
  description text NOT NULL,
  credit_type text NOT NULL DEFAULT 'bonus',
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('America/Sao_Paulo', now()),
  
  CONSTRAINT partner_manual_credits_contract_fk 
    FOREIGN KEY (partner_contract_id) 
    REFERENCES partner_contracts(id) ON DELETE CASCADE
);

-- Índice para busca por contrato
CREATE INDEX idx_partner_manual_credits_contract 
  ON partner_manual_credits(partner_contract_id);

-- RLS
ALTER TABLE partner_manual_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage manual credits"
  ON partner_manual_credits FOR ALL
  USING (is_admin_user(auth.uid()));

CREATE POLICY "Users can view their own credits"
  ON partner_manual_credits FOR SELECT
  USING (partner_contract_id IN (
    SELECT id FROM partner_contracts WHERE user_id = auth.uid()
  ));
```

**Validação antes de adicionar:**
```tsx
// Verificar se contrato está ativo
if (contract.status !== 'ACTIVE') {
  toast.error('Apenas contratos ativos podem receber créditos');
  return;
}

// Verificar valor positivo
if (creditAmount <= 0) {
  toast.error('O valor deve ser maior que zero');
  return;
}

// Verificar descrição
if (!creditDescription.trim()) {
  toast.error('Informe o motivo do crédito');
  return;
}
```


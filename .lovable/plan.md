

## Plano: Admin Ativar Plano de Parceiro para Usuários

### Objetivo
Permitir que o administrador ative qualquer plano de parceria para um usuário diretamente, sem necessidade de pagamento. Isso dará controle total ao admin sobre quem tem acesso aos planos.

---

### Localização da Funcionalidade

A funcionalidade será adicionada na **Gestão de Usuários**, através de um novo botão de ação na linha do usuário selecionado (ao lado dos botões de saldo, bloqueio, senha, etc.).

```
┌────────────────────────────────────────────────────────────┐
│ 👤 Josilene Alves dos Anjos                                │
│ j.alves22@live.com           [🕐][🛒][$][🚫][🔒][🔑][🗑️][🎖️] │
│                                                   ↑ NOVO   │
└────────────────────────────────────────────────────────────┘
```

---

### Interface do Modal

Ao clicar no novo botão (ícone de `Crown` ou `Award`), abrirá um modal:

```
┌─────────────────────────────────────────────────────────┐
│ 🎖️ Atribuir Plano de Parceiro                           │
├─────────────────────────────────────────────────────────┤
│ Usuário: Josilene Alves dos Anjos                       │
│          j.alves22@live.com                             │
│                                                         │
│ ┌─ Status Atual ─────────────────────────────────────┐  │
│ │ ⚠️ Usuário não possui plano de parceria ativo      │  │
│ │    ou                                              │  │
│ │ ✅ Plano atual: Start (R$ 500,00)                  │  │
│ │    Status: ATIVO | Recebido: R$ 150,00             │  │
│ └────────────────────────────────────────────────────┘  │
│                                                         │
│ Selecione o Plano:                                      │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ○ Start   - R$ 500   (Teto: R$ 1.000)               │ │
│ │ ○ Pro     - R$ 1.500 (Teto: R$ 3.000)               │ │
│ │ ○ Elite   - R$ 3.000 (Teto: R$ 6.000)               │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Código de Indicação (opcional):                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ [ ABC123XY ]                                        │ │
│ └─────────────────────────────────────────────────────┘ │
│ 💡 Se informado, o usuário será vinculado ao sponsor    │
│                                                         │
│ ⚠️ Atenção: Esta ação criará um contrato de parceria    │
│    para o usuário sem necessidade de pagamento.         │
│    Será registrado no log de auditoria.                 │
│                                                         │
│                        [Cancelar]  [✅ Ativar Plano]    │
└─────────────────────────────────────────────────────────┘
```

---

### Fluxo de Funcionamento

1. **Verificar contrato existente**: Se o usuário já tem contrato ATIVO, mostrar opção de fazer upgrade ou informar que já possui
2. **Selecionar plano**: Admin escolhe qual plano ativar
3. **Código de indicação (opcional)**: Permite vincular a um sponsor existente
4. **Criar contrato**: Insere na tabela `partner_contracts` com todos os valores do plano
5. **Creditar bônus de lances**: Se o plano tiver `bonus_bids`, credita automaticamente
6. **Gerar código de referral**: Cria um código único para o novo parceiro
7. **Registrar no audit log**: Log completo da ação administrativa
8. **Processar bônus de indicação**: Se tiver código de referral, os triggers existentes processam os bônus em cascata

---

### Alterações Necessárias

#### 1. Arquivo: `src/components/AdminUserManagement.tsx`

**Adicionar:**
- Novo estado `isPlanDialogOpen`
- Novo estado `selectedPlanId`
- Novo estado `adminReferralCode` (código de indicação opcional)
- Novo estado `existingContract` (para verificar se usuário já tem contrato)
- Nova função `checkExistingContract()` para buscar contrato ativo
- Nova função `assignPlanToUser()` para criar o contrato
- Novo botão com ícone `Award` ou `Crown`
- Novo Dialog com seleção de plano e validações

**Imports a adicionar:**
```tsx
import { Award } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
```

**Novo estado:**
```tsx
const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
const [adminReferralCode, setAdminReferralCode] = useState('');
const [existingContract, setExistingContract] = useState<any>(null);
const [plans, setPlans] = useState<any[]>([]);
const [loadingPlans, setLoadingPlans] = useState(false);
```

**Função para buscar planos e contrato existente:**
```tsx
const checkUserPartnerStatus = async () => {
  setLoadingPlans(true);
  try {
    // Buscar planos ativos
    const { data: plansData } = await supabase
      .from('partner_plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    
    setPlans(plansData || []);
    
    // Verificar se usuário já tem contrato ativo
    const { data: contractData } = await supabase
      .from('partner_contracts')
      .select('*')
      .eq('user_id', user.user_id)
      .eq('status', 'ACTIVE')
      .maybeSingle();
    
    setExistingContract(contractData);
  } catch (error) {
    console.error('Error checking partner status:', error);
  } finally {
    setLoadingPlans(false);
  }
};
```

**Função para atribuir plano:**
```tsx
const assignPlanToUser = async () => {
  if (!selectedPlanId) return;
  
  const plan = plans.find(p => p.id === selectedPlanId);
  if (!plan) return;
  
  setLoading(true);
  try {
    // Verificar se já existe contrato ativo
    if (existingContract) {
      toast({
        title: "Erro",
        description: "Usuário já possui um contrato ativo. Encerre-o primeiro.",
        variant: "destructive"
      });
      return;
    }
    
    // Buscar sponsor se código informado
    let referredByUserId: string | null = null;
    if (adminReferralCode.trim()) {
      const { data: sponsorContract } = await supabase
        .from('partner_contracts')
        .select('user_id')
        .eq('referral_code', adminReferralCode.trim().toUpperCase())
        .eq('status', 'ACTIVE')
        .maybeSingle();
      
      if (sponsorContract && sponsorContract.user_id !== user.user_id) {
        referredByUserId = sponsorContract.user_id;
      }
    }
    
    // Gerar código de referral único
    const newReferralCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    
    // Criar contrato
    const { data: newContract, error: contractError } = await supabase
      .from('partner_contracts')
      .insert({
        user_id: user.user_id,
        plan_name: plan.name,
        aporte_value: plan.aporte_value,
        weekly_cap: plan.weekly_cap,
        total_cap: plan.total_cap,
        status: 'ACTIVE',
        referred_by_user_id: referredByUserId,
        referral_code: newReferralCode
      })
      .select()
      .single();
    
    if (contractError) throw contractError;
    
    // Creditar bônus de lances se existir
    if (plan.bonus_bids && plan.bonus_bids > 0) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('bids_balance')
        .eq('user_id', user.user_id)
        .single();
      
      const newBalance = (profileData?.bids_balance || 0) + plan.bonus_bids;
      
      await supabase
        .from('profiles')
        .update({ bids_balance: newBalance })
        .eq('user_id', user.user_id);
      
      await supabase
        .from('partner_contracts')
        .update({ bonus_bids_received: plan.bonus_bids })
        .eq('id', newContract.id);
    }
    
    // Registrar no audit log
    await logAdminAction(
      'partner_plan_assigned',
      null,
      { 
        plan_name: plan.name, 
        aporte_value: plan.aporte_value,
        referral_code: newReferralCode,
        sponsor: referredByUserId || 'none'
      },
      `Plano ${plan.display_name} atribuído pelo administrador. Valor: R$ ${plan.aporte_value}`
    );
    
    toast({
      title: "Plano ativado!",
      description: `${plan.display_name} foi ativado para ${user.full_name || user.email}`
    });
    
    setIsPlanDialogOpen(false);
    setSelectedPlanId(null);
    setAdminReferralCode('');
    onUserUpdated();
  } catch (error: any) {
    console.error('Error assigning plan:', error);
    toast({
      title: "Erro",
      description: error.message || "Erro ao ativar plano",
      variant: "destructive"
    });
  } finally {
    setLoading(false);
  }
};
```

**Novo botão na interface:**
```tsx
{/* Assign Partner Plan */}
<Dialog open={isPlanDialogOpen} onOpenChange={(open) => {
  setIsPlanDialogOpen(open);
  if (open) checkUserPartnerStatus();
}}>
  <DialogTrigger asChild>
    <Button variant="outline" size="sm" title="Atribuir plano de parceiro">
      <Award className="h-4 w-4" />
    </Button>
  </DialogTrigger>
  <DialogContent className="max-w-md">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">
        <Award className="h-5 w-5" />
        Atribuir Plano de Parceiro
      </DialogTitle>
      <DialogDescription>
        {user.full_name} ({user.email})
      </DialogDescription>
    </DialogHeader>
    
    {loadingPlans ? (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    ) : existingContract ? (
      <div className="space-y-4">
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-700">
            ✅ <strong>Plano atual:</strong> {existingContract.plan_name}
          </p>
          <p className="text-xs text-green-600 mt-1">
            Aporte: R$ {existingContract.aporte_value} | 
            Recebido: R$ {existingContract.total_received}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Para atribuir um novo plano, encerre o contrato atual primeiro na 
          área de Gerenciamento de Parceiros.
        </p>
      </div>
    ) : (
      <div className="space-y-4">
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-700">
            ⚠️ Usuário não possui plano de parceria ativo
          </p>
        </div>
        
        <div>
          <Label>Selecione o Plano</Label>
          <RadioGroup value={selectedPlanId || ''} onValueChange={setSelectedPlanId} className="mt-2">
            {plans.map(plan => (
              <div key={plan.id} className="flex items-center space-x-2 p-2 border rounded hover:bg-accent">
                <RadioGroupItem value={plan.id} id={plan.id} />
                <Label htmlFor={plan.id} className="flex-1 cursor-pointer">
                  <span className="font-medium">{plan.display_name}</span>
                  <span className="text-sm text-muted-foreground ml-2">
                    R$ {plan.aporte_value} (Teto: R$ {plan.total_cap})
                  </span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
        
        <div>
          <Label htmlFor="referral-code">Código de Indicação (opcional)</Label>
          <Input
            id="referral-code"
            value={adminReferralCode}
            onChange={(e) => setAdminReferralCode(e.target.value.toUpperCase())}
            placeholder="Ex: ABC123XY"
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Se informado, o usuário será vinculado ao sponsor correspondente
          </p>
        </div>
        
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-700">
            ⚠️ Esta ação criará um contrato sem necessidade de pagamento.
            Será registrado no log de auditoria.
          </p>
        </div>
        
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setIsPlanDialogOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={assignPlanToUser} disabled={loading || !selectedPlanId}>
            {loading ? 'Ativando...' : 'Ativar Plano'}
          </Button>
        </div>
      </div>
    )}
  </DialogContent>
</Dialog>
```

---

### Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/components/AdminUserManagement.tsx` | Novo modal, estados e função para atribuir plano |

---

### Funcionalidades Incluídas

| Funcionalidade | Status |
|----------------|--------|
| Verificar se usuário já tem plano ativo | ✅ |
| Listar planos disponíveis | ✅ |
| Selecionar plano via RadioGroup | ✅ |
| Código de indicação opcional | ✅ |
| Gerar código de referral único | ✅ |
| Creditar bônus de lances | ✅ |
| Registrar no audit log | ✅ |
| Processar bônus de indicação em cascata | ✅ (via trigger existente) |

---

### Segurança

- Apenas admins com acesso à Gestão de Usuários podem usar
- Todas as ações são registradas no audit log
- Validação de contrato existente impede duplicações
- Código de indicação é validado antes de vincular


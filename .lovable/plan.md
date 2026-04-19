

## Plano: Botão "Liberar Saque Emergencial" no painel admin

### Onde adicionar
Na lista de saques do painel admin (Parceiros e Afiliados), adicionar um botão **"Saque Emergencial"** ao lado do botão atual "Pagar". Este botão abre um dialog que permite ao admin criar um saque ignorando as restrições padrão.

### Restrições que o botão emergencial ignora
- ✅ Janela de horário (Segunda 8h-14h)
- ✅ Valor mínimo (R$ 100)
- ✅ Carência de 7 dias dos bônus PENDING (opção: antecipa para AVAILABLE)

### Restrições que **mantém** (segurança)
- ❌ Saldo total disponível (não pode sacar mais do que o usuário tem somando PENDING + AVAILABLE)
- ❌ Apenas admin pode acionar
- ❌ Justificativa obrigatória registrada em `admin_audit_log`
- ❌ Continua usando o gateway de pagamento normal (VeoPag/MagenPay)

### Componentes a criar/alterar

**1. Nova Edge Function: `admin-emergency-withdrawal`**
- Valida que o chamador é admin (via `is_admin_user`)
- Recebe: `userId` (parceiro ou afiliado), `type` ('partner' | 'affiliate'), `amount`, `pixKey`, `pixKeyType`, `holderName`, `reason`, `releasePendingBonuses` (boolean)
- Se `releasePendingBonuses=true`: atualiza `referral_bonuses` PENDING → AVAILABLE até cobrir o valor solicitado
- Cria registro em `partner_withdrawals` ou `affiliate_withdrawals` com status `APPROVED`, `fee_amount=0` (sem taxa em emergencial), `payment_details.emergency=true`, `payment_details.reason=...`
- Insere log em `admin_audit_log` com `action_type='emergency_withdrawal'` + justificativa
- **NÃO executa o pagamento** — admin ainda precisa clicar em "Pagar" depois (mantém o controle de liquidez)

**2. Novo componente: `EmergencyWithdrawalDialog.tsx`**
- Campos: valor, chave PIX, tipo de chave, nome do titular, justificativa (textarea obrigatória, mín. 20 caracteres), checkbox "Antecipar bônus pendentes"
- Mostra saldo atual (AVAILABLE) e bônus em carência (PENDING) do usuário
- Botão "Criar Saque Emergencial" chama a edge function

**3. Integração nos painéis admin**
- `PartnerDetailModal.tsx` (já existe): adicionar botão "Saque Emergencial" na seção financeira
- `AffiliateDetailModal.tsx` (já existe): adicionar botão equivalente

### Fluxo do admin
1. Admin abre detalhes do parceiro/afiliado
2. Clica em "Saque Emergencial"
3. Preenche valor, dados PIX, justificativa, marca se quer antecipar bônus
4. Sistema cria saque APPROVED + log de auditoria
5. Saque aparece na lista normal de pendentes
6. Admin clica em "Pagar" no saque para executar o PIX (fluxo normal já existente)

### Detalhes técnicos
- A edge function usa `SUPABASE_SERVICE_ROLE_KEY` para bypass de RLS na criação dos registros
- Validação Zod no body
- Justificativa obrigatória (mín. 20 chars) para evitar uso casual
- Sem alteração no fluxo de pagamento existente (`process-partner-withdrawal`) — só na criação do saque

### Fora de escopo
- Não altera o fluxo padrão de saque (parceiros continuam vendo as mesmas restrições)
- Não altera regras de saque em `system_settings`
- Não altera a UI do parceiro/afiliado

### Resultado esperado
Admin consegue, em qualquer dia/horário, criar um saque para um usuário que precisa do dinheiro com urgência, antecipando bônus em carência se necessário, com rastro de auditoria completo.


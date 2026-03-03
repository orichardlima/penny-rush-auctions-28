

## Adicionar Contrato de Participação (Termos do Parceiro)

### O que será feito

Antes de gerar o pagamento PIX, o usuário verá um modal/dialog com o texto completo do contrato de participação. Ele precisará marcar um checkbox "Li e aceito os termos do contrato" para prosseguir.

### Implementação

1. **Criar componente `PartnerContractTermsDialog`** (`src/components/Partner/PartnerContractTermsDialog.tsx`)
   - Dialog modal com scroll para o texto do contrato
   - Texto formatado com cláusulas (objeto, aporte, repasses, teto, encerramento, riscos, etc.)
   - Checkbox de aceite obrigatório
   - Botões "Cancelar" e "Aceitar e Continuar"
   - Recebe `plan` selecionado para exibir valores específicos no texto

2. **Integrar no `PartnerDashboard.tsx`**
   - Ao clicar "Participar deste plano", abre o dialog de termos primeiro (em vez de chamar `handlePlanSelect` direto)
   - Armazena o `planId` e `referralCode` pendentes em state
   - Só chama `handlePlanSelect` (gerando o PIX) após o aceite no dialog

3. **Texto do contrato**
   - Cláusulas padrão: objeto, valor do aporte, modelo de repasses, teto de recebimento, prazo, encerramento antecipado, riscos, política de privacidade
   - Valores dinâmicos do plano selecionado (aporte, teto, cap semanal)

### Arquivos alterados
- **Novo**: `src/components/Partner/PartnerContractTermsDialog.tsx`
- **Editado**: `src/components/Partner/PartnerDashboard.tsx` (adicionar state e dialog intermediário)

### Sem alterações em
- Nenhuma UI existente, fluxo de pagamento, backend ou banco de dados




## Adicionar Contrato do Apostador no Cadastro

### O que sera feito

Ao clicar "Cadastrar" no formulario de signup, antes de efetivamente criar a conta, um dialog modal aparecera com o contrato/termos do apostador. O usuario precisara marcar um checkbox de aceite para prosseguir com o cadastro.

### Implementacao

1. **Criar componente `BettorContractTermsDialog`** (`src/components/BettorContractTermsDialog.tsx`)
   - Dialog modal com ScrollArea para o texto do contrato
   - Clausulas especificas para apostadores: objeto da plataforma, funcionamento dos leiloes, lances, politica de reembolso, responsabilidades, riscos, privacidade
   - Checkbox obrigatorio "Li e aceito os termos"
   - Botoes "Cancelar" e "Aceitar e Cadastrar"

2. **Integrar no `Auth.tsx`** (aba signup)
   - Adicionar state `showBettorContract` (boolean)
   - No `handleSignUp`: apos `validateForm()` passar, em vez de chamar `signUp` direto, abrir o dialog de contrato
   - Criar `handleBettorContractAccept` que executa o signUp real (o codigo atual do handleSignUp apos validacao)
   - Se o usuario cancelar o dialog, nada acontece e ele volta ao formulario

### Arquivos
- **Novo**: `src/components/BettorContractTermsDialog.tsx`
- **Editado**: `src/pages/Auth.tsx` (state + dialog intermediario no signup)

### Sem alteracoes em
- Fluxo de login, reset de senha, backend, banco de dados, ou qualquer outra UI existente


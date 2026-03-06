

## Análise: Ativação pelo Admin preserva a indicação?

### Resposta curta: **Não automaticamente.**

O dialog "Atribuir Plano de Parceiro" do admin exige que o código de indicação seja **digitado manualmente** no campo "Código de Indicação". Ele **não preenche automaticamente** o código do Claudio Macedo (`Y0N62SC9`) mesmo que essa informação já exista no `partner_payment_intents`.

Se você ativar o Abraão sem preencher o campo e marcar "sem sponsor", ele entrará na rede **sem vínculo** com o Claudio.

### Correção proposta: Auto-preencher o código de indicação

Ao abrir o dialog de atribuição de plano, o sistema deve:

1. Consultar `partner_payment_intents` para verificar se o usuário tem um `referred_by_user_id` registrado (indicação pendente)
2. Se existir, buscar o `referral_code` do contrato ativo desse sponsor em `partner_contracts`
3. Preencher automaticamente o campo "Código de Indicação" com esse código e validá-lo

Assim, quando o admin abrir o dialog do Abraão, o campo já virá com `Y0N62SC9` preenchido e validado, garantindo que a indicação do Claudio seja preservada.

### Arquivo impactado
- **`src/components/AdminUserManagement.tsx`**: na função `checkUserPartnerStatus`, adicionar consulta ao `partner_payment_intents` e auto-preenchimento do campo `adminReferralCode`


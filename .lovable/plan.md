

# Validação do Fluxo de Pagamento de Plano de Parceiro

## Resultado: Fluxo está correto

Após análise detalhada do código, o fluxo de pagamento do parceiro está funcionando corretamente:

### Fluxo atual (correto):

1. **Usuário vê os planos** -- `PartnerDashboard.tsx` renderiza `PartnerPlanCard` para cada plano disponível
2. **Usuário clica "Participar deste plano"** -- chama `handlePlanSelectWithTerms(planId, referralCode)`
3. **Dialog de termos abre** -- `PartnerContractTermsDialog` exibe o contrato com detalhes do plano selecionado, exige aceite via checkbox
4. **Usuário aceita termos** -- `handleContractAccepted()` chama `handlePlanSelect(planId)` que invoca `createContract(planId, referralCode)`
5. **Edge Function `partner-payment`** -- valida plano, cria `partner_payment_intent`, gera cobrança PIX no Asaas, retorna QR Code
6. **Modal PIX abre** -- `PartnerPixPaymentModal` exibe QR Code e monitora pagamento via realtime
7. **Webhook confirma pagamento** -- cria contrato `ACTIVE` na tabela `partner_contracts`

### Bug anterior (já corrigido):
- O `useEffect` que auto-abria o dialog de contrato quando `preselectedPlanId` estava presente na URL foi removido na correção anterior
- Agora o plano pré-selecionado apenas recebe destaque visual (`ring-2 ring-primary`)

### Pontos verificados:
- O plano correto é passado ao `PartnerContractTermsDialog` via `plans.find(p => p.id === pendingPlanId)` (linha 487)
- A Edge Function valida o plano pelo `planId` enviado, não usa valores hardcoded
- O modal PIX recebe `planName` e `aporteValue` diretamente do response da Edge Function
- Não há mais auto-abertura de dialog ou modal

### Limitação do teste E2E:
Não foi possível executar teste automatizado porque o fluxo requer autenticação + integração com Asaas (pagamento real). A validação foi feita por análise estática do código.

### Recomendação:
Teste manual recomendado:
1. Faça login na plataforma
2. Acesse `/minha-parceria`
3. Verifique que os 3 planos são exibidos sem nenhum modal automático
4. Clique em qualquer plano e confirme que o dialog de termos mostra o plano correto
5. Aceite os termos e confirme que o PIX gerado corresponde ao valor do plano escolhido


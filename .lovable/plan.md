

# Corrigir discrepância de indicação no PartnerDetailModal

## Problema
O `UserProfileCard` mostra "Indicado por Luis Paulo" (correto — encontrado via `affiliate_referrals`), mas o `PartnerDetailModal` mostra "Sem indicação" porque só verifica `partner_contracts.referred_by_user_id`, que está NULL para esse parceiro.

O Rafael foi indicado como **afiliado** pelo Luis Paulo, mas quando se tornou parceiro, o campo `referred_by_user_id` do contrato não foi preenchido.

## Solução

Adicionar fallbacks no `PartnerDetailModal` para buscar a indicação em outras fontes, assim como o `UserProfileCard` já faz:

### Alteração em `src/components/Admin/PartnerDetailModal.tsx`

Na seção de busca do patrocinador (linhas 58-73), adicionar fallbacks na seguinte ordem:

1. **Manter**: `partner_contracts.referred_by_user_id` (fonte principal)
2. **Novo fallback**: `partner_payment_intents.referred_by_user_id` (intenção de pagamento pendente)
3. **Novo fallback**: `affiliate_referrals` onde `referred_user_id = contract.user_id` e `converted = true` (indicação de afiliado)

Se encontrar via afiliado, mostrar o nome do afiliado, o código de afiliado e a data — com um label diferenciado tipo "Indicação de Afiliado".

Nenhuma outra funcionalidade será alterada.


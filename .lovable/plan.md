
O usuário pergunta sobre o status da implementação do **Gerente de Afiliados** (Manager/Influencer hierarchy). Pela memória `mem://features/affiliate/manager-influencer-hierarchy` e pelo código existente, há bastante coisa pronta. Vou investigar o estado atual antes de responder.

Pelo que já vejo no código (`useAffiliateManager.ts`):
- Tabela `affiliate_managers` existe com RLS completa (admin, manager, influencer policies)
- Hook `useAffiliateManager` para gerentes (vincular/desvincular influencers, stats)
- Hook `useAdminAffiliateManagers` para admin (promover, vincular, taxa override)
- Coluna `role` em `affiliates` (`affiliate` / `manager` / `influencer`)
- Coluna `recruited_by_affiliate_id`
- Setting `affiliate_default_override_rate`

Preciso verificar:
1. Se há UI consumindo esses hooks (telas para gerente e admin)
2. Se a comissão de override está sendo calculada/paga em algum lugar (webhook, trigger)
3. Quantos managers/influencers existem hoje no banco
4. Se há alguma pendência conhecida



# Preencher automaticamente referred_by_user_id via affiliate_referrals

## Problema
Quando um afiliado indica alguém que depois se torna parceiro, o campo `referred_by_user_id` no `partner_contracts` fica NULL porque o sistema só busca patrocinadores em `partner_contracts` (código de referência de parceiro) e em intents/contratos anteriores. A indicação de afiliado (`affiliate_referrals`) nunca é consultada.

## Solução
Adicionar um fallback final nas duas edge functions que determinam o patrocinador, buscando na tabela `affiliate_referrals` (via `affiliates`) quando nenhum patrocinador é encontrado pelas fontes atuais.

## Alterações

### 1. `supabase/functions/partner-payment/index.ts`
Após o bloco de fallback existente (linha ~143), adicionar busca em `affiliate_referrals`:

```
if (!referredByUserId) {
  const { data: affiliateRef } = await supabase
    .from('affiliate_referrals')
    .select('affiliate_id, affiliates!inner(user_id)')
    .eq('referred_user_id', userId)
    .eq('converted', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (affiliateRef?.affiliates?.user_id) {
    referredByUserId = affiliateRef.affiliates.user_id
  }
}
```

### 2. `supabase/functions/sponsor-activate-partner/index.ts`
Mesmo fallback após o bloco existente (linha ~138), usando `referredUser.id` e `adminClient`:

```
if (!actualReferrerId) {
  const { data: affiliateRef } = await adminClient
    .from('affiliate_referrals')
    .select('affiliate_id, affiliates!inner(user_id)')
    .eq('referred_user_id', referredUser.id)
    .eq('converted', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (affiliateRef?.affiliates?.user_id) {
    actualReferrerId = affiliateRef.affiliates.user_id
  }
}
```

Nenhuma alteração de banco de dados ou UI necessaria. Apenas as duas edge functions são modificadas.


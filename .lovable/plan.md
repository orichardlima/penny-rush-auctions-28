

# Remover restrição de parceiro para programa de afiliados

## Problema

O componente `AffiliateOnboarding.tsx` verifica se o usuário tem um contrato de parceiro ativo (`partner_contracts` com status `ACTIVE`). Se não tiver, bloqueia o acesso ao programa de afiliados com uma tela de "acesso negado".

## Solução

Remover toda a lógica de verificação de contrato ativo. Qualquer usuário autenticado poderá ativar sua conta de afiliado diretamente.

## Alteração

**Arquivo**: `src/components/Affiliate/AffiliateOnboarding.tsx`

- Remover o state `hasActiveContract` e `checking`
- Remover o `useEffect` que consulta `partner_contracts`
- Remover o bloco de loading ("Verificando elegibilidade...")
- Remover o bloco de acesso negado (ícone de cadeado + "plano de expansão ativo")
- Manter apenas o retorno com o onboarding (benefícios + botão de ativação) — que hoje é mostrado só para quem tem contrato ativo, passará a ser mostrado para todos
- Remover imports não utilizados (`useEffect`, `useState`, `Lock`, `useNavigate`, `supabase`)

O resultado é um componente simples que sempre mostra a tela de onboarding com o botão "Ativar Minha Conta de Afiliado Grátis".


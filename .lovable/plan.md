

## Plano: Mostrar "Indicado por quem" no UserProfileCard

### Problema
O card de perfil do usuário (visível pelo admin) não mostra quem indicou/referiu aquele usuário. A informação existe no banco mas não é exibida.

### Fontes de dados de indicação

1. **Afiliados** (`affiliate_referrals`): quando o usuário se cadastrou via link `?ref=CODIGO`, existe um registro com `referred_user_id = userId` e o `affiliate_id` do indicador.
2. **Parceiros** (`partner_contracts`): campo `referred_by_user_id` indica o patrocinador.

### O que será feito

**1. Novo hook ou query no `UserProfileCard`**
- Buscar em `affiliate_referrals` se existe registro com `referred_user_id = userId`
- Se sim, trazer o nome do afiliado (via `affiliates` → `profiles`) e o código
- Buscar também em `partner_contracts` se existe `referred_by_user_id` preenchido
- Exibir a informação combinada

**2. Exibição no card**
- Adicionar uma seção "Indicado por" logo abaixo do badge de classificação ou nas estatísticas detalhadas
- Mostrar: nome do indicador, código de afiliado, e data da indicação
- Se não foi indicado por ninguém: exibir "Cadastro direto (sem indicação)"

### Arquivos impactados
- **`src/components/UserProfileCard.tsx`**: adicionar query de referral e seção visual
- Nenhuma alteração de banco necessária — dados já existem


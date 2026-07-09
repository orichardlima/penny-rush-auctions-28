## Problema

No painel `/admin/central-performance`, a coluna "Parceiro" do ranking está mostrando:

- **"—"** como nome
- Código truncado do UUID, ex: `9634ea5f`, `d0d960ff`

Isso acontece porque a tabela `profiles` dos parceiros em questão está com `full_name` e `email` vazios. O frontend só consegue ler `profiles`, então ele acaba exibindo o UUID como identificador.

## Objetivo

Deixar o painel mais didático para o administrador, mostrando o **identificador real do parceiro** (nome, e-mail ou código de afiliado) e nunca o UUID puro.

## Solução técnica

Criar uma função segura no banco (`admin_get_partner_display_names`) que, com permissão de admin, busque os dados reais de identificação em várias fontes:

1. `profiles.full_name`
2. `auth.users.email`
3. `affiliates.affiliate_code`
4. `partner_contracts.referral_code`

O frontend usará essa função para enriquecer as linhas do ranking e da elegibilidade, com fallback didático:

**Nome completo → E-mail → Código de afiliado → "Parceiro não identificado"**

## Passos de implementação

### 1. Migration — RPC de identificação do parceiro

Criar a função `admin_get_partner_display_names(partner_ids uuid[])`:

- `SECURITY DEFINER`, pois precisa ler `auth.users`.
- Verifica se o chamador é admin via `profiles.is_admin`.
- Retorna: `id`, `full_name`, `email`, `affiliate_code`, `referral_code`, `display_name` (campo calculado com o melhor nome disponível).

### 2. Atualizar `src/hooks/useAdminPerformance.ts`

- Após buscar os `partner_user_id` do ranking e da elegibilidade, chamar a nova RPC.
- Preencher `full_name`, `email` e `display_name` nos objetos de ranking e elegibilidade.

### 3. Atualizar `src/pages/AdminCentralPerformance.tsx`

- Na coluna "Parceiro", exibir o `display_name`.
- Mostrar o e-mail ou código de afiliado como subtítulo, quando útil.
- Adicionar tooltip explicando a origem do nome ("Nome do perfil", "E-mail do cadastro", "Código de afiliado").
- Substituir todas as exibições de `partner_user_id.slice(0, 8)` por identificadores reais.
- Manter o UUID completo disponível apenas em tooltip ou em uma coluna técnica opcional, se necessário.

### 4. Melhorias didáticas no painel

- Adicionar legenda explicando o que é cada KPI e cada aba.
- Incluir badge explicativo na coluna "Parceiro": "Identificador real quando disponível".
- Garantir que linhas sem identificador mostrem "Parceiro não identificado" em vez de código.

### 5. Validação

- Rodar a RPC diretamente no SQL Editor para confirmar que retorna nome/e-mail/código reais para os parceiros da screenshot.
- Verificar no painel que o ranking mostra:
  - Nome real quando existir
  - E-mail quando nome não existir
  - Código de afiliado quando não houver nome nem e-mail
  - Nunca mais um UUID truncado como identificador principal

## O que não será alterado

- Nenhuma mudança na regra de pontuação, elegibilidade ou modo relatório.
- Nenhuma conexão com payout, binário ou comissões.
- As tabelas e flags `performance_tracking_enabled` / `performance_center_enabled` permanecem iguais.

## Resultado esperado

O administrador abre `/admin/central-performance` e vê imediatamente quem é cada parceiro no ranking, sem precisar decifrar códigos UUID.
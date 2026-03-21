

# Restringir programa de afiliados para usuários com plano Legend ativo

## Situação atual

- Todo usuário recebe uma conta de afiliado automaticamente via trigger `handle_new_user`
- O `AffiliateDashboard` exibe um botão "Ativar Minha Conta de Afiliado" caso não exista registro
- Não há nenhuma verificação de plano de parceiro

## O que muda

Somente usuários com um contrato de parceiro **Legend** (`plan_name = 'Legend'`) com status **ACTIVE** poderão ter conta de afiliado. Os demais verão uma mensagem informando que precisam do plano Legend.

## Mudanças

### 1. Remover criação automática de afiliado no trigger `handle_new_user`

**Migration SQL**: Recriar a função `handle_new_user` removendo o bloco que insere na tabela `affiliates` (linhas 211-220 da versão atual). O afiliado será criado apenas sob demanda quando o usuário tiver plano Legend.

### 2. Atualizar `AffiliateDashboard.tsx` -- tela de onboarding

Quando `affiliateData` é `null`:
- Verificar se o usuário possui `partner_contracts` com `plan_name = 'Legend'` e `status = 'ACTIVE'`
- **Se sim**: mostrar o botão "Ativar Conta de Afiliado" (fluxo atual)
- **Se não**: mostrar mensagem informativa dizendo que o programa de afiliados é exclusivo para parceiros Legend, com botão para ir à página `/minha-parceria`

### 3. Corrigir `affiliateHelpers.ts` -- status do insert

Alterar `status: 'active'` para `status: 'pending'` no insert (linha 77), alinhando com a política RLS que exige `status = 'pending'`.

Criar uma migration com trigger `AFTER INSERT ON affiliates` que auto-aprova o afiliado (seta `status = 'active'`) via `SECURITY DEFINER`, garantindo ativação imediata sem violar RLS.

### 4. Ajustar RLS da tabela `affiliates` (opcional)

A política de INSERT atual já exige `status = 'pending'`. Com a mudança no passo 3, o fluxo ficará alinhado.

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| Nova migration SQL | Remover criação de afiliado do `handle_new_user`; criar trigger auto-approve |
| `src/pages/AffiliateDashboard.tsx` | Adicionar verificação de plano Legend antes de mostrar botão de ativação |
| `src/utils/affiliateHelpers.ts` | Mudar `status: 'active'` para `status: 'pending'` |




# Adicionar informação do patrocinador no PartnerDetailModal

## Problema
O modal de detalhes do parceiro não mostra quem indicou/patrocinou aquele parceiro. Os dados já existem no banco (`partner_contracts.referred_by_user_id` e `partner_contracts.referral_code`), mas não são exibidos.

## Solução

Adicionar uma seção "Indicado por" no `DialogDescription` do modal, logo abaixo das informações atuais (plano, aporte, data de ativação).

### Implementação em `src/components/Admin/PartnerDetailModal.tsx`

1. **Novo estado**: `sponsorInfo` para armazenar nome e dados do patrocinador
2. **Nova query no `fetchData`**: Se `contract.referred_by_user_id` existir, buscar o nome do patrocinador na tabela `profiles` e o contrato correspondente em `partner_contracts`
3. **Nova seção visual**: Card compacto entre o `DialogDescription` e os summary cards, mostrando:
   - Nome do patrocinador (com ícone de usuário)
   - Código de referência utilizado (`contract.referral_code`)
   - Data da indicação (data de criação do contrato)
   - Se não houver patrocinador: exibir "Sem indicação" discretamente

### Dados utilizados
- `contract.referred_by_user_id` → buscar `profiles.full_name` onde `user_id = referred_by_user_id`
- `contract.referral_code` → já disponível no objeto contract
- `contract.created_at` → data da indicação

Nenhuma alteração de banco de dados necessária. Apenas mudanças no componente React.


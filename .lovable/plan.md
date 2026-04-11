

# Corrigir busca do patrocinador no PartnerDetailModal

## Problema
A query na linha 63 usa `.eq('id', ...)` quando deveria usar `.eq('user_id', ...)`. O campo `referred_by_user_id` armazena o `user_id` do patrocinador, mas a busca compara com `profiles.id` (que é diferente de `profiles.user_id`), resultando em "Usuário desconhecido".

## Solução

| Arquivo | Alteração |
|---|---|
| `src/components/Admin/PartnerDetailModal.tsx` | Linha 63: trocar `.eq('id', contract.referred_by_user_id)` por `.eq('user_id', contract.referred_by_user_id)` |

Correção de uma única linha. Nenhuma outra funcionalidade é afetada.


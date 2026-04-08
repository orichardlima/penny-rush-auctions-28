

# Fix build error + Sistema de contatos dos indicados para afiliados

## Parte 1: Fix do build error (SystemSettings.tsx)

Na linha 315 do `SystemSettings.tsx`, o corpo da função `saveAutoReplenish` perdeu sua declaração durante a edição anterior. Falta a linha:

```typescript
const saveAutoReplenish = async () => {
```

**Correção**: Inserir a declaração da função na linha 315, antes do `setSavingAutoReplenish(true)`.

---

## Parte 2: Contatos dos indicados para afiliados

### Conceito

Permitir que o afiliado veja dados de contato (nome, email, telefone) dos seus indicados cadastrados, facilitando remarketing e follow-up. Os dados são exibidos na lista de indicados existente (`AffiliateReferralsList`).

### Segurança

Os dados de contato (email, phone) estão protegidos por RLS na tabela `profiles`. A RPC `get_public_profiles` atual retorna apenas `full_name` e `avatar_url`. Para expor contato **apenas para o afiliado dono da indicação**, será criada uma nova RPC `get_affiliate_referral_contacts` com `SECURITY DEFINER` que:

1. Recebe o `affiliate_id` e lista de `user_ids`
2. Valida que o `auth.uid()` é dono do `affiliate_id`
3. Verifica que cada `user_id` está na tabela `affiliate_referrals` daquele afiliado
4. Retorna `full_name`, `email`, `phone`

### Alterações

1. **Migration**: Criar RPC `get_affiliate_referral_contacts(affiliate_id, user_ids)` que retorna nome, email e telefone apenas dos indicados do afiliado autenticado.

2. **AffiliateReferralsList.tsx**: Adicionar colunas de email e telefone (com ícones de cópia e link WhatsApp). Usar a nova RPC em vez de `get_public_profiles` para buscar dados enriquecidos. Em mobile, os contatos ficarão em um botão expansível para não sobrecarregar a tabela.

3. **types.ts**: Será atualizado automaticamente pela Supabase após a migration.

### Dados exibidos por indicado

| Campo | Origem | Visível quando |
|---|---|---|
| Nome | `profiles.full_name` | Sempre (já existe) |
| Email | `profiles.email` | Indicado cadastrado |
| Telefone | `profiles.phone` | Indicado cadastrado e preencheu |

### Fluxo

1. Afiliado abre "Seus Indicados"
2. Para indicados cadastrados, vê nome + email + telefone
3. Pode copiar email/telefone com um clique
4. Botão de WhatsApp abre chat direto (se telefone disponível)


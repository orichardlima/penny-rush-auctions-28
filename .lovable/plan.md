

# Creditar indicações de Luis Paulo Mota para 3 usuários

## Estado atual no banco

| Usuário | user_id | Referral p/ Luis Paulo | Purchases | Comissões pendentes |
|---|---|---|---|---|
| **Adriana Barreto** | `264055be` | Existe (não convertido) | 4 pending, 0 completed | Nenhuma |
| **Deivide Araújo** | `75a0a41b` | Existe (não convertido) | 2 pending, 0 completed | 2 pendentes |
| **Meriane de Sousa** | `56158a8e` | **Não existe** | 6 completed | 6 pendentes |

**Luis Paulo Mota** - affiliate_id: `92e39f3b`, taxa: 50% (1ª compra), 10% (recompra)

## Ações (via SQL insert tool)

### 1. Marcar 1 compra de cada como `completed` (Adriana e Deivide)
- Adriana: `cffc1160` → completed
- Deivide: `51ce2d60` → completed

### 2. Criar referral para Meriane
- Inserir `affiliate_referrals` com affiliate_id de Luis Paulo, referred_user_id da Meriane, converted=true, click_source='manual_admin_link'

### 3. Marcar referrals existentes como convertidos
- Adriana e Deivide: UPDATE converted=true

### 4. Criar comissões para Adriana e Deivide
- R$15 × 50% = R$7,50 de comissão (1ª compra) para cada

### 5. Aprovar todas as comissões pendentes
- Meriane: 6 comissões → status 'approved'
- Deivide: 2 comissões → status 'approved'
- Adriana: 1 comissão nova → já criada como 'approved'

### 6. Atualizar métricas do Luis Paulo
- Incrementar `total_conversions` em +2 (Adriana e Deivide; Meriane já deve estar contabilizada)

## Resultado esperado
- Luis Paulo recebe crédito pelas 3 indicações no dashboard de afiliado
- Comissões ficam visíveis como aprovadas


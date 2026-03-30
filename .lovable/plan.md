

# Fix: Bônus nunca ficam DISPONÍVEIS — `available_at` nunca é preenchido

## Problema raiz

A função `ensure_partner_referral_bonuses` insere bônus com `status = 'PENDING'` mas **não preenche a coluna `available_at`**. Ela fica `NULL` em todos os 43 registros. O cron job criado anteriormente verifica `available_at IS NOT NULL AND available_at <= now()`, então nunca encontra registros para atualizar.

## Solução (1 migration)

### 1. Corrigir registros existentes
```sql
UPDATE partner_referral_bonuses
SET available_at = created_at + INTERVAL '7 days'
WHERE available_at IS NULL;
```

### 2. Definir default na coluna
```sql
ALTER TABLE partner_referral_bonuses
ALTER COLUMN available_at SET DEFAULT (timezone('America/Sao_Paulo', now()) + INTERVAL '7 days');
```

### 3. Atualizar a função `ensure_partner_referral_bonuses`
Adicionar `available_at` nos 3 INSERTs (nível 1, 2, 3):
```sql
INSERT INTO partner_referral_bonuses (
  ..., available_at
) VALUES (
  ..., NOW() + INTERVAL '7 days'
)
```

### 4. Liberar imediatamente os que já passaram de 7 dias
```sql
SELECT public.release_pending_referral_bonuses();
```
Todos os bônus criados antes de 23/Mar (7+ dias atrás) serão marcados como AVAILABLE.

## Resultado

- Os 43 bônus existentes recebem `available_at = created_at + 7 dias`
- Bônus com mais de 7 dias (criados antes de 23/Mar) ficam AVAILABLE imediatamente
- Novos bônus sempre terão `available_at` preenchido automaticamente
- O cron job existente passa a funcionar corretamente

## Nenhuma alteração no frontend


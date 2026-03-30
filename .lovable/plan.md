

# Fix: Bônus de Indicação nunca sai de PENDENTE

## Problema

Os bônus são criados com `status = 'PENDING'` e `available_at = created_at + 7 dias`, mas **não existe nenhum mecanismo** (trigger, cron, ou edge function) que atualize o status para `AVAILABLE` quando `available_at` é atingido. Os bônus ficam pendentes para sempre.

## Solução

Criar uma função SQL + trigger que automaticamente atualiza o status para `AVAILABLE` quando a data de liberação é atingida, combinado com uma verificação periódica para bônus que já passaram da data.

## Implementação

### 1. Migration SQL

Uma única migration que:

1. **Atualiza imediatamente** todos os bônus que já passaram de `available_at` (corrige os existentes)
2. **Cria um cron job** via `pg_cron` que roda a cada hora, atualizando bônus cujo `available_at <= now()` de PENDING para AVAILABLE

```text
-- Correção retroativa
UPDATE partner_referral_bonuses
SET status = 'AVAILABLE'
WHERE status = 'PENDING'
  AND available_at IS NOT NULL
  AND available_at <= now();

-- Função para rodar periodicamente
CREATE FUNCTION release_pending_referral_bonuses() ...
  UPDATE partner_referral_bonuses
  SET status = 'AVAILABLE'
  WHERE status = 'PENDING'
    AND available_at IS NOT NULL
    AND available_at <= now();

-- Cron job a cada hora
SELECT cron.schedule('release-referral-bonuses', '0 * * * *', $$...$$);
```

### 2. Nenhuma alteração no frontend

O `AdminReferralBonusesTab` e demais componentes já exibem os status corretamente — só falta o dado mudar no banco.

## Resultado

- Bônus existentes que já passaram de 7 dias: corrigidos imediatamente
- Novos bônus: atualizados automaticamente a cada hora após `available_at`
- Zero alterações no frontend




# Plano: Reaplicar colunas ausentes da migration

## Diagnóstico

Ambas as colunas adicionadas na migration anterior não existem no banco:
- `fury_vault_instances.config_snapshot` (jsonb) — ausente
- `fury_vault_config.max_cap_absolute` (numeric) — ausente

O trigger `validate_fury_vault_withdrawal` e as funções `fury_vault_on_bid()` / `fury_vault_distribute()` que dependem dessas colunas podem também estar desatualizadas ou ausentes.

## Ação

Uma única migration SQL com `IF NOT EXISTS` / condicional para adicionar as duas colunas:

```sql
ALTER TABLE fury_vault_instances
  ADD COLUMN IF NOT EXISTS config_snapshot jsonb NULL;

ALTER TABLE fury_vault_config
  ADD COLUMN IF NOT EXISTS max_cap_absolute numeric NOT NULL DEFAULT 50;
```

Seguido da atualização do preset ativo e recriação das funções SQL (`fury_vault_on_bid`, `fury_vault_distribute`, `validate_fury_vault_withdrawal`) conforme o plano original já aprovado.

## Impacto

- Nenhuma alteração de UI ou frontend — apenas estrutura de banco de dados.
- As colunas são adicionadas com defaults seguros (NULL para snapshot, 50 para max_cap_absolute).
- Dados existentes não são afetados.

## Seção Técnica

A migration usará `ADD COLUMN IF NOT EXISTS` (PostgreSQL 11+) para ser idempotente, evitando erro caso uma execução parcial anterior tenha criado uma das colunas. As funções SQL serão recriadas com `CREATE OR REPLACE` para garantir que referenciam as novas colunas.




# Corrigir propagação binária: remover regra de qualificador

## Problema identificado

A função `propagate_binary_points` possui uma regra que **pula o sponsor** na propagação de pontos. No caso do Alex:

```text
Alex (source, 600pts)
  → Tiago (parent, depth 1) ✅ recebeu 600pts
  → Luis Paulo (depth 2, É O SPONSOR) ❌ PULADO pela regra de qualificador
  → Luiz Claudio (depth 3) ✅ recebeu 600pts
  → ... (demais uplines) ✅ receberam
```

Trecho problemático na função (linhas 50-53 da migration `20260311031637`):
```sql
v_is_qualifier := (v_current_id = v_sponsor_id);
IF NOT v_is_qualifier THEN
  -- só adiciona pontos se NÃO for o sponsor
```

## Solução

### 1. Atualizar `propagate_binary_points` — remover a regra de qualificador

Remover completamente a lógica que pula o sponsor. Os pontos devem subir para **todos** os uplines na cadeia física, sem exceção.

A função ficará mais simples: percorre a cadeia `parent_contract_id` adicionando pontos em cada nó, sem verificar se é sponsor.

### 2. Corrigir retroativamente os pontos do Luis Paulo

Adicionar os 600 pontos que foram pulados para Luis Paulo (contract `f54fe7ca-bc23-4db8-b4cb-39ead3d4a1e8`). Alex está na perna **right** do Tiago, e Tiago está na perna **right** do Luis Paulo, então os pontos do Alex chegam pelo lado **right** do Luis Paulo.

```sql
-- Adicionar 600 pontos na perna direita do Luis Paulo
UPDATE partner_binary_positions
SET right_points = right_points + 600,
    total_right_points = total_right_points + 600
WHERE partner_contract_id = 'f54fe7ca-bc23-4db8-b4cb-39ead3d4a1e8';

-- Registrar no log
INSERT INTO binary_points_log (partner_contract_id, source_contract_id, points_added, position, reason)
VALUES ('f54fe7ca-bc23-4db8-b4cb-39ead3d4a1e8', 'c7627efd-b8f1-44a4-86ed-4481846ded31', 600, 'right', 'retroactive_fix_qualifier_rule');
```

## Detalhes técnicos

| Arquivo / Recurso | Mudança |
|---|---|
| Migration SQL (nova) | Recriar `propagate_binary_points` sem a lógica `v_is_qualifier` |
| Migration SQL (mesma) | Correção retroativa dos pontos do Luis Paulo |


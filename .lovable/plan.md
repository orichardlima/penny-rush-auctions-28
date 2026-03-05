

## Plano: Corrigir pontos fantasmas na perna direita do Mariano

### Diagnóstico

O Mariano possui 1000 pontos na perna direita (`right_points` e `total_right_points`), mas não há nenhum registro correspondente no `binary_points_log`. A propagação do Luiz Cláudio (1o indicado direto do Mariano) foi corretamente bloqueada pela regra `qualifier_skip`, porém o saldo na tabela `partner_binary_positions` foi atualizado indevidamente.

Os uplines do Mariano (Neilson, Josué, etc.) **não precisam de correção** — os pontos do Luiz Cláudio já foram propagados corretamente para eles através da cadeia normal de uplines.

### Ação

1. **Atualizar dados** (via insert tool — operação de UPDATE):
   - Zerar `right_points` e `total_right_points` do Mariano (`partner_contract_id = 879cbe85-7623-476c-8159-c9fa1eab0791`) para 0

2. **Registrar auditoria** (via insert tool — operação de INSERT):
   - Inserir entrada no `admin_audit_log` documentando a correção com os valores antigos e novos

### Detalhes técnicos

- **Tabela**: `partner_binary_positions`
- **Registro**: `partner_contract_id = '879cbe85-7623-476c-8159-c9fa1eab0791'`
- **Campos**: `right_points: 1000 → 0`, `total_right_points: 1000 → 0`
- **Nenhuma alteração de código** necessária — apenas correção de dados


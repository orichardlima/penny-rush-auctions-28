

# Correção retroativa dos bônus do upgrade do Tiago

## Situação

O upgrade Legend → Diamond (R$9.999 → R$25.000) feito às 13:36 UTC usou o código antigo que **sobrescreveu** os bônus de ativação. Os valores monetários totais estão corretos, mas os registros precisam ser separados para integridade dos dados.

## Problema de inadimplência

Paulo Mota está `overdue`. Pela regra atual, o bônus de upgrade dele deveria ser `SUSPENDED` com prazo de 3 dias. Porém o bônus já está `AVAILABLE` porque o código antigo simplesmente atualizou o registro existente.

## Opções

**Opção A — Apenas corrigir os registros (sem alterar status)**
Restaurar os valores originais da ativação e criar registros de upgrade separados, mantendo tudo como `AVAILABLE` (já que o sistema já liberou).

**Opção B — Corrigir registros e aplicar regra de inadimplência ao Paulo**
Restaurar ativação, criar registro de upgrade do Paulo como `SUSPENDED` com expiração de 3 dias, e reduzir o bônus de ativação dele ao valor original (R$1.199,88). Isso significa que ele **perderia R$1.800,12** se não regularizar em 3 dias.

## Plano (Opção A — mais segura)

**Método**: Usar a ferramenta de insert/update para corrigir os dados diretamente (não é alteração de schema).

### Passo 1 — Restaurar bônus de ativação aos valores originais

Para cada um dos 3 registros existentes (níveis 1, 2, 3):
- `aporte_value`: 9999 (valor original Legend)
- `bonus_value`: recalcular com o percentual original (9999 * %)

| ID do bônus | Nível | bonus_value corrigido |
|-------------|-------|-----------------------|
| fe6a608a... | 1 (12%) | 1199.88 |
| 72deac19... | 2 (2%) | 199.98 |
| 93639569... | 3 (0.5%) | 49.995 |

### Passo 2 — Inserir novos registros de upgrade

Criar 3 novos registros com `source_event = 'upgrade'` e `aporte_value = 15001`:

| Upline | Nível | % | bonus_value | status |
|--------|-------|---|-------------|--------|
| Paulo Mota | 1 | 12% | 1800.12 | AVAILABLE |
| Luiz Claudio | 2 | 2% | 300.02 | AVAILABLE |
| Mariano | 3 | 0.5% | 75.005 | AVAILABLE |

### Passo 3 — Verificar outros upgrades afetados

Buscar no audit_log outros `UPGRADE_PLAN` que ocorreram antes da implementação do `source_event` para identificar se há mais casos a corrigir.

## Arquivos alterados

Nenhum arquivo de código alterado — apenas operações de dados (UPDATE + INSERT) via ferramenta de insert.

## Impacto

- Valores monetários totais permanecem iguais (nenhum upline ganha mais ou menos)
- Registros ficam separados corretamente (ativação vs upgrade)
- Rastreabilidade completa para auditoria


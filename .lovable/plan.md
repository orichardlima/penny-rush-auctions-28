

## Plano: Impedir propagação de pontos para contas Demo na rede binária

### Problema
Os 1000 pontos no lado direito de Lavínia vêm da conta Demo (plano Legend = 1000 pontos). A função SQL `position_partner_binary` tem um guard que impede propagação de pontos para contas demo, mas existem **dois caminhos** no admin que chamam `propagate_binary_points` diretamente, **sem verificar `is_demo`**:

1. **Vincular parceiro isolado** (`handleLink` — AdminBinaryTreeView.tsx, linhas 294-319)
2. **Recalcular pontos manualmente** (`handleRecalc` — AdminBinaryTreeView.tsx, linhas 249-254)

### Solução

**Opção A (recomendada) — Guard no SQL**: Adicionar verificação de `is_demo` dentro da própria função `propagate_binary_points`. Se o contrato fonte é demo, retorna 0 imediatamente. Isso protege **todos** os caminhos de uma vez.

**Opção B — Guard no frontend**: Adicionar verificação de `is_demo` nos dois handlers do `AdminBinaryTreeView.tsx` antes de chamar a RPC.

Recomendo **ambas** (defesa em profundidade).

### Alterações

| Arquivo | O que muda |
|---|---|
| Nova migration SQL | `propagate_binary_points`: se `p_source_contract_id` é demo, retorna 0 sem propagar |
| `src/components/Admin/AdminBinaryTreeView.tsx` | `handleLink`: verificar `is_demo` antes de propagar. `handleRecalc`: verificar `is_demo` e avisar o admin |

### Correção dos pontos existentes
Após a correção do código, será necessário **zerar manualmente** os 1000 pontos que já foram propagados de forma incorreta no `right_points` de Lavínia (e possivelmente em outros uplines). Isso pode ser feito via:
- Ferramenta "Recalcular Pontos" nos nós afetados (após remover e re-vincular o demo)
- Ou uma migration de correção pontual


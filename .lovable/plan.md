
# Corrigir Auto-Posicionamento Binario: Considerar Filhos Diretos

## Problema

A funcao `auto_create_binary_position` decide a perna (left/right) comparando apenas `left_points` vs `right_points` do sponsor. Quando ambos sao 0 (como acontece com os dois primeiros indicados pela regra de qualificacao), a condicao `<=` sempre resulta em `left`, colocando todos os indicados na mesma perna.

Foi exatamente o que aconteceu com Luciano: Valentina foi para a esquerda (0 <= 0), e Lavinia tambem foi para a esquerda (0 <= 0).

## Solucao

Alterar a logica de decisao para considerar tambem os filhos diretos (`left_child_id` / `right_child_id`) do sponsor. A nova logica sera:

1. Se o sponsor ja tem filho esquerdo mas NAO tem filho direito -> vai para `right`
2. Se o sponsor ja tem filho direito mas NAO tem filho esquerdo -> vai para `left`
3. Se ambos os lados estao livres ou ambos ocupados -> usa `left_points <= right_points` como desempate (comportamento atual)

Isso garante que mesmo com pontos zerados, o segundo indicado ira para o lado oposto.

## Alteracao Tecnica

Arquivo: Nova migration SQL

A migration vai fazer `CREATE OR REPLACE FUNCTION public.auto_create_binary_position()` com a logica atualizada. As variaveis adicionais serao:

- `v_sponsor_has_left boolean`
- `v_sponsor_has_right boolean`

A logica de decisao (que aparece em dois lugares na funcao -- linhas 44-53 para sponsor real e linhas 84-93 para sponsor padrao) sera atualizada para:

```text
SELECT 
  COALESCE(left_points, 0), 
  COALESCE(right_points, 0),
  (left_child_id IS NOT NULL),
  (right_child_id IS NOT NULL)
INTO v_sponsor_left_points, v_sponsor_right_points, v_sponsor_has_left, v_sponsor_has_right
FROM partner_binary_positions
WHERE partner_contract_id = v_sponsor_contract_id;

IF v_sponsor_has_left AND NOT v_sponsor_has_right THEN
  v_preferred_side := 'right';
ELSIF v_sponsor_has_right AND NOT v_sponsor_has_left THEN
  v_preferred_side := 'left';
ELSIF v_sponsor_left_points <= v_sponsor_right_points THEN
  v_preferred_side := 'left';
ELSE
  v_preferred_side := 'right';
END IF;
```

## O que NAO muda

- Nenhuma interface (UI) sera alterada
- A funcao `position_partner_binary` (spillover/propagacao) permanece identica
- O fluxo de criacao de contrato permanece identico
- Os triggers existentes permanecem iguais
- Nenhuma outra funcionalidade e afetada

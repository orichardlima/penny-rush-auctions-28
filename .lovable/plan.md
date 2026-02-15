

## Corrigir Logica de Spillover para Extremidades

### Problema Atual

A funcao `position_partner_binary` usa um algoritmo BFS que preenche vagas internas na subarvore do sponsor. Quando a posicao direta (esquerda ou direita) esta ocupada, ele desce verificando esquerda e direita de cada no, preenchendo a primeira vaga livre que encontra -- inclusive posicoes internas.

**Exemplo do problema**: Richard Lima indica alguem na perna esquerda, que ja esta ocupada. O algoritmo encontra uma vaga como filho direito de um no intermediario e coloca la. Isso resulta em parceiros posicionados em locais internos, nao nas extremidades.

### Logica Correta (Extremidades)

O spillover deve seguir sempre a **mesma direcao** ate encontrar uma folha:

- **Perna esquerda**: descer sempre pelo `left_child_id` ate encontrar um no que nao tenha filho esquerdo. Posicionar como filho esquerdo desse no.
- **Perna direita**: descer sempre pelo `right_child_id` ate encontrar um no que nao tenha filho direito. Posicionar como filho direito desse no.

Isso garante que novos parceiros ficam nas **extremidades** da subarvore, nao em posicoes internas.

```text
Antes (BFS - preenche vagas internas):

        Sponsor
       /       \
      A         B
     / \       /
    C   D     E
   /
  F

Novo parceiro na esquerda -> colocado como B.right (vaga interna)

Depois (Extremidades):

        Sponsor
       /       \
      A         B
     / \       /
    C   D     E
   /
  F
 /
NOVO  <- sempre desce pela esquerda ate a extremidade
```

### Detalhes Tecnicos

**Arquivo alterado:** Migracao SQL (nova migracao)

**Funcao: `position_partner_binary`** - Alterar o bloco de spillover (linhas 208-235 da migracao original):

De:
```sql
-- Loop BFS que verifica esquerda, direita, desce pela esquerda
LOOP
  SELECT left_child_id INTO v_existing_child ...
  IF v_existing_child IS NULL THEN EXIT (left); END IF;
  SELECT right_child_id INTO v_existing_child ...
  IF v_existing_child IS NULL THEN EXIT (right); END IF;
  -- Desce pela esquerda
  SELECT left_child_id INTO v_current_id ...
END LOOP;
```

Para:
```sql
-- Descer sempre pela mesma direcao ate a extremidade
v_current_id := v_existing_child;
LOOP
  IF p_position = 'left' THEN
    SELECT left_child_id INTO v_existing_child
    FROM partner_binary_positions WHERE partner_contract_id = v_current_id;
  ELSE
    SELECT right_child_id INTO v_existing_child
    FROM partner_binary_positions WHERE partner_contract_id = v_current_id;
  END IF;

  IF v_existing_child IS NULL THEN
    v_parent_id := v_current_id;
    -- Manter p_position original (left ou right)
    EXIT;
  END IF;

  v_current_id := v_existing_child;
END LOOP;
```

### O Que NAO Muda

- Propagacao de pontos (`propagate_binary_points`) permanece identica
- Trigger `auto_create_binary_position` permanece identico (determina perna menor)
- Toda a logica de criacao de posicao, atualizacao de filhos e limpeza de pendencias
- Interface admin, componentes de visualizacao da arvore
- Nenhum outro arquivo ou componente e modificado

### Impacto

- Parceiros futuros serao posicionados nas extremidades corretamente
- Parceiros ja posicionados internamente permaneceriam onde estao (sem retroativo)
- A arvore crescera de forma mais linear nas extremidades, respeitando a direcao escolhida


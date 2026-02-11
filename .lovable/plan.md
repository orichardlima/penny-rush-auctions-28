

## Posicionar Automaticamente Parceiros Sem Indicacao Sob um Sponsor Padrao

### Problema Atual
Quando um parceiro se cadastra sem link de indicacao (`referred_by_user_id = NULL`), o trigger `auto_create_binary_position` cria uma posicao isolada (sem sponsor, sem parent, sem posicao). Esses parceiros ficam "soltos" e precisam de vinculacao manual pelo admin.

### Solucao
Alterar o trigger para que, quando nao houver indicador, o sistema use automaticamente o **nó raiz da arvore** como sponsor padrao. Assim o parceiro sera posicionado via spillover (BFS na perna menor), exatamente como se tivesse sido indicado pelo parceiro raiz.

### Como Funciona

```text
Cadastro sem indicacao:

ANTES (atual):
  Parceiro novo -> Sem referral -> Criado ISOLADO (sem conexao)

DEPOIS (novo):
  Parceiro novo -> Sem referral -> Busca nó raiz da arvore
                                -> Posiciona via spillover na perna menor
                                -> Propaga pontos para uplines
```

### Implementacao

**Unica mudanca**: Migration SQL para atualizar a funcao `auto_create_binary_position`

No bloco `ELSE` (linhas 63-76 do trigger atual), em vez de criar posicao isolada, o trigger fara:

1. Buscar o nó raiz da arvore binaria (parceiro sem `parent_contract_id` que tenha filhos -- atualmente Richard Lima)
2. Se encontrar uma raiz, usar esse contrato como `sponsor_contract_id` padrao
3. Chamar `position_partner_binary()` com esse sponsor, aplicando spillover e propagacao de pontos automaticamente
4. Somente se NAO existir nenhuma raiz na arvore (caso a rede esteja vazia), criar como raiz isolada

### Detalhes Tecnicos

A migration vai substituir o bloco:
```text
-- Sem patrocinador: criar posicao raiz
INSERT INTO partner_binary_positions (...) VALUES (NEW.id, NULL, NULL, NULL, 0, 0, 0, 0);
```

Por uma logica que:
```text
-- Buscar raiz da arvore (nó sem parent que tenha filhos)
SELECT partner_contract_id INTO v_default_sponsor
FROM partner_binary_positions
WHERE parent_contract_id IS NULL
  AND (left_child_id IS NOT NULL OR right_child_id IS NOT NULL)
LIMIT 1;

-- Se nao encontrou raiz com filhos, buscar qualquer raiz
IF v_default_sponsor IS NULL THEN
  SELECT partner_contract_id INTO v_default_sponsor
  FROM partner_binary_positions
  WHERE parent_contract_id IS NULL
  LIMIT 1;
END IF;

IF v_default_sponsor IS NOT NULL THEN
  -- Posicionar automaticamente sob a raiz, com spillover e pontos
  v_result := position_partner_binary(NEW.id, v_default_sponsor, v_preferred_side);
ELSE
  -- Rede vazia: este será o primeiro nó raiz
  INSERT INTO partner_binary_positions (...) VALUES (NEW.id, NULL, NULL, NULL, 0, 0, 0, 0);
END IF;
```

### O Que NAO Muda
- Nenhuma alteracao de UI ou componentes React
- A logica para parceiros COM indicacao continua identica
- O fluxo de pagamento e ativacao nao muda
- A funcao `position_partner_binary` e o spillover BFS continuam iguais
- A tabela de "Parceiros Isolados" no admin continua funcionando (mas tera menos ocorrencias)

### Resultado
- Parceiros sem indicacao serao posicionados automaticamente na arvore
- Seus pontos serao propagados corretamente para todos os uplines
- O admin nao precisara mais vincular manualmente esses casos

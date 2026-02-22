
# Mover Lavinia para a perna direita de Luciano

## Situacao Atual

```text
Luciano (60eda7ef)
  left_child: Valentina (efbce3be)  |  right_child: NULL
  left_points: 0  |  right_points: 0

Valentina (efbce3be)
  parent: Luciano  |  position: left
  left_child: Lavinia (04ec1858)  |  right_child: NULL
  left_points: 50  |  right_points: 0

Lavinia (04ec1858)
  parent: Valentina  |  position: left
  sponsor: Luciano
```

## Situacao Desejada

```text
Luciano (60eda7ef)
  left_child: Valentina  |  right_child: Lavinia
  left_points: 0  |  right_points: 0

Valentina (efbce3be)
  parent: Luciano  |  position: left
  left_child: NULL  |  right_child: NULL
  left_points: 0  |  right_points: 0

Lavinia (04ec1858)
  parent: Luciano  |  position: right
  sponsor: Luciano
```

## Operacoes (3 UPDATEs)

Todas sao operacoes de dados (UPDATE), nao de schema. Serao executadas via ferramenta de insert/update.

1. **Valentina** (`efbce3be-0071-49f2-b9ac-fec8e8ecb11e`): remover Lavinia como filha esquerda e zerar os 50 pontos esquerdos que vieram dela
   - `left_child_id = NULL`
   - `left_points = 0`

2. **Luciano** (`60eda7ef-1d6d-4927-9d32-7feadc650bb3`): registrar Lavinia como filha direita
   - `right_child_id = '04ec1858-1e74-424b-8738-c2a18eef53ef'`

3. **Lavinia** (`04ec1858-1e74-424b-8738-c2a18eef53ef`): atualizar parent e posicao
   - `parent_contract_id = '60eda7ef-1d6d-4927-9d32-7feadc650bb3'` (Luciano)
   - `position = 'right'`

## Por que os uplines NAO precisam de ajuste

Os pontos de Lavinia propagaram para os ancestrais de Luciano na posicao `right` (50 pontos para o pai de Luciano e acima). Como Lavinia continua na mesma subarvore do ponto de vista desses uplines, os pontos deles permanecem corretos.

O unico ajuste de pontos necessario e em **Valentina**, que tinha 50 left_points vindos de Lavinia ser sua filha esquerda.

## O que NAO muda

- Nenhuma interface (UI) sera alterada
- Nenhuma funcao ou trigger sera modificada
- O sponsor de Lavinia continua sendo Luciano
- Os pontos dos uplines acima de Luciano permanecem inalterados

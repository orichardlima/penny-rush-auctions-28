

## Corrigir vinculacao para usar spillover automatico (derramamento)

### Problema atual

O dialog de vinculacao pede ao admin para escolher manualmente o no pai E a posicao. Isso esta errado porque:
- O admin deveria escolher apenas o **sponsor** (quem indicou)
- O **posicionamento** (parent + posicao) deveria ser automatico por spillover: encontrar a proxima vaga livre na subarvore do sponsor

### Como funciona o spillover

O algoritmo de derramamento percorre a subarvore do sponsor usando BFS (busca em largura) para encontrar o primeiro no com uma vaga livre (esquerda tem prioridade sobre direita, ou vice-versa conforme regra de perna menor).

```text
Exemplo: Richard tem filhos E e D preenchidos.
- Filho E de Richard tem vaga na direita
- Adailton sera posicionado como filho direito do Filho E
- sponsor_contract_id = Richard
- parent_contract_id = Filho E
- position = right
```

### Mudancas

**Arquivo**: `src/components/Admin/AdminBinaryTreeView.tsx`

1. **Simplificar o dialog**: remover a selecao manual de posicao (RadioGroup) e a selecao de pai. Substituir por um unico Select de **Sponsor** mostrando TODOS os parceiros (nao apenas os com vaga direta)

2. **Implementar funcao `findNextAvailableSlot`**: algoritmo BFS que recebe o contract_id do sponsor e percorre sua subarvore para encontrar o primeiro no com vaga livre
   - Usa fila (queue) comecando pelo sponsor
   - Para cada no, verifica se tem vaga esquerda ou direita
   - Se tem vaga, retorna `{ parentContractId, position }`
   - Se nao tem, adiciona os filhos na fila e continua
   - Prioridade: esquerda antes de direita (perna menor primeiro)

3. **Atualizar `handleLink`**:
   - Recebe apenas o sponsor selecionado
   - Chama `findNextAvailableSlot(sponsorContractId)` para encontrar parent e posicao automaticamente
   - Faz os dois UPDATEs como antes, mas agora com `sponsor_contract_id` = sponsor escolhido e `parent_contract_id` = no encontrado pelo BFS

4. **Atualizar UI do dialog**:
   - Titulo: "Vincular Parceiro a Arvore"
   - Campo unico: Select de Sponsor com busca
   - Ao selecionar sponsor, mostrar preview: "Sera posicionado como filho [esquerdo/direito] de [Nome do No Pai]"
   - Se a subarvore do sponsor estiver completamente cheia (improvavel mas possivel), mostrar mensagem de erro
   - Botao de confirmacao

### Algoritmo BFS (pseudocodigo)

```text
function findNextAvailableSlot(sponsorContractId):
  queue = [sponsorContractId]
  while queue not empty:
    current = queue.shift()
    node = posMap.get(current)
    if not node: continue
    if not node.left_child_id: return { parent: current, position: 'left' }
    if not node.right_child_id: return { parent: current, position: 'right' }
    queue.push(node.left_child_id)
    queue.push(node.right_child_id)
  return null  // sem vaga (subarvore cheia)
```

### O que NAO muda

- Nenhuma outra pagina ou componente e alterado
- A arvore hierarquica, resumo, tabela completa permanecem intactas
- A logica de UPDATE no banco continua a mesma (dois updates)
- Nenhuma migration necessaria
- A tabela de isolados continua com o botao "Vincular"




## Profundidade Infinita na Arvore Binaria

### Problema Atual
A arvore binaria do parceiro esta limitada a no maximo 5 niveis de profundidade (botoes 2, 3, 4, 5). Parceiros com redes grandes nao conseguem ver seus downlines mais profundos.

### Solucao: Navegacao por Sub-Arvore (Drill-Down Infinito)

Permitir que o parceiro **clique em qualquer no** para "entrar" nele, re-centralizando a arvore naquele no como raiz. Assim, ele pode navegar nivel a nivel ate o infinito. Alem disso, aumentar as opcoes de profundidade para ate 10 niveis.

### Mudancas

**1. Hook `useBinaryNetwork.ts`**

- Adicionar um parametro `rootContractId` ao `fetchBinaryTree` para permitir carregar a arvore a partir de qualquer no (nao so do contrato do usuario logado)
- Criar funcao `navigateToNode(contractId)` que recarrega a arvore centrada naquele no
- Manter referencia ao contrato original para o botao "Voltar ao Topo"

**2. Componente `BinaryNetworkTree.tsx`**

- Adicionar botao "Entrar" em cada no que tenha filhos, permitindo drill-down
- Adicionar breadcrumb/botao "Voltar ao Topo" quando o usuario navegar para uma sub-arvore
- Aumentar opcoes de profundidade: 2, 3, 4, 5, 7, 10
- Mostrar indicador visual de que um no tem sub-arvore carregavel (ex: seta para baixo no no folha que tem filhos registrados)

**3. RPC `get_binary_tree` (SQL)**

- Nenhuma alteracao necessaria - a funcao ja aceita qualquer `p_contract_id` e qualquer `p_depth`. Basta passar o contract_id do no selecionado.

### Fluxo do Usuario

```text
Parceiro ve arvore com raiz nele mesmo (profundidade 5)
        |
Clica em um no do nivel 5 que tem filhos
        |
Arvore recarrega com aquele no como raiz
        |
Breadcrumb mostra: "Voce > ... > No Atual"
        |
Botao "Voltar ao Topo" disponivel
        |
Repete quantas vezes quiser (infinito)
```

### Detalhes Tecnicos

**Arquivos modificados:**
- `src/hooks/useBinaryNetwork.ts` - Adicionar estado `viewRootContractId` e funcao `navigateToNode`
- `src/components/Partner/BinaryNetworkTree.tsx` - UI de navegacao, breadcrumb, opcoes de profundidade expandidas, botao de drill-down nos nos

**Logica de navegacao no hook:**
- Novo estado `viewRootContractId` (inicia como o contrato do usuario)
- `navigateToNode(id)` atualiza `viewRootContractId` e chama `fetchBinaryTree(id, maxDepth)`
- `resetToRoot()` volta ao contrato original
- Historico de navegacao (pilha) para permitir "voltar" nivel a nivel

**UI no componente:**
- Cada no com `left_child_id` ou `right_child_id` exibe um pequeno icone clicavel para "expandir aqui"
- Barra de navegacao no topo mostrando onde o usuario esta na arvore
- Botoes "Voltar" e "Voltar ao Topo"
- Opcoes de profundidade: 2, 3, 4, 5, 7, 10

### Impacto
- Nenhuma alteracao na RPC SQL existente
- Nenhuma alteracao em outras funcionalidades do parceiro
- A busca por nome continua funcionando normalmente
- Performance mantida pois cada carregamento traz apenas N niveis por vez


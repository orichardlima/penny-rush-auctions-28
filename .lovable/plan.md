

## Adicionar visualizacao completa da arvore binaria no painel admin

### Objetivo

Criar um novo componente de visualizacao da arvore binaria completa dentro da aba "Binario" do painel admin, mostrando todos os parceiros (conectados e isolados) para facilitar o gerenciamento.

### Arquitetura

A aba "Binario" ja existe em `AdminPartnerManagement.tsx` e renderiza `BinaryNetworkManager.tsx`. A solucao adiciona uma nova aba "Arvore Completa" dentro do `BinaryNetworkManager`, com uma tabela e visualizacao em arvore de todos os registros.

### Componente novo

**Arquivo**: `src/components/Admin/AdminBinaryTreeView.tsx`

Funcionalidades:
- Busca TODOS os registros de `partner_binary_positions` com JOIN em `partner_contracts` e `profiles` para obter nomes e planos
- Separa em dois grupos: **Conectados** (tem `parent_contract_id` ou sao raiz com filhos) e **Isolados** (sem parent e sem filhos, ou sem sponsor)
- Exibe tabela com colunas: Parceiro, Plano, Posicao, Pai, Sponsor, Pts Esq, Pts Dir, Filhos
- Card de resumo com totais: total de posicoes, conectados, isolados, pontos totais
- Visualizacao em arvore hierarquica a partir dos nos raiz (sem parent), renderizando filhos recursivamente
- Secao separada mostrando nos isolados com destaque visual (borda amarela/warning)
- Botao de refresh

### Mudancas em arquivos existentes

**Arquivo**: `src/components/Admin/BinaryNetworkManager.tsx`

- Adicionar nova aba "Arvore" no TabsList (alem de "Fechar Ciclo", "Historico", "Configuracoes")
- Importar e renderizar `AdminBinaryTreeView` nessa aba

### Detalhes tecnicos

A query usara `supabase` client diretamente no componente (padrao usado em outros componentes admin):

```text
supabase
  .from('partner_binary_positions')
  .select('*, partner_contracts!partner_contract_id(id, plan_name, user_id, status, profiles:user_id(full_name, email))')
```

Como a tabela `profiles` nao tem FK direta, a query sera feita em dois passos:
1. Buscar todas as posicoes binarias com join em `partner_contracts`
2. Buscar os perfis dos user_ids encontrados

A arvore e montada no frontend mapeando `parent_contract_id` para construir a hierarquia.

### O que NAO muda

- Nenhuma outra pagina ou componente e alterado alem de `BinaryNetworkManager.tsx`
- Nenhuma migration SQL necessaria
- A funcionalidade existente de fechamento de ciclo, historico e configuracoes permanece intacta

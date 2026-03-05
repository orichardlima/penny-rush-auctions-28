

## Plano: Adicionar funcionalidade de realocação de parceiro na árvore binária

### Contexto

Atualmente, o painel admin permite apenas vincular parceiros **isolados** (sem conexões) e recalcular pontos. Não existe forma de **mover um parceiro já conectado** para outra posição na rede.

### O que será feito

Adicionar um botão "Realocar" na tabela de todos os registros (`PositionsTable`) do `AdminBinaryTreeView.tsx`, com um dialog que permite ao admin:

1. Selecionar o **novo sponsor** (indicador)
2. Ver o preview do spillover (onde será posicionado automaticamente)
3. Confirmar a realocação

### Lógica de realocação (passo a passo)

1. **Desconectar do pai antigo**: limpar `left_child_id` ou `right_child_id` do pai atual
2. **Desconectar subárvore**: os filhos do nó realocado continuam ligados a ele (toda a subárvore se move junto)
3. **Posicionar no novo local**: atualizar `parent_contract_id`, `sponsor_contract_id` e `position` do nó, e setar o `left_child_id`/`right_child_id` do novo pai
4. **Zerar pontos do upline antigo**: como os pontos foram propagados no momento do cadastro e são fixos, o admin precisará recalcular manualmente os pontos dos ancestrais antigos (conforme regra de negócio existente)
5. **Registrar no audit log**: gravar a ação com old/new values

### Alterações técnicas

**Arquivo: `src/components/Admin/AdminBinaryTreeView.tsx`**

- Adicionar estado para dialog de realocação (`relocateDialogOpen`, `relocateTarget`, `relocateSponsorId`)
- Adicionar botão "Realocar" na `PositionsTable` ao lado do "Recalcular" (apenas para nós conectados, não raiz)
- Criar dialog de realocação com:
  - Select de novo sponsor (excluindo o próprio nó e seus descendentes)
  - Preview do spillover (reusa `findNextAvailableSlot`)
  - Aviso sobre necessidade de recálculo manual de pontos
- Função `handleRelocate` que executa os 4 passos de desconexão/reconexão + audit log

### Avisos importantes na UI

- Badge de alerta: "Os pontos do upline antigo NÃO são recalculados automaticamente. Use 'Recalcular Pontos' nos ancestrais afetados após a realocação."
- Confirmação dupla antes de executar (AlertDialog)


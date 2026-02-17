## Ativar Bonus Binario Somente Apos 2 Indicados (1 em Cada Perna)

### Regra de Negocio

O bonus binario so sera pago a parceiros que tenham **ativado** seu binario, ou seja, que possuam pelo menos 1 indicado na perna esquerda E 1 na perna direita (`left_child_id IS NOT NULL AND right_child_id IS NOT NULL`).

Os **pontos continuam acumulando normalmente** para todos os parceiros. Apenas o **pagamento do bonus** e bloqueado ate a ativacao.

### O Que Muda

1. **Funcao SQL `close_binary_cycle**` - Adicionar filtro no loop que processa os parceiros para excluir aqueles sem ambos os filhos preenchidos.
2. **Funcao SQL `preview_binary_cycle_closure**` - Mesmo filtro no preview para que o admin veja apenas parceiros elegiveis.
3. **UI do parceiro (BinaryNetworkTree)** - Exibir um aviso visual quando o binario nao esta ativado (sem os 2 lados preenchidos), informando que precisa indicar nos dois lados para receber bonus.
4. **UI do admin (BinaryNetworkManager)** - Na preview, parceiros nao ativados nao aparecerao mais (ja resolvido pelo filtro SQL).

### Detalhes Tecnicos

**Migracao SQL** - Recriar as 2 funcoes adicionando a condicao:

```sql
-- No WHERE dos loops de ambas as funcoes, adicionar:
AND bp.left_child_id IS NOT NULL
AND bp.right_child_id IS NOT NULL
```

Trecho completo do `close_binary_cycle`:

```sql
FOR v_partner IN
  SELECT bp.partner_contract_id, bp.left_points, bp.right_points
  FROM public.partner_binary_positions bp
  WHERE (bp.left_points > 0 OR bp.right_points > 0)
    AND bp.left_child_id IS NOT NULL
    AND bp.right_child_id IS NOT NULL
LOOP
```

Trecho do `preview_binary_cycle_closure`:

```sql
FOR v_partner IN
  SELECT bp.partner_contract_id, bp.left_points, bp.right_points,
         p.full_name, pc.plan_name
  FROM public.partner_binary_positions bp
  JOIN public.partner_contracts pc ON pc.id = bp.partner_contract_id
  JOIN public.profiles p ON p.user_id = pc.user_id
  WHERE (bp.left_points > 0 OR bp.right_points > 0)
    AND bp.left_child_id IS NOT NULL
    AND bp.right_child_id IS NOT NULL
  ORDER BY LEAST(bp.left_points, bp.right_points) DESC
LOOP
```

**Componente BinaryNetworkTree.tsx** - Adicionar um alerta quando `position` existe mas `left_child_id` ou `right_child_id` e nulo:

```text
"Seu binario ainda nao esta ativado. Indique pelo menos 1 parceiro 
 em cada lado (esquerda e direita) para comecar a receber bonus de rede."
```

**Componente BinaryBonusHistory.tsx** - Atualizar mensagem quando nao ha bonus E binario nao esta ativado.

### Arquivos Modificados

- `supabase/migrations/[nova].sql` - Recriar funcoes `close_binary_cycle` e `preview_binary_cycle_closure`
- `src/components/Partner/BinaryNetworkTree.tsx` - Alerta de binario nao ativado
- `src/components/Partner/BinaryBonusHistory.tsx` - Mensagem contextual
- `src/integrations/supabase/types.ts` - Atualizado automaticamente

### Impacto

- Pontos continuam acumulando para todos os parceiros
- Parceiros sem os 2 lados preenchidos nao recebem bonus no fechamento de ciclo
- Ao ativar (preencher ambos os lados), os pontos ja acumulados passam a ser elegiveis no proximo ciclo
- Nenhuma alteracao na interface de indicacoes, planos, saques ou outras funcionalidades
- Os pontos binários dos dois primeiros indicados não pontuam para o sponsor, só pontuam a partir do terceiro indicado quando aí ele já estará devidamente qualificado, ou seja, os dois primeiros indicados ele só ganha bônus de indicação, não calcula para ele pontos binários, porém pontua para todos os qualificados acima dele.
- &nbsp;
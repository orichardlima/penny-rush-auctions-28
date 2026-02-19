

# Plano de Correção: Reposicionar Ananda na Rede do Adailton

## Problema Identificado

Ananda possui **dois contratos**:

| Contrato | Status | Referido por | Posicao Binaria |
|----------|--------|-------------|-----------------|
| `a9b4cf...` | PENDING (sem pagamento) | Adailton | Nenhuma (sem registro) |
| `418c75...` | ACTIVE | Ninguem | Sob Administrador, sponsor Richard Lima |

O contrato ativo foi criado incorretamente sem vincular ao Adailton e foi posicionado na rede errada (sob Richard Lima/Administrador). O contrato que tem o referral correto ficou pendente e nunca ganhou posicao binaria.

## Plano de Correcao

### Passo 1 - Corrigir o contrato ativo (418c75...)

Atualizar o campo `referred_by_user_id` do contrato ativo da Ananda para apontar para o user_id do Adailton (`cb85af36-0756-4ae3-9b58-5efc79ee1087`).

### Passo 2 - Reposicionar na arvore binaria

Mover a posicao binaria da Ananda (registro `3618ee38...`) para ficar na rede do Adailton:

1. **Remover do pai atual**: Limpar o `left_child_id` do Administrador (`1de6fd0d...`) que aponta para Ananda
2. **Atualizar o registro binario da Ananda**:
   - `sponsor_contract_id` -> contrato do Adailton (`9d9db00f...`)
   - `parent_contract_id` -> contrato do Adailton (`9d9db00f...`)
   - `position` -> `left` (perna esquerda do Adailton, que esta vazia)
3. **Atualizar o Adailton**: Setar `left_child_id` = contrato da Ananda (`418c750a...`)

### Passo 3 - Limpar contrato duplicado pendente

O contrato `a9b4cf...` (PENDING, sem pagamento) sera cancelado/removido para evitar confusao.

### Passo 4 - Recalcular pontos

Propagar os pontos do plano da Ananda (Legend) para os uplines do Adailton, ja que ao mudar de posicao os pontos anteriores ficam inconsistentes. Tambem sera necessario remover os pontos que foram indevidamente propagados na arvore antiga (sob Administrador/Richard).

## Detalhes Tecnicos

As alteracoes serao feitas via queries SQL diretas nas tabelas:
- `partner_contracts` (corrigir `referred_by_user_id`)
- `partner_binary_positions` (reposicionar: atualizar parent, sponsor, position e child pointers)
- `binary_points_log` (verificar logs de pontos anteriores)

Apos as correcoes de dados, a RPC `propagate_binary_points` sera chamada para recalcular os pontos corretamente na nova posicao.

## Resultado Esperado

```text
Richard Lima (sponsor: Richard)
  |
  +-- [RIGHT] Adailton (sponsor: Richard)
        |
        +-- [LEFT]  Ananda (sponsor: Adailton)  <-- CORRIGIDO
        +-- [RIGHT] Luciano Deiro
```

Ananda ficara na perna esquerda do Adailton, que e quem a indicou, com os pontos propagados corretamente para os uplines.


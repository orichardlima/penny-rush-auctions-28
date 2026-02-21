

# Plano: Informar o Parceiro sobre o Prazo de Carencia dos Bonus

## Problema

O parceiro ve o status "Em validacao" nos bonus de indicacao, mas nao recebe nenhuma informacao sobre o motivo (carencia de 7 dias) nem a data prevista de liberacao.

## Alteracoes

Apenas o arquivo `src/components/Partner/PartnerReferralSection.tsx` sera modificado. Nenhum outro arquivo, funcionalidade ou interface sera alterado.

### 1. Adicionar coluna "Liberacao" na tabela de historico

Na tabela de bonus de indicacao, adicionar uma nova coluna entre "Data" e "Status" chamada "Liberacao", que exibe:
- A data formatada de `available_at` quando o status for `PENDING`
- Um icone de check quando o status for `AVAILABLE` ou `PAID`
- Traco (-) quando nao houver data

### 2. Tooltip no badge de status "Em validacao"

Quando o status for `PENDING`, o badge tera um tooltip explicando:
"Bonus em periodo de carencia de 7 dias. Sera liberado automaticamente apos a validacao."

### 3. Melhorar o disclaimer no final

Substituir o texto vago atual por uma mensagem mais clara:
"O bonus de indicacao possui um periodo de carencia de 7 dias antes de ficar disponivel. Este e um beneficio comercial independente do seu contrato de participacao."

## Detalhes Tecnicos

### Arquivo: `src/components/Partner/PartnerReferralSection.tsx`

**Alteracao 1 - Tabela (linhas ~205-258):**
- Adicionar `<TableHead>Liberacao</TableHead>` apos a coluna "Data"
- Adicionar `<TableCell>` correspondente que renderiza `formatDate(bonus.available_at)` se existir, ou "-"

**Alteracao 2 - Tooltip no badge PENDING (linhas ~252-255):**
- Importar `Tooltip, TooltipContent, TooltipProvider, TooltipTrigger` de `@/components/ui/tooltip`
- Envolver o Badge de status PENDING em um Tooltip com a mensagem explicativa

**Alteracao 3 - Disclaimer (linhas ~266-268):**
- Atualizar o texto para mencionar explicitamente os 7 dias de carencia

### Nenhuma outra alteracao
- Nenhuma mudanca no banco de dados
- Nenhuma mudanca em hooks ou outros componentes
- Nenhuma mudanca na logica de negocio


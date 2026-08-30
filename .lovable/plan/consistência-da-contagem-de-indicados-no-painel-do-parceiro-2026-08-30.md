# Consistência da contagem de indicados no painel do parceiro

## Situação verificada

A correção anterior (pessoas únicas) foi aplicada apenas em `usePartnerReferrals`. Outras telas do painel continuam contando **registros de bônus**, o que produz números diferentes para o mesmo parceiro em telas diferentes.

Divergências confirmadas na leitura do código e dos dados:

1. **Árvore da rede** (`useReferralNetwork` → `ReferralNetworkTree`): os cartões "Total na rede", "Diretos", "2º Nível" e "3º Nível" usam `allBonuses.length` e o tamanho de cada lista de bônus. Uma mesma pessoa com mais de um bônus (upgrade, bônus retroativo de Início Rápido) aparece duplicada, e os bônus `CANCELLED` entram na conta — ao contrário da aba de indicações, que já os exclui.
2. **Nós duplicados na árvore**: os nós são criados a partir de cada bônus, então o mesmo indicado pode ser listado duas vezes na hierarquia.
3. **Início Rápido** (`useFastStartProgress`): o progresso de indicados diretos usa a quantidade de linhas de bônus (excluindo canceladas e retroativas), não pessoas distintas. Pode indicar meta atingida com menos pessoas reais.
4. **Status não previsto**: existem bônus com status `CREDITED` no banco (confirmado nos dados do parceiro Gustavo), que não está mapeado nas listas de status do frontend. Isso deixa esses registros sem rótulo correto e fora dos cartões de status.

Exemplo real (Gustavo Felipe): nível 1 tem 7 registros de bônus para 6 pessoas; nível 2 tem 5 registros para 5 pessoas.

## O que será feito

- Criar uma função utilitária única de contagem de pessoas (por `referred_user_id`, ignorando `CANCELLED`) e usá-la em todas as telas, para que o número de "Indicados", "Diretos", "2º Nível" e "3º Nível" seja idêntico em qualquer tela.
- Ajustar os cartões da árvore da rede para contar pessoas únicas e desconsiderar bônus cancelados.
- Deduplicar os nós da árvore por pessoa, mantendo o histórico de bônus por pessoa no detalhe do nó (valor somado dos bônus daquela pessoa).
- Ajustar o Início Rápido para contar pessoas distintas.
- Incluir `CREDITED` no mapa de status (rótulo e cor) para que esses registros apareçam corretamente e não fiquem fora dos totais de valores.
- Conferir cenários: parceiro sem indicados, parceiro só com cancelados, pessoa com bônus em vários níveis, pessoa com bônus retroativo do Início Rápido, e parceiro com upgrade (dois bônus de nível 1 para o mesmo indicado).

## Fora de escopo

Nenhuma regra financeira muda: valores em R$, percentuais, elegibilidade, pontos de carreira e fluxos de saque continuam exatamente como estão. A alteração é apenas de apresentação/contagem.

## Detalhes técnicos

- Novo helper em `src/lib/referralCounts.ts` (ou similar) com `countUniqueReferrals(bonuses)` e `countByLevel(bonuses)`.
- `src/hooks/usePartnerReferrals.ts`: substituir o cálculo local pelo helper (resultado igual ao atual).
- `src/hooks/useReferralNetwork.ts`: filtrar `status !== 'CANCELLED'` para as estatísticas, calcular `totalNodes` e `nodesByLevel` via helper, e agrupar bônus por `referred_contract_id`/`referred_user_id` antes de montar os nós.
- `src/hooks/useFastStartProgress.ts`: trocar `referralsRes.data?.length` por contagem de `referred_user_id` distintos (a consulta já traz as linhas filtradas).
- `src/hooks/usePartnerReferrals.ts`: adicionar `CREDITED` em `getStatusLabel`/`getStatusColor` e nos agregados de valor onde hoje só `AVAILABLE`/`PAID` são considerados.
- Validação: comparar os números das três telas para o mesmo parceiro (Gustavo Felipe e um parceiro sem rede) via consulta SQL de referência.

# Contagem de "Indicados" por pessoas, não por registros de bônus

## Problema (verificado)

No painel do parceiro, os números de "Indicados" e da quebra "Diretos / 2º Nível / 3º Nível" são calculados contando **linhas da tabela de bônus** (`stats.total = activeBonuses.length` e `byLevel.levelN.count`).

Como um mesmo indicado pode gerar mais de um bônus (ex.: o Início Rápido cria linhas retroativas de +2% para indicados antigos), a contagem infla. No caso do Gustavo: aparecem 12 indicados e 7 diretos, quando na prática são **4 diretos e 5 de 2º nível (9 pessoas)**.

Valores financeiros estão corretos — o problema é só de contagem de pessoas.

## O que será feito

1. **Contar pessoas únicas**
   - No hook de indicações, contar `referred_user_id` distintos (ignorando bônus cancelados) para o total e para cada nível.
   - Uma pessoa que aparece em mais de um nível é contada uma vez em cada nível ao qual pertence, e uma única vez no total.

2. **Manter os valores como estão**
   - Somatórios em R$ por nível e "Total em bônus" continuam somando todos os registros de bônus (isso está correto).
   - Os cartões "Em validação" e "Disponíveis" continuam contando bônus, pois se referem a pagamentos e não a pessoas — os rótulos passam a deixar isso explícito ("Bônus em validação" / "Bônus disponíveis").

3. **Sem mudanças de regra**
   - Nenhuma alteração em cálculo de bônus, percentuais, carência, teto, banco de dados ou qualquer outro fluxo.

## Detalhes técnicos

- `src/hooks/usePartnerReferrals.ts`: trocar `.length` por contagem de `Set` de `referred_user_id` em `stats.total` e em `byLevel.levelN.count`; adicionar `bonusCount` por nível caso a UI precise do número de registros.
- `src/components/Partner/PartnerReferralSection.tsx`: usar os novos contadores nos cartões "Indicados", "Diretos", "2º Nível" e "3º Nível"; ajustar os rótulos dos cartões de bônus.
- Verificação: conferir na conta do Gustavo se passa a exibir 9 indicados, 4 diretos e 5 no 2º nível, mantendo R$ 20.000 em bônus.

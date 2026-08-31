# Mostrar data E horário da liberação dos bônus

A carência de 7 dias vence na **hora exata** da geração do bônus (168 horas), não à meia-noite. Hoje o painel do parceiro mostra só a data, o que dá a impressão de atraso quando o horário ainda não chegou.

## O que muda (apenas exibição)

Na aba de Indicações do painel do parceiro, coluna "Liberação":

- Bônus PENDENTE passa a exibir **data + hora** no fuso da Bahia (America/Bahia), ex.: `31/08/2026 às 19:09`.
- Abaixo, uma linha curta com o tempo restante, ex.: `faltam 8h` ou `faltam 2 dias`.
- Tooltip do status "Em validação" passa a explicar: carência de 7 dias corridos (168 horas) contados a partir do horário exato da ativação, com liberação automática logo após.

Mesmo tratamento no card/lista de bônus de rede quando exibe a data de liberação, para ficar consistente.

## Detalhes técnicos

- Novo helper de formatação (data + hora em America/Bahia, usando `date-fns-tz`, já presente no projeto) e cálculo de tempo restante.
- Ajustes em `src/components/Partner/PartnerReferralSection.tsx` (coluna Liberação e tooltip) e no componente equivalente de listagem de bônus.
- Nenhuma alteração de regra financeira, RPC, migration ou fluxo: só apresentação.

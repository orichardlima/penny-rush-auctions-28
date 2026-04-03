

# Exibir Todas as Características nos Cards dos Planos de Parceiro

## Problema

O card do plano (`PartnerPlanCard`) atualmente exibe: aporte, teto total, limite semanal, bônus de lances e benefícios genéricos. Faltam informações importantes como **pontuação binária** e **porcentagem de bônus por indicação**.

## Dados Disponíveis

| Plano | Aporte | Binário (pts) | Indicação (%) | Lances | Teto Semanal | Teto Total |
|---|---|---|---|---|---|---|
| Start | R$ 499 | 50 | 3% | 50 | R$ 12 | R$ 999 |
| Pro | R$ 1.499 | 150 | 6% | 150 | R$ 37 | R$ 3.000 |
| Elite | R$ 2.999 | 400 | 8% | 350 | R$ 75 | R$ 6.000 |
| Master | R$ 4.999 | 600 | 10% | 600 | R$ 125 | R$ 10.000 |
| Legend | R$ 9.999 | 1.000 | 12% | 1.200 | R$ 250 | R$ 20.000 |
| Diamond | R$ 25.000 | 2.500 | 16% | 3.000 | R$ 625 | R$ 55.000 |

Os pontos binários estão na tabela `partner_level_points` (separada), não no objeto `PartnerPlan`.

## Solução

### 1. Carregar pontos binários no `PartnerDashboard.tsx`

- Fazer query à tabela `partner_level_points` junto com os planos
- Criar um mapa `{ plan_name: points }` e passar como prop ao `PartnerPlanCard`

### 2. Atualizar `PartnerPlanCard.tsx`

Adicionar duas novas linhas de benefício no card:

- **Pontuação Binária**: ícone de rede + "X pontos na rede binária" (multiplicado por cotas)
- **Bônus por Indicação**: ícone de users + "X% de bônus por indicação direta"

Ambos já existem nos dados — `referral_bonus_percentage` já está no objeto `plan`, e `binary_points` será passado como prop adicional.

### 3. Atualizar interface `PartnerPlanCardProps`

Adicionar prop opcional `binaryPoints?: number` para receber os pontos binários do plano.

### Arquivos alterados

- `src/components/Partner/PartnerDashboard.tsx` — buscar `partner_level_points` e passar ao card
- `src/components/Partner/PartnerPlanCard.tsx` — adicionar exibição de pontos binários e % indicação
- `src/hooks/usePartnerContract.ts` — nenhuma alteração (interface `PartnerPlan` já tem `referral_bonus_percentage`)

### Nenhum outro arquivo do frontend alterado


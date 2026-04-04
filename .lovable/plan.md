

# Adicionar Rendimento da Semana Atual no PartnerDetailModal

## Objetivo

Adicionar uma seção de "Rendimento da Semana Atual" no modal de detalhes do parceiro no painel admin, reutilizando o hook `useCurrentWeekRevenue` e o componente `DailyRevenueBars` que já existem.

## Alterações

### `src/components/Admin/PartnerDetailModal.tsx`

1. Importar `useCurrentWeekRevenue` e `DailyRevenueBars`
2. Chamar o hook passando o contrato do parceiro selecionado (adaptar o objeto para a interface esperada: `{ id, aporte_value, weekly_cap, user_id, created_at }`)
3. Adicionar uma seção entre os summary cards e as tabs contendo:
   - Titulo "Rendimento da Semana Atual" com ícone `TrendingUp`
   - Total acumulado da semana em destaque (`totalPartnerShare`)
   - Porcentagem do aporte (`percentageOfAporte`)
   - Info de dias elegíveis e Pro Rata se aplicável
   - Componente `DailyRevenueBars` com as barras animadas dos 7 dias

### Nenhum outro arquivo alterado

O hook e o componente de barras já existem e são reutilizáveis sem modificação.


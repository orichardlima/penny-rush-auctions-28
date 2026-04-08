

# Adicionar seletor de cotas na ativação administrativa de planos

## Situação atual

O dialog de ativação de plano no painel admin (`AdminUserManagement.tsx`) sempre cria contratos com 1 cota. Não existe campo para o admin escolher a quantidade. Porém, planos como Legend e Diamond permitem até 3 cotas (`max_cotas = 3`).

## Solução

Adicionar um seletor de cotas no dialog de ativação, idêntico ao que já existe no `SponsorActivateDialog.tsx` e no fluxo de pagamento. Quando o admin seleciona um plano com `max_cotas > 1`, aparece o controle de +/- para escolher quantas cotas. Os valores de aporte, tetos e lances bônus são multiplicados proporcionalmente.

## Alterações

**Arquivo: `src/components/AdminUserManagement.tsx`**

1. Adicionar estado `adminCotas` (default 1), resetado quando muda o plano selecionado
2. Quando o plano selecionado tem `max_cotas > 1`, exibir seletor de cotas (botões -/+) abaixo do seletor de plano
3. Exibir resumo com valores multiplicados (aporte total, lances bônus, tetos)
4. No `assignPlanToUser`, multiplicar `aporte_value`, `weekly_cap`, `total_cap` e `bonus_bids` pelo número de cotas, e incluir `cotas` no INSERT do contrato
5. Registrar cotas no audit log

## Exemplo visual

Ao selecionar Diamond (R$ 25.000) com 2 cotas:
- Aporte total: R$ 50.000
- Teto semanal: multiplicado por 2
- Teto total: multiplicado por 2
- Lances bônus: 6.000

## Impacto

- Apenas o dialog de ativação administrativa é alterado
- Nenhuma mudança em banco de dados (coluna `cotas` já existe em `partner_contracts`)
- Triggers existentes (`ensure_partner_referral_bonuses`, `propagate_binary_points`) já recebem os valores multiplicados corretamente


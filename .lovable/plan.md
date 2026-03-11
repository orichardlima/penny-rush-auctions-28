

## Plano: Filtro por afiliado e resumo financeiro na aba Comissões

### Alterações em `src/components/AdminAffiliateManagement.tsx`

1. **Novo state** `commissionAffiliateFilter` (string, default `"all"`)

2. **Filtro por afiliado** — Adicionar um `Select` ao lado do filtro de status existente com a lista de afiliados que possuem comissões (nome + código). Filtrar `filteredCommissions` também por `affiliate_id`.

3. **Cards de resumo** — Abaixo dos filtros, exibir dois valores calculados a partir das comissões filtradas:
   - **Total em Compras**: soma de `purchase_amount` das comissões filtradas
   - **Total em Comissões**: soma de `commission_amount` das comissões filtradas

Duas pequenas caixas com ícone, valor e label, estilo consistente com o resto do painel.


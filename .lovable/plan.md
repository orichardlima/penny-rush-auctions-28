
Plano: cancelar as 2 compras expiradas e suas comissões pendentes da Juciene.

## Ação
Executar uma migration SQL pontual que:

1. Atualiza as 2 compras (`bid_purchases` IDs `3e987807...` e `27c2fae8...`) de `payment_status='pending'` para `payment_status='expired'`.
2. Atualiza as 2 comissões correspondentes do afiliado warlley silva em `affiliate_commissions` de `status='pending'` para `status='cancelled'`.

## Resultado esperado
- Histórico do afiliado limpo, sem comissões "fantasma" em pendente.
- Compras expiradas marcadas corretamente, sem creditar lances.
- Nenhuma alteração de saldo necessária (comissões nunca foram aprovadas, então não impactaram `commission_balance`).

## Arquivos
- 1 migration SQL (apenas UPDATE de dados, sem mudanças de schema nem código).

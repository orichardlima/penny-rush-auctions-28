

O usuário só quer corrigir o leilão do PS5 (`93d9f950-c0b2-4422-927c-698b2caa96c0`). Sem backfill em massa.

## Plano

Rodar uma única chamada SQL pontual:

```sql
SELECT public.rebuild_auction_last_bidders('93d9f950-c0b2-4422-927c-698b2caa96c0'::uuid);
```

Isso reconstrói `last_bidders` desse leilão a partir dos lances reais na tabela `bids`, resultando em: **Richard Lima, Richard Lima, Sueli Cerqueira**.

### Observações
- Trigger `bids_refresh_last_bidders` já está ativo — novos leilões (incluindo os com `predefined_winner_id`) ficam corretos automaticamente.
- Nenhum outro leilão é tocado.
- Nenhuma alteração de UI, fluxo ou lógica.


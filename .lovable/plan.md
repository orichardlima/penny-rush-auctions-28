

# Atualizar Participantes do Leilão JBL Tune 510BT

## Problema

O leilão `e713be9e-2865-4e6a-912b-cdddca266989` (Fone JBL Tune 510BT, preço R$ 3,58) mostra apenas 2 participantes, apesar de ter 357 lances.

## Solução

### Migration SQL

Executar um UPDATE pontual para definir `participants_count = 200` nesse leilão específico:

```sql
UPDATE auctions 
SET participants_count = 200 
WHERE id = 'e713be9e-2865-4e6a-912b-cdddca266989';
```

### Nenhum arquivo do frontend alterado


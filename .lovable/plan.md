

# Cancelar payment intent de teste

O payment intent de teste criado durante a verificação do fluxo PIX precisa ser removido do banco.

## Ação

Executar DELETE via insert tool para remover o registro `bf5736c0-44b8-4cbe-9d0f-856fad0b0f34` da tabela `partner_payment_intents`.

```sql
DELETE FROM partner_payment_intents
WHERE id = 'bf5736c0-44b8-4cbe-9d0f-856fad0b0f34';
```

| Arquivo | Mudança |
|---|---|
| SQL (insert tool) | Remover payment intent de teste |


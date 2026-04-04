

# Alterar Código de Afiliado do Ramon para RAMONMIRANDA

## Ação

Executar um UPDATE na tabela `affiliates` para trocar o código de `RAMONC157` para `RAMONMIRANDA`.

```sql
UPDATE affiliates 
SET affiliate_code = 'RAMONMIRANDA' 
WHERE id = '0817fe6b-e05f-4ac5-9bdc-d59d5df4a86c';
```

## Impacto

- Links antigos com `?ref=RAMONC157` pararão de funcionar
- Os novos links usarão `?ref=RAMONMIRANDA`
- Nenhum arquivo do frontend alterado


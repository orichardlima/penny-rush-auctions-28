

## Corrigir erro ao criar contrato de parceiro: status "PENDING" nao permitido

### Problema

A tabela `partner_contracts` possui uma CHECK constraint (`partner_contracts_status_check`) que so permite os valores:
- `ACTIVE`
- `CLOSED`
- `SUSPENDED`

A Edge Function `partner-payment` tenta inserir contratos com `status: 'PENDING'`, que nao esta na lista permitida, causando o erro:

> new row for relation "partner_contracts" violates check constraint "partner_contracts_status_check"

### Solucao

Alterar a CHECK constraint para incluir o valor `PENDING` na lista de status permitidos.

### Detalhes tecnicos

**Migration SQL**:
```sql
ALTER TABLE partner_contracts DROP CONSTRAINT partner_contracts_status_check;
ALTER TABLE partner_contracts ADD CONSTRAINT partner_contracts_status_check 
  CHECK (status = ANY (ARRAY['ACTIVE', 'CLOSED', 'SUSPENDED', 'PENDING']));
```

### O que NAO muda

- Nenhuma alteracao em codigo frontend ou edge functions
- Nenhuma outra tabela e afetada
- Contratos existentes continuam validos


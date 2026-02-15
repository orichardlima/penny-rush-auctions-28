

## Mover Luciano para filho direito do Adailton (com sponsor)

### Situacao Atual

| Campo | Valor Atual |
|-------|-------------|
| parent_contract_id | Binario 9 (`a797b7e7`) |
| sponsor_contract_id | `c42ad205` |
| position | left |

### Situacao Desejada

| Campo | Novo Valor |
|-------|------------|
| parent_contract_id | Adailton (`9d9db00f`) |
| sponsor_contract_id | Adailton (`9d9db00f`) |
| position | right |

### Operacoes (3 UPDATEs)

1. **Remover Luciano de Binario 9**: `left_child_id = NULL` no registro de Binario 9 (`a797b7e7`)
2. **Atualizar Luciano** (`60eda7ef`): `parent_contract_id = 9d9db00f`, `sponsor_contract_id = 9d9db00f`, `position = 'right'`
3. **Registrar Luciano como filho direito do Adailton** (`9d9db00f`): `right_child_id = 60eda7ef`

### O Que NAO Muda

- Pontos acumulados permanecem intactos
- Nenhum codigo, interface ou schema e alterado


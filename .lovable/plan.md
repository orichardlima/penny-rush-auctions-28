

## Plano: Excluir todos os contratos SUSPENDED

### Resumo dos dados

Existem **8 contratos suspensos**. Alguns possuem registros dependentes que precisam ser removidos antes:

| Contrato | Plano | Total Recebido | Dependências |
|----------|-------|----------------|-------------|
| 3de772a6 (Adailton) | Legend | R$ 0 | Nenhuma |
| 7146a4a2 (Adailton) | Legend | R$ 0 | Nenhuma |
| b3248c07 (Adailton) | Legend | R$ 0 | Nenhuma |
| 563c8aef | Legend | R$ 0 | Nenhuma |
| a9b4cf4f | Legend | R$ 0 | Nenhuma |
| 71532e32 | ELITE | R$ 0 | 1 upgrade, 1 posição binária |
| 8938e138 | PRO | R$ 25,48 | 1 payout, 1 posição binária |
| e3723202 | PRO | R$ 52,00 | 2 payouts, 1 upgrade, 1 posição binária |

### Atenção

Os contratos `8938e138` e `e3723202` possuem `total_received > 0`, ou seja, já receberam repasses. Excluí-los apagará esse histórico financeiro permanentemente.

### Execução

A exclusão será feita via SQL (ferramenta de inserção/deleção), na seguinte ordem para respeitar chaves estrangeiras:

1. Deletar registros de `partner_payouts` vinculados aos contratos suspensos
2. Deletar registros de `partner_upgrades` vinculados
3. Deletar registros de `partner_binary_positions` vinculados
4. Deletar os 8 registros de `partner_contracts` com `status = 'SUSPENDED'`

Nenhuma alteração de código ou schema será necessária.


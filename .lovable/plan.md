## Auditoria

Mapeei todos os caminhos que fazem upgrade de plano/cotas no projeto:

| Fluxo | Arquivo | Insere em `partner_upgrades`? | Propaga binário manualmente? |
|---|---|---|---|
| Webhook VeoPag (plano) | `veopag-webhook` linha 380 | Sim | Não |
| Webhook VeoPag (cotas) | `veopag-webhook` linha 516 | Sim | Não |
| Webhook Magen (plano) | `magen-webhook` / `magen-check-status` | Sim | Não |
| Webhook Asaas legacy | `partner-payment-webhook` | Sim | Não |
| **Admin: upgrade de plano** | `useAdminPartners.upgradeContractPlan` (1623+) | **Sim (linha 1687)** | **Sim (linha 1719+)** |
| **Admin: upgrade de cotas** | `useAdminPartners.upgradeContractCotas` (1506+) | **Não** | **Sim (linha 1564)** |

### Problemas detectados

**Problema 1 — Dupla propagação no upgrade admin de plano**
Agora que o trigger `trg_upgrade_propagate_binary` propaga automaticamente em todo INSERT em `partner_upgrades`, o código admin que também chama `propagate_binary_points` manualmente vai **dobrar os pontos** enviados aos uplines em todo upgrade de plano feito pelo admin.

**Problema 2 — Inconsistência no upgrade admin de cotas**
Esse fluxo nunca inseriu em `partner_upgrades` — só chamava `propagate_binary_points` diretamente. Resultado:
- A propagação até funciona (manual), mas usa `partner_level_points.points` em vez de `partner_plans.binary_points` (fonte que o trigger usa). Se os dois valores divergirem, o resultado é diferente do webhook PIX.
- Não fica registro em `partner_upgrades` → histórico do parceiro fica incompleto, relatórios de cashflow/cotas não enxergam o upgrade, `useCurrentWeekRevenue` e `useDailyPayoutPreview` ignoram esses upgrades.

## Correções

### 1. `upgradeContractPlan` (admin)
Remover o bloco de propagação manual (linhas ~1702–1740, tudo após o `INSERT INTO partner_upgrades`). O trigger faz isso sozinho com o cálculo correto (`(novo_plano.binary_points − antigo_plano.binary_points) × cotas`).

Manter:
- update do `partner_contracts`
- crédito de bônus de lances extras
- `INSERT INTO partner_upgrades` (já dispara o trigger)
- audit log

### 2. `upgradeContractCotas` (admin)
- Adicionar `INSERT INTO partner_upgrades` com `previous_plan_name = new_plan_name = contract.plan_name`, `previous_aporte_value = contract.aporte_value`, `new_aporte_value = newAporte`, demais campos `previous_*`/`new_*` preenchidos, `difference_paid = 0`, `notes = 'Upgrade administrativo de cotas (sem pagamento PIX)'`.
- Remover o bloco de propagação manual (linhas ~1541–1571). O trigger calcula `plano.binary_points × (newCotas − previousCotas)` automaticamente, lendo `previous_aporte_value`/`new_aporte_value` da linha inserida.

Manter: update do contrato, recálculo dos bônus de indicação, audit log.

### 3. Garantia adicional
Após as duas mudanças, todos os 6 caminhos de upgrade do projeto passarão obrigatoriamente por `INSERT INTO partner_upgrades` → trigger → propagação única e consistente, sem possibilidade de dupla contagem nem de upgrade "invisível".

## Validação

- Após aplicar, simular um upgrade admin de plano e um de cotas em um contrato de teste e conferir em `binary_points_log` que existe exatamente **um** lote de entradas `reason='plan_upgrade'` por upgrade (não dois).
- Conferir que o delta nas linhas de `binary_points_log` bate com `(novo − antigo) × cotas` para plano e `pts × Δcotas` para cotas.

## Detalhes técnicos

Nenhuma migração SQL necessária — o trigger já está ativo. Mudanças exclusivamente em `src/hooks/useAdminPartners.ts`:
- Remover ~40 linhas do bloco de propagação manual em `upgradeContractPlan`.
- Em `upgradeContractCotas`: substituir o bloco de propagação manual (~30 linhas) por um `INSERT` enxuto em `partner_upgrades`.

Posso aplicar?
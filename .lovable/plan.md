
## Conclusão da Investigação

As entradas `reason='plan_upgrade'` em `binary_points_log` existem (dias 06/06, 14/04, 11/04, 07/04), mas **nenhum código** (edge function, trigger, função SQL armazenada ou frontend) chama `propagate_binary_points(..., 'plan_upgrade')`. As 10 entradas mais recentes têm `created_at` idênticos por lote (mesmo timestamp ao milissegundo), o que é assinatura de execução manual via SQL Editor.

**Veredito:** a propagação que você lembrava foi feita **manualmente via SQL pelo admin** após cada upgrade — não é automática. Upgrades em que isso foi esquecido (ex.: contrato `c42ad205` em 01/06, 21/01, 16/01) ficaram sem propagação e os uplines nunca receberam os pontos da diferença.

## Plano de Correção

Tornar a propagação automática e atômica para 100% dos upgrades futuros, com opção de backfill para upgrades já realizados.

### 1. Trigger no `partner_upgrades` (AFTER INSERT)

Nova função `trigger_propagate_upgrade_binary_points()` que dispara em todo INSERT na tabela `partner_upgrades` e:

- Lê o registro de upgrade (campos: `partner_contract_id`, `previous_plan_name`, `new_plan_name`, `previous_aporte_value`, `new_aporte_value`, `previous_cotas`, `new_cotas`, `upgrade_type`).
- Busca `binary_points` dos planos antigo e novo em `partner_plans`.
- Calcula:
  - **Upgrade de plano:** `delta = (novo_plano.binary_points × cotas_atual) − (antigo_plano.binary_points × cotas_atual)`
  - **Upgrade de cotas:** `delta = plano.binary_points × (novas_cotas − cotas_antigas)`
- Se `delta > 0`: chama `propagate_binary_points(partner_contract_id, delta, 'plan_upgrade')`.
- Loga em `binary_points_log` (já feito dentro da função `propagate_binary_points`).
- Respeita a flag `is_demo` (já tratada dentro de `propagate_binary_points`).

### 2. Garantir que o webhook crie o registro em `partner_upgrades`

Verificar `partner-payment-webhook` (handlers `processUpgradePayment` e `processCotasUpgrade`) e confirmar que **antes** de retornar 200 ele faz `INSERT INTO partner_upgrades(...)` com `previous_*` e `new_*` preenchidos. Se não fizer, adicionar esse insert — assim o trigger acima dispara automaticamente sem precisar editar a lógica de propagação no webhook.

### 3. Backfill opcional (decisão sua)

Script SQL único para identificar upgrades históricos cuja propagação não consta em `binary_points_log` com `reason='plan_upgrade'` e:
- Calcular o delta retroativo.
- Executar `propagate_binary_points(contract_id, delta, 'plan_upgrade_backfill')`.
- Listar em tela antes de aplicar (dry-run primeiro).

Casos detectados como pendentes:
- `c42ad205` Start→Elite (16/01) e Elite→Legend (21/01)
- `c42ad205` Legend→Diamond (01/06)
- Qualquer outro upgrade fora dos 4 lotes manuais já feitos

### 4. Validação

Após criar o trigger:
- Inserir manualmente um `partner_upgrades` de teste em ambiente controlado e verificar que `binary_points_log` recebe as entradas `plan_upgrade` em todos os uplines.
- Comparar `left_points` / `right_points` em `partner_binary_positions` antes e depois.

### Detalhes Técnicos

```sql
-- Pseudocódigo do trigger
CREATE FUNCTION trigger_propagate_upgrade_binary_points() RETURNS TRIGGER AS $$
DECLARE
  v_old_pts INT; v_new_pts INT; v_delta INT;
  v_old_cotas INT; v_new_cotas INT;
BEGIN
  IF NEW.upgrade_type = 'cotas' THEN
    SELECT binary_points INTO v_new_pts FROM partner_plans WHERE name = NEW.new_plan_name;
    v_delta := v_new_pts * (NEW.new_cotas - NEW.previous_cotas);
  ELSE -- plan upgrade
    SELECT binary_points INTO v_old_pts FROM partner_plans WHERE name = NEW.previous_plan_name;
    SELECT binary_points INTO v_new_pts FROM partner_plans WHERE name = NEW.new_plan_name;
    SELECT cotas INTO v_old_cotas FROM partner_contracts WHERE id = NEW.partner_contract_id;
    v_delta := (v_new_pts - v_old_pts) * v_old_cotas;
  END IF;

  IF v_delta > 0 THEN
    PERFORM propagate_binary_points(NEW.partner_contract_id, v_delta, 'plan_upgrade');
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_upgrade_propagate_binary
AFTER INSERT ON partner_upgrades
FOR EACH ROW EXECUTE FUNCTION trigger_propagate_upgrade_binary_points();
```

### Perguntas antes de executar

1. Confirma que o webhook **já insere** em `partner_upgrades` em ambos os fluxos (plano e cotas)? Posso verificar e adicionar o INSERT se faltar.
2. Quer incluir o **backfill retroativo** dos upgrades sem propagação (item 3) nesta mesma rodada, ou fazer só a automação daqui pra frente?

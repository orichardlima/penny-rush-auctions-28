

## Plano: Realocar Cláudio na rede de Mariano

### Situação Atual
- **Cláudio** está posicionado como filho **direito** da **Lavínia**, com sponsor = **Richard Lima**
- **Mariano** tem a perna **direita vazia** — é o destino natural
- Cláudio gerou 1000 pontos (right) para 4 ancestrais na cadeia atual (Lavínia → upline)

### Operações necessárias (via SQL direto no banco)

**1. Remover Cláudio do pai atual (Lavínia)**
- Setar `right_child_id = NULL` na posição binária da Lavínia

**2. Atualizar a posição binária do Cláudio**
- `parent_contract_id` → Mariano (`879cbe85...`)
- `sponsor_contract_id` → Mariano (`879cbe85...`)
- `position` → `right`

**3. Vincular Cláudio como filho direito do Mariano**
- Setar `right_child_id = 45044294...` (Cláudio) na posição binária do Mariano

**4. Atualizar o contrato do Cláudio**
- `referred_by_user_id` → Mariano (`14ddc8ca...`)

**5. Corrigir pontuação — Remover pontos do upline antigo**
- Subtrair 1000 pontos (right) de: Lavínia, e dos 3 ancestrais acima que receberam pontos right por causa do Cláudio

**6. Propagar pontos pelo novo upline**
- Adicionar 1000 pontos (right) para Mariano e seus ancestrais acima na cadeia binária

**7. Registrar no log de auditoria**
- Inserir registro em `admin_audit_log` documentando a movimentação

### Nota importante
Conforme a memória do projeto, a movimentação manual **não** dispara recálculo automático de pontos. Os ajustes de `left_points`/`right_points` nos ancestrais antigos e novos precisam ser feitos manualmente via SQL para evitar inconsistências.


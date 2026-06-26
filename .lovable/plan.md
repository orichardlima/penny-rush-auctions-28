## Objetivo
Estornar os **1.000 pts órfãos** do Lado A (esquerda) do contrato do Mariano roney (`879cbe85…`), preservando histórico e rastreabilidade, e auditar a rede para detectar casos semelhantes.

## Diagnóstico confirmado
- `partner_binary_positions` do Mariano: `left_child_id = NULL`, `left_points = 1000`, `total_left_points = 1000`.
- Origem em `binary_points_log`: 1 lançamento de `+1000` (`position=left`, `reason=new_partner`) datado de 2026-03-04, com `source_contract_id = 33eaf347…` (Operação Rio).
- O contrato Operação Rio hoje está posicionado dentro do subtree **direito** (Luiz → Luis Paulo → Operação Rio). Logo, o crédito à esquerda do Mariano é resíduo de uma movimentação antiga não estornada.

## Solução (cirúrgica, em 3 camadas)

### 1. Função RPC `reverse_orphan_binary_points(contract_id, position, reason_note)`
- Security definer, somente admin (`has_role`).
- Calcula `orphan = points` do lado indicado **se** `child_id IS NULL` (defensivo).
- Insere lançamento em `binary_points_log` com `points_added = -orphan`, `reason = 'orphan_reversal'`, `source_contract_id = contract_id`, preservando os registros originais (nada é apagado).
- Atualiza `partner_binary_positions`: zera `left_points`/`right_points` e `total_…_points` correspondentes.
- Registra em `admin_audit_log` (ação `binary_orphan_reversal`) com payload `{contract_id, position, amount, note}`.
- Retorna JSON `{success, reversed_amount, log_id}`.

### 2. View / RPC de auditoria `find_orphan_binary_points()`
- Retorna todos os contratos onde `(left_child_id IS NULL AND left_points > 0)` ou `(right_child_id IS NULL AND right_points > 0)`.
- Usada pelo painel admin para listar candidatos antes da ação.

### 3. UI no painel admin (aba Binário do parceiro)
- Em `AdminPartnerManagement` (ou onde fica o detalhe do parceiro / árvore binária), adicionar um card **"Pontos órfãos detectados"** que só aparece quando `find_orphan_binary_points` retorna a linha do parceiro.
- Botão **"Estornar pontos órfãos do Lado X"** com confirmação dupla (modal explicando que: a) o estorno é registrado em log imutável; b) afeta apenas a perna sem filho; c) ação fica em `admin_audit_log`).
- Campo opcional `Motivo / observação` (mínimo 10 chars) que vai junto no log.
- Após sucesso, toast + refetch da árvore e dos pontos.

## Execução para o caso Mariano
Após o painel pronto, o admin abre o perfil do Mariano → aba Binário → clica em "Estornar pontos órfãos do Lado A" → preenche motivo (sugestão pré-preenchida: *"Estorno do crédito de 1.000 pts do contrato Operação Rio (33eaf347) gerado em 04/03/2026 e nunca revertido quando o contrato foi remanejado para o subtree direito."*) → confirma.

Resultado esperado:
- `binary_points_log` ganha 1 linha `points_added = -1000, reason = 'orphan_reversal'`.
- `partner_binary_positions`: `left_points = 0`, `total_left_points = 0`.
- `admin_audit_log` ganha 1 entrada com o motivo.
- UI da árvore passa a mostrar Lado A = 0 (coerente com "Vazio").

## Detalhes técnicos
- **Migration** cria: função `reverse_orphan_binary_points`, função `find_orphan_binary_points` e (se necessário) ajusta a função `protect_partner_contract_fields`/triggers de proteção para permitir o UPDATE via flag de sessão (`app.allow_system_binary_update = 'true'`), no mesmo padrão já usado em `total_received`/`total_withdrawn`.
- **Imutabilidade do histórico**: nenhum `DELETE` ou `UPDATE` nos registros existentes de `binary_points_log`; apenas inserção do contralançamento.
- **Sem efeitos colaterais**: como o lado A nunca foi qualificado (sem filho), não há `binary_bonuses` pagos vinculados a esses 1.000 pts — confirmado pela ausência de pareamento (Lado A = 1.000 < Lado B = 32.150 e ciclos nunca fecharam por esse lado). A função, ainda assim, valida `NOT EXISTS` em `binary_cycle_closures` referenciando esses pontos antes de prosseguir; se encontrar, aborta com mensagem clara.
- **Escopo**: nenhuma alteração em UI/lógica não relacionada (regra do projeto preservada).

## Entregáveis
1. Migration SQL com as duas funções + ajuste de proteção.
2. Componente React (card + modal de confirmação) na aba Binário do parceiro.
3. Hook `useOrphanBinaryPoints(contractId)` para consultar/estornar.
4. Documentação curta no card explicando o conceito de "ponto órfão".

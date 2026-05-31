## Contexto

Sabriny quer sair da rede de Géssica. Decisões confirmadas:

1. Sabriny continua parceira ativa
2. Vai direto para empresa (sem patrocinador / órfã no topo)
3. Bônus já AVAILABLE mas não sacados → reverter
4. Remover Sabriny da perna binária de Géssica
5. Vai se repetir → construir ferramenta admin reutilizável

## Plano: Ferramenta Admin "Transferir Patrocinador"

### 1. Nova tela admin: `/admin/partners/transfer-sponsor`

Acesso via menu admin existente (Gestão de Parceiros). Fluxo:

- **Buscar parceiro** (por nome/CPF/email) → seleciona contrato ativo
- **Mostrar situação atual**: patrocinador direto, posição binária (parent + lado), bônus pendentes/disponíveis gerados para o upline
- **Escolher novo destino**:
  - Empresa (órfão - `referred_by_user_id = NULL`, `referrer_contract_id = NULL`)
  - Outro parceiro ativo (busca)
- **Opções de reversão** (checkboxes):
  - [ ] Cancelar bônus de indicação PENDING do antigo patrocinador
  - [ ] Reverter bônus AVAILABLE não sacados (debita `available_balance` do antigo upline, marca bônus como CANCELLED)
  - [ ] Remover da árvore binária do antigo patrocinador (desconecta posição + recalcula pontos do leg afetado)
- **Confirmação dupla** com resumo do impacto financeiro
- **Auditoria**: registra tudo em `admin_audit_log` com `action_type='TRANSFER_SPONSOR'`

### 2. Função SQL `admin_transfer_partner_sponsor(...)`

SECURITY DEFINER, só admin pode executar. Em transação única:

- Atualiza `partner_contracts.referred_by_user_id` e `referrer_contract_id` da Sabriny
- Limpa `partner_intents` antigas relacionadas a Géssica
- Atualiza `affiliate_referrals` se houver
- Se "remover da árvore binária":
  - Desconecta Sabriny da posição atual (zera `left_child_id`/`right_child_id` no parent)
  - Subtrai pontos binários propagados pela Sabriny do leg de Géssica e uplines (recalcula `total_left_points`/`total_right_points`)
  - Sabriny fica órfã na binária (admin pode reposicionar depois via tela de relocação existente)
- Se "reverter bônus":
  - `UPDATE partner_referral_bonuses SET status='CANCELLED'` onde beneficiário = Géssica e origem = Sabriny e `status IN ('PENDING','AVAILABLE')`
  - Para AVAILABLE: debita `available_balance` de Géssica (`UPDATE partner_contracts SET available_balance = available_balance - X`)
- Insere log em `admin_audit_log` com `old_values`/`new_values` completos

### 3. Caso específico Sabriny → Empresa (executar agora)

Após aprovar e construir a tela:
- Admin abre a ferramenta
- Busca Sabriny → seleciona "Empresa" como destino
- Marca as 3 opções de reversão
- Confirma

Tudo via UI, sem migração manual. Próximas brigas → mesmo fluxo.

## Detalhes Técnicos

**Tabelas afetadas:**
- `partner_contracts` (referred_by_user_id, available_balance)
- `partner_binary_positions` (desconecta posição, zera pontos propagados)
- `partner_intents` (limpa)
- `affiliate_referrals` (limpa se existir)
- `partner_referral_bonuses` (CANCELLED)
- `admin_audit_log` (registro)

**Arquivos novos:**
- `src/pages/admin/TransferSponsor.tsx` — tela
- `src/components/admin/TransferSponsor/PartnerSearch.tsx`
- `src/components/admin/TransferSponsor/CurrentStateView.tsx`
- `src/components/admin/TransferSponsor/TransferForm.tsx`
- `src/components/admin/TransferSponsor/ConfirmDialog.tsx`
- Migration: função `admin_transfer_partner_sponsor`

**Rota** adicionada em `src/App.tsx` + item no menu admin.

**Não altera** nenhuma funcionalidade existente — só adiciona nova tela e função SQL.

## Pontos de Atenção

- **Pontos binários já consumidos em ciclos fechados** (binary_bonuses com status PAID para Géssica) NÃO são revertidos — apenas os ainda não pagos. Decisão registrada como regra: bônus PAGOS são definitivos.
- **Sabriny precisa ser reposicionada na binária** depois (usar tela existente `admin/binary/partner-relocation` se admin quiser colocá-la em outro lugar; senão fica órfã sem rede).
- Saldo de Géssica pode ficar negativo se ela já consumiu o crédito em outra coisa — sistema permite, admin vê alerta antes de confirmar.

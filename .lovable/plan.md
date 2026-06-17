
# Auditoria e Sistema de Aceite Eletrônico de Contratos

## 1. Auditoria — situação atual

### O que JÁ existe no banco
- **`profiles.bettor_contract_accepted_at`** (timestamptz) + **`profiles.bettor_contract_version`** (text) — criadas hoje. Preenchidas via trigger `trg_set_bettor_contract_meta` a partir de `auth.users.raw_user_meta_data` no cadastro.
- **`partner_contracts`** — registra adesão ao plano (user_id, plan_name, aporte_value, payment_status, created_at) mas **NÃO tem nenhuma coluna de aceite eletrônico do contrato de parceiro**.
- **`partner_payment_intents`** — registra intenção de pagamento mas também sem aceite.
- **`system_settings`** — contém `contract_partner_text` (texto vigente), mas sem versionamento histórico.
- **`profiles`** — possui CPF, e‑mail, telefone, endereço.
- **Auditoria de IP/User‑Agent: NÃO existe em lugar nenhum.**

### Conclusão sobre o caso da Parceira Sabriny
- O contrato de parceiro **ainda não tinha** registro de aceite eletrônico até hoje. O aceite era exibido em diálogo (`PartnerContractTermsDialog`) no checkout, mas o checkbox marcado **não era persistido**.
- A evidência atual que pode ser reunida hoje para ela: `partner_contracts.created_at` (data da adesão), `payment_status='completed'` + `payment_id` (pagamento PIX confirmado), `profiles.cpf/email/phone/full_name`, logs do webhook VeoPag (`bot_webhook_logs` se aplicável). **Não há IP, user‑agent nem checkbox registrado** para contratos antigos.
- A partir desta entrega, todo novo aceite gerará evidência completa.

## 2. Mudanças no banco (migração)

### Nova tabela `contract_versions` (versionamento imutável)
Campos: `id`, `contract_type` ('partner' | 'bettor'), `version` (text), `title`, `content` (text), `content_hash` (sha256 calculado por trigger), `is_active` (bool), `effective_from`, `created_at`, `created_by`.
- Trigger BEFORE INSERT calcula `content_hash = encode(digest(content,'sha256'),'hex')`.
- Trigger BEFORE UPDATE/DELETE **bloqueia** alteração de versão já referenciada por algum aceite (somente `is_active` pode ser alternado).
- Quando admin salva novo texto em `system_settings.contract_partner_text`, função `publish_contract_version()` cria nova linha com `version = 'vN+1'`.

### Nova tabela `contract_acceptances` (registro imutável de aceite)
Campos:
`id`, `user_id`, `contract_type`, `contract_version_id` (FK → contract_versions), `version_label`, `content_hash`,
`partner_contract_id` (FK opcional), `origin` ('signup' | 'partner_adhesion' | 'partner_upgrade' | 'renewal' | 'amendment'),
`full_name`, `cpf`, `email`, `phone`,
`plan_name`, `plan_value`,
`ip_address` (inet), `user_agent` (text), `browser`, `os`, `device`,
`route` (text), `declaration_text` (text — frase exata do checkbox),
`accepted_at_client` (timestamptz informado pelo cliente), `server_timestamp` (timestamptz default now()),
`payment_reference` (text), `extra` (jsonb), `created_at`.

RLS:
- SELECT: o próprio usuário (`user_id = auth.uid()`) ou admin.
- INSERT: usuário autenticado (somente para si).
- **UPDATE/DELETE: bloqueado para todos via policy `USING (false)`** — incluindo admin. (Imutabilidade.)
- GRANT SELECT/INSERT a `authenticated`; SELECT a admin via policy `has_role` (já não, usa `is_admin`).

### Nova tabela `contract_evidence_access_log`
Para auditoria de quem visualizou/exportou um aceite: `id`, `acceptance_id`, `admin_user_id`, `action` ('view' | 'export_pdf' | 'export_financial' | 'copy_legal'), `accessed_at`, `ip_address`, `user_agent`.

### Função RPC `register_contract_acceptance(...)`
SECURITY DEFINER. Recebe payload do frontend (contract_type, origin, declaration_text, ip, user_agent, etc.), busca a versão ativa em `contract_versions`, insere em `contract_acceptances` retornando o `id`.

### Função RPC `generate_partner_evidence_report(partner_contract_id uuid)`
Retorna jsonb com: dados cadastrais, datas, plano, valor, aceite eletrônico (versão, hash, IP, UA), histórico financeiro (payouts, withdrawals, referral bonuses, bid_purchases, bids), termination request se houver, cálculo do cancelamento (ver seção 5). Admin‑only.

### Seed da versão atual
Insert da versão `v1` em `contract_versions` (partner + bettor) usando o texto atual de `system_settings` / fallback no código.

## 3. Frontend — captura do aceite

### `PartnerContractTermsDialog`
- Checkbox já existe, **não vem marcado** (já é o caso). Mudar o texto da declaração para a frase oficial solicitada (multa de 30%, prazo 7 dias, etc.).
- Link “Ler Contrato de Adesão ao Programa de Parceiros” acima do checkbox (abre a versão ativa em scroll).
- Botão “Aceitar e Continuar” já fica desabilitado até o checkbox.
- Ao clicar “Aceitar”: chamar RPC `register_contract_acceptance` com:
  - `contract_type='partner'`, `origin='partner_adhesion'` (ou `'partner_upgrade'` quando vier do upgrade dialog),
  - `declaration_text` = frase exata,
  - `ip_address` obtido via `https://api.ipify.org?format=json`,
  - `user_agent = navigator.userAgent`,
  - `route = window.location.pathname`,
  - `plan_name`, `plan_value`.
- Guardar o `acceptance_id` retornado e vinculá‑lo ao `partner_contract` quando criado (update via webhook ou via RPC que recebe o `acceptance_id` no payload da intenção de pagamento).

### `BettorContractTermsDialog` (cadastro)
- Mesmo padrão para o contrato de apostador no signup. Já existe campo no `auth.users.raw_user_meta_data`; adicionar chamada à RPC após o `signUp` bem‑sucedido (no `AuthContext.signUp`), passando IP/UA.

### Sem mudanças em fluxo comercial
Nenhuma alteração em regras de repasses, planos, bônus, leilões, rede binária.

## 4. Painel administrativo

### Nova aba/seção “Evidências do Aceite Eletrônico”
Localização: dentro de `AdminPartnerManagement` ao abrir detalhe de um parceiro (e também acessível pela tela de um `partner_contract`).

Exibe:
- Status do aceite (✔ Assinado eletronicamente / ⚠ Sem registro de aceite digital — apenas evidências indiretas para contratos antigos).
- Data/hora do aceite (server_timestamp), versão, hash do conteúdo, IP, user agent, browser/SO/device.
- CPF, e‑mail, telefone, plano, valor.
- Botões:
  - **Ver contrato aceito** → modal com o `content` exato da versão (read‑only, com hash visível).
  - **Exportar relatório em PDF** → chama RPC `generate_partner_evidence_report`, monta PDF no cliente com `jspdf` (já no projeto? se não, adicionar) com título “RELATÓRIO DE ACEITE ELETRÔNICO E HISTÓRICO CONTRATUAL DO PARCEIRO”, contendo todas as seções (cadastro, adesão, aceite eletrônico, financeiro, cancelamento se houver, texto integral do contrato com hash).
  - **Exportar histórico financeiro** → CSV com repasses, saques, bônus, lances.
  - **Copiar resumo jurídico** → copia texto: *“O parceiro [NOME], CPF [CPF], aderiu eletronicamente ao Programa de Parceiros da Show de Lances em [DATA/HORA], mediante cadastro na plataforma e aceite eletrônico da versão [VERSÃO] do Contrato de Adesão ao Programa de Parceiros. O aceite foi registrado pelo sistema com IP [IP], user agent [USER AGENT], plano contratado [PLANO], valor [VALOR], ficando vinculado às regras contratuais vigentes na data da adesão.”*
- Toda ação chama RPC `log_evidence_access` que grava em `contract_evidence_access_log`.

### Para contratos antigos (sem `contract_acceptances`)
A seção exibe banner amarelo: *“Aceite eletrônico digital não registrado (anterior a 17/06/2026). Evidências indiretas disponíveis: cadastro, pagamento PIX confirmado, dados cadastrais autodeclarados, IP do pagamento (webhook).”* O PDF é gerado mesmo assim, com essas evidências.

## 5. Cálculo de cancelamento antecipado

Função SQL `calculate_early_termination(partner_contract_id uuid)` retorna jsonb:
- `aporte`, `data_adesao`, `data_solicitacao`, `dias_decorridos`, `dentro_garantia_7d` (bool).
- `total_repasses` (sum `partner_payouts.amount`), `total_saques` (`partner_withdrawals`), `bonus_recebidos` (`partner_referral_bonuses` + binários), `lances_recebidos` (`bonus_bids_received`), `lances_utilizados` (`bids` da conta).
- Se `dentro_garantia_7d AND total_repasses=0 AND total_saques=0 AND bonus_recebidos=0 AND lances_utilizados=0`: `devolucao_integral = aporte`, prazo 10 dias.
- Caso contrário: `multa = aporte * 0.30`; `descontos = total_repasses + total_saques + valor_monetario_bonus + valor_monetario_lances_utilizados`; `saldo_final = aporte - multa - descontos`; se ≤ 0 → sem devolução; senão prazo 30 dias.

A função é apenas **leitura/cálculo**; não altera nada nem encerra contrato. O resultado é exibido na nova seção e no PDF. O fluxo atual de `partner_early_terminations` permanece intacto.

## 6. Segurança e integridade

- `contract_acceptances`: RLS bloqueia UPDATE/DELETE para todos (inclusive admin). Apenas SELECT (próprio ou admin) e INSERT (próprio via RPC).
- `contract_versions`: trigger impede alterar conteúdo de versão já aceita.
- `contract_evidence_access_log`: append‑only, admin SELECT próprio.
- Grants explícitos para `authenticated` e `service_role` em todas as novas tabelas.

## 7. Entregáveis (resumo)

**Tabelas novas:** `contract_versions`, `contract_acceptances`, `contract_evidence_access_log`.
**Tabelas alteradas:** nenhuma (apenas seed em `contract_versions`).
**Funções RPC:** `register_contract_acceptance`, `generate_partner_evidence_report`, `calculate_early_termination`, `log_evidence_access`, `publish_contract_version` + trigger de hash + trigger de imutabilidade.
**Telas alteradas:**
- `PartnerContractTermsDialog` (frase oficial + link + chamada RPC + captura IP/UA).
- `BettorContractTermsDialog` (mesma coisa, no signup).
- `AuthContext.signUp` (chama RPC após signup).
- `AdminPartnerManagement` → nova seção “Evidências do Aceite Eletrônico” com 4 botões.
**Onde admin vê:** dentro do detalhe do parceiro em Gestão de Parceiros.
**Exportação:** botão “Exportar relatório em PDF” na seção.
**Dados existentes para contratos antigos:** somente indiretos (cadastro, pagamento, dados autodeclarados). Sem IP/UA/checkbox digital.
**Dados que passam a ser coletados:** todos listados em `contract_acceptances` para toda nova adesão/upgrade.
**Caso Sabriny:** não há evidência digital de checkbox/IP/UA. Evidências disponíveis: cadastro (`profiles`), adesão (`partner_contracts.created_at`), pagamento PIX confirmado (`payment_id`, `payment_status='completed'`), dados cadastrais (CPF, e‑mail). O PDF gerado para ela exibirá essas evidências com o aviso de “anterior à implementação do registro digital”.

## Fora de escopo (não alterar)
Regras de repasses, planos, bônus, leilões, pagamentos, rede binária, lógica comercial. Apenas auditoria, registro de aceite, versionamento, relatório e cálculo de cancelamento.

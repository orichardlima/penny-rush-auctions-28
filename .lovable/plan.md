
# Fase 1 — Plano Final v4 (EXECUÇÃO)

**Escopo protegido INTOCÁVEL:** bots, lógica de lances, finalização de leilões, pagamentos, gateways, cron estável, Fury Vault, cálculo de payouts, bônus binário, regras comerciais, tabelas `auctions`/`bids`/`orders`/`partner_payouts`/`fury_vault_*`/`binary_*`.

---

## 1.1 Redirect `/investir`
Client-side `<Navigate to="/parceiro" replace />` + Helmet `noindex`. Documentar no relatório que não é 301 HTTP real (configurar via Cloudflare Rule sobre `showdelances.com`).

## 1.2 Estatísticas públicas do Hero
Remover números não comprovados. `usePublicStats()` expõe apenas:
- "Leilões disponíveis" (status IN active/waiting)
- "Leilões finalizados" (status='finished')

Sem contagem de usuários, sem R$ em prêmios, sem satisfação. Falha em query → esconde card.

## 1.3 Varredura de linguagem
Grep proibido final: `investir | investimento | investidor | rendimento | rendimentos | ROI | retorno garantido | renda garantida | lucro garantido | rentabilidade | aplicação financeira | ganho garantido`.

Substituições: aporte, parceiro, parceria de expansão, repasse, resultado da parceria. Sem promessa financeira equivalente.

## 1.4 Versionamento e re-aceite de contratos

- Migration `system_settings`: `current_bettor_contract_version='v1'`, `current_partner_contract_version='v1'`.
- Tabela `contract_versions`: `content_html`, `content_text` (canônico), `content_hash` computado server-side por trigger sobre `content_text`. `content_text` derivado deterministicamente do mesmo conteúdo do `content_html`.
- Reforçar `contract_acceptances` com colunas de evidência + trigger `contract_acceptances_immutable` (bloqueia UPDATE/DELETE exceto service_role).
- RLS `contract_acceptances`: SELECT próprio; INSERT/UPDATE/DELETE negados a `authenticated`; ALL para service_role.
- Registro via RPC `register_contract_acceptance` SECURITY DEFINER. Teste em runtime se `current_setting('request.headers')::json` traz `x-forwarded-for`/`user-agent` de forma confiável — se sim, mantém RPC; se não, migro para Edge `register-contract-acceptance`. Decisão documentada no relatório. Cliente envia só `{contract_type, origin, declaration_text, partner_contract_id?}`; IP/UA/hash/timestamp sempre server-side; hash recalculado sobre `contract_versions.content_text` e validado contra `content_hash`.
- Frontend `ContractReacceptGuard` em `App.tsx`, modal bloqueante quando `check_contract_version_status` retorna `needs_reaccept=true`.

## 1.5 Assinatura eletrônica de encerramento — FLUXO 2 ETAPAS + RPC TRANSACIONAL

### Migrations
- `settlement_quotes(id uuid, user_id, partner_contract_id, termination_id, liquidation_type, gross_amount, discounts, penalty, net_amount, terms_text, terms_hash, terms_version, created_at, expires_at, consumed_at)`.
  - Grants: SELECT `authenticated`; ALL `service_role`.
  - RLS: SELECT próprio; sem INSERT/UPDATE/DELETE via API.
- `settlement_acceptances(id, user_id, partner_contract_id, termination_id, liquidation_type, gross_amount, discounts, penalty, net_amount, terms_version, terms_hash, terms_text, declaration_text, ip_address, user_agent, browser, os, device, route, accepted_at, receipt_html, quote_id, processing_status)`.
  - Nova coluna `processing_status` (enum: `SIGNED`, `TERMINATION_PROCESSED`, `TERMINATION_FAILED`) — default `SIGNED`.
  - Grants: SELECT `authenticated`; ALL `service_role`; sem INSERT/UPDATE/DELETE diretos.
  - RLS: SELECT próprio; UPDATE somente service_role (para transição de `processing_status`); INSERT via RPC/Edge.
  - Trigger `settlement_acceptances_core_immutable`: bloqueia UPDATE em qualquer coluna EXCETO `processing_status`; bloqueia DELETE sempre (exceto service_role).
  - Índices: `(user_id)`, `(partner_contract_id)`, `(accepted_at DESC)`, `(quote_id)`.

### Etapa 1 — Edge `prepare-partner-settlement`
Input: `{ partner_contract_id, termination_id, liquidation_type }`.
1. Valida JWT (`getClaims`) + ownership.
2. Recalcula server-side (lógica existente, sem alteração): gross/discounts/penalty/net.
3. Monta `terms_text` server-side contendo modalidade, valor bruto, repasses/saques/bônus abatidos detalhados, multa, líquido, ciência, caráter de recibo eletrônico, e **texto genérico sobre evidências**:
   > "No ato da assinatura eletrônica serão registrados data/hora, IP, user agent, dispositivo, navegador e demais evidências técnicas da sessão."
4. Renderiza `receipt_preview_html`.
5. `terms_hash = SHA-256(terms_text)`.
6. Persiste `settlement_quotes` (expires_at = now()+10min).
7. Retorna `{ settlement_quote_id, gross_amount, discounts, penalty, net_amount, terms_text, terms_hash, receipt_preview_html, expires_at }`.

### Etapa 2 — Frontend `SettlementSignatureCard`
Exibe o `terms_text` retornado pelo servidor (não local), valores finais, `terms_hash`. Checkbox obrigatório com declaração completa. Botão "Assinar eletronicamente" só após checkbox. Se quote expirar, recarrega.

### Etapa 3 — Edge `sign-partner-settlement` + RPC transacional
Input: `{ settlement_quote_id }`.

Edge:
1. Valida JWT + ownership do quote.
2. Captura server-side: `ip = x-forwarded-for`, `user_agent`, parse browser/OS/device.
3. Chama RPC transacional **`finalize_partner_settlement_acceptance(p_quote_id, p_ip, p_user_agent, p_browser, p_os, p_device, p_route)`** SECURITY DEFINER.

RPC `finalize_partner_settlement_acceptance` — TRANSAÇÃO ÚNICA:
1. `SELECT ... FOR UPDATE` no quote validando `user_id = auth.uid() AND consumed_at IS NULL AND expires_at > now()`. Se não encontrar, `RAISE EXCEPTION`.
2. `UPDATE settlement_quotes SET consumed_at = now() WHERE id = p_quote_id AND consumed_at IS NULL AND expires_at > now() RETURNING *` (double-check anti double-spend).
3. Recalcula `SHA-256(terms_text)` e compara com `terms_hash` — divergência aborta.
4. INSERT em `settlement_acceptances` com `processing_status='SIGNED'` e todos os dados + evidências capturadas.
5. Retorna `acceptance_id`.

Edge (pós-RPC):
6. Renderiza `receipt_html` final incluindo IP/UA/browser/OS/device/hora reais.
7. Retorna `{ acceptance_id, receipt_html, terms_hash }`.

### Integração com encerramento real
- `PartnerEarlyTerminationDialog` só prossegue com o fluxo real de encerramento após `sign-partner-settlement` retornar sucesso.
- Ao processar encerramento real (lógica existente, sem alteração de regras financeiras), sistema atualiza `settlement_acceptances.processing_status`:
  - Sucesso → `TERMINATION_PROCESSED`.
  - Falha em qualquer etapa → `TERMINATION_FAILED` + toast/estado UI: **"Assinatura registrada, encerramento pendente de processamento."**
- UI só exibe "encerramento concluído" quando `processing_status = TERMINATION_PROCESSED`. Enquanto estiver `SIGNED` ou `FAILED`, mostra estado intermediário claro com opção de reprocessar (via admin).

---

## Guardrails
**Paths protegidos — `git diff --stat` VAZIO ao final:**
```
supabase/functions/auto-replenish-auctions/, sync-timers-and-protection/,
veopag-*/, magen-*/, partner-weekly-payouts/, order-pix-payment/,
auction-protection/, admin-bot-monitor/, timer-decrement/,
partner-payment*/, process-partner-withdrawal/
src/hooks/useAuctionTimer.ts, useFinishAuction.ts, useRealTimeProtection.ts,
useFuryVault.ts, useBinaryNetwork.ts, usePartnerCashflow.ts, useDailyPayoutPreview.ts
```
Zero migrations em: `auctions, bids, orders, partner_payouts, partner_withdrawals, fury_vault_*, binary_*, bid_lots, bid_purchases`.

---

## Relatório final Fase 1
1. Arquivos criados/alterados.
2. Migrations (tabelas/colunas/triggers/policies/grants).
3. RPCs: `check_contract_version_status`, `register_contract_acceptance` (estendida ou Edge equivalente), `finalize_partner_settlement_acceptance`.
4. Edge Functions: `prepare-partner-settlement`, `sign-partner-settlement`, opcional `register-contract-acceptance`.
5. Policies RLS por tabela.
6. Decisão RPC vs Edge para captura de IP/UA no aceite de contrato (com evidência de teste).
7. Testes manuais:
   - Bump versão → re-aceite obrigatório.
   - Comparação hash server-side vs recomputo.
   - Fluxo settlement: prepare → assinar → verificar recibo com IP/UA reais.
   - **Double-click / duas abas** no botão assinar → apenas 1 aceite gravado, 2ª tentativa aborta.
   - Quote expirado → aborta com mensagem clara.
   - Encerramento com falha pós-assinatura → status "SIGNED" + UI "encerramento pendente de processamento".
   - UPDATE/DELETE em `contract_acceptances` / `settlement_acceptances` → falha.
8. Grep palavras proibidas — output vazio no código público.
9. `git diff --stat` restrito aos paths protegidos — vazio.
10. Observação sobre `/investir` (não é 301 real).

Sem sua aprovação escrita da Fase 1 concluída, **não avanço para Fase 2**.

Executando agora.

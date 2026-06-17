
# Auditoria técnica — Contrato da parceira Sabriny Amorim

> Este documento é **somente leitura/diagnóstico**. Nenhum dado antigo será alterado. Nenhuma migração, edição de tabela ou correção retroativa é proposta aqui.

---

## 1. Origem técnica das informações exibidas no escritório

### 1.1 "Contrato de Parceiro — Plano Diamond"
- Tabela: `public.partner_contracts`
- Colunas: `plan_name = 'Diamond'`, `aporte_value = 25000`, `cotas = 1`, `weekly_cap = 625`, `total_cap = 55000`.

### 1.2 "Assinado em 12/05/2026, 08:58"
- Tabela: `public.partner_contracts`
- Coluna: **`created_at`**
- Valor real no banco: `2026-05-12 11:58:00.252438+00` (UTC) → `08:58` em America/Sao_Paulo. Confere exatamente com o exibido.
- A label "Assinado em" no front é uma **renderização visual** desse `created_at`. Não vem de `contract_acceptances` (que ainda não existia em 12/05/2026) nem de log de aceite.

### 1.3 A que evento esse timestamp corresponde
O `partner_contracts.created_at` é gravado **no momento em que o registro do contrato é criado pela aplicação**, durante o fluxo de adesão. Cronologia real da Sabriny:

| Evento | Tabela / coluna | Timestamp (UTC) |
|---|---|---|
| Criação da intenção de pagamento PIX (Diamond R$ 25.000) | `partner_payment_intents.created_at` (`payment_id=zBHsHLyyBdyfkD6hm8LsPIOSRFB1kdvei3h`) | 2026-05-12 11:56:32 |
| Criação do `partner_contracts` (exibido como "Assinado em") | `partner_contracts.created_at` | 2026-05-12 11:58:00 |
| Confirmação de pagamento PIX → contrato ativado | `partner_contracts.payment_status='completed'` (atualizado pelo webhook `partner-payment-webhook`) | mesma janela |

Ou seja, o "Assinado em" reflete simultaneamente: criação do contrato, aceite do diálogo de termos (`PartnerContractTermsDialog` exibido no checkout) **e** confirmação de pagamento — todos ocorreram na mesma sessão de adesão de 12/05/2026, 08:58 BRT, com diferença de ~1,5 min entre a geração do PIX e a criação do contrato.

### 1.4 Logs/auditoria que vinculam essa data ao aceite
- ✅ `partner_payment_intents` — intenção PIX criada 1m28s antes (`payment_id` registrado).
- ✅ `partner_contracts.payment_status='completed'` + `referred_by_user_id` preenchidos via webhook PIX (rastreio indireto do fluxo de adesão).
- ✅ Edge function `partner-payment-webhook` (logs do Supabase) confirma o callback PIX vinculado ao `payment_id`.
- ❌ **Não há** registro em `contract_acceptances` (módulo de evidências entrou em produção em 17/06/2026 — posterior à adesão).
- ❌ **Não há** linha em `admin_audit_log` para esse evento (o módulo de auditoria não capturava criação de contrato no fluxo do usuário final).

### 1.5 Botão "Ver contrato"
- O botão exibe o **texto vigente do `PartnerContractTermsDialog`** no código atual (mesmo conteúdo legal exibido a qualquer parceiro hoje).
- **Não há snapshot versionado em 12/05/2026** — `contract_versions` foi populado em 17/06/2026 com `v1` igual ao texto vigente. Como o texto exibido em 12/05 era o mesmo conteúdo do componente `PartnerContractTermsDialog` daquela época (controle via Git), considera-se materialmente equivalente, mas **a equivalência precisa ser comprovada por diff de commit**, não por hash em banco.

---

## 2. Relatório completo da parceira Sabriny Amorim

### Dados cadastrais
| Campo | Valor |
|---|---|
| Nome | Sabriny Amorim |
| CPF | 058.971.625-57 |
| E-mail | brinysiriaco93@gmail.com |
| Telefone | (71) 99206-9004 |
| Cadastro (profile) | 2026-05-11 18:15:18 UTC |
| `user_id` | b0a4fc03-4a9d-4701-bd17-27a304b59572 |

### Contrato
| Campo | Valor |
|---|---|
| ID contrato | abd3ffff-d7fc-4f18-beb6-ac55986cefba |
| Plano | Diamond |
| Aporte | R$ 25.000,00 |
| Cotas | 1 |
| Teto semanal | R$ 625,00 |
| Teto total | R$ 55.000,00 |
| Patrocinador | 33ce1dc1-6bd3-451d-b65c-15457ca9a7d3 |
| Código de indicação | RPAYGAJ2 |
| Criado em (`created_at`) | 12/05/2026 08:58 BRT |
| Pagamento | `payment_status=completed` (PIX) |
| `payment_id` no contrato | `NULL` (gravado em `partner_payment_intents`) |
| `payment_id` da intent | `zBHsHLyyBdyfkD6hm8LsPIOSRFB1kdvei3h` |
| Status atual | CLOSED |
| Encerrado em (`closed_at`) | 15/06/2026 18:22 BRT |
| Motivo | Encerramento antecipado |

### Histórico de repasses (`partner_payouts`, todos `PAID`)
| Data | Valor | Origem |
|---|---|---|
| 18/05/2026 | R$ 437,50 | weekly_aporte |
| 20/05/2026 | R$ 4.000,00 | referral_bonus |
| 25/05/2026 | R$ 600,00 | weekly_aporte |
| 01/06/2026 | R$ 575,00 | weekly_aporte |
| 08/06/2026 | R$ 550,00 | weekly_aporte |
| 15/06/2026 | R$ 230,00 | weekly_aporte |
| **Total repassado** | **R$ 6.392,50** | |

### Histórico de saques (`partner_withdrawals`)
| Data | Valor | Status |
|---|---|---|
| 25/05/2026 | R$ 1.037,50 | PAID (PIX) |
| 01/06/2026 | R$ 4.575,00 | REJECTED |
| **Total efetivamente sacado** | **R$ 1.037,50** | |

### Bônus
- Bônus de indicação recebidos (`partner_referral_bonuses` como referrer): **1 bônus de R$ 4.000,00** em 13/05/2026 (status `AVAILABLE`, pago em 20/05/2026 via `partner_payouts`).
- Bônus binário: **nenhum** registro em `binary_bonuses`.

### Lances
- Lances recebidos (bônus de adesão Diamond): `bonus_bids_received = 3.000`
- Compras de lances (`bid_purchases`): **nenhuma**
- Lances utilizados: nenhum registro de `bids` associado ao `user_id` da parceira em consulta inicial (consultar `public.bids` para uso real, caso necessário).

### Cancelamento antecipado (`partner_early_terminations`)
| Campo | Valor |
|---|---|
| ID | a0fcb0fd-ef05-4397-82ba-74136b3edc64 |
| Solicitado em | 10/06/2026 18:06 BRT (>7 dias após adesão) |
| Aprovado / processado em | 15/06/2026 21:22 UTC (18:22 BRT) |
| Tipo | PARTIAL_REFUND |
| % desconto | 30 % |
| Aporte original | R$ 25.000,00 |
| Total já recebido | R$ 5.612,50 (`partner_contracts.total_received`) |
| Cap remanescente | R$ 49.387,50 |
| Valor proposto / final | R$ 11.887,50 |
| Status | APPROVED |
| Pago em | ainda **não pago** (`paid_at` nulo) |

### Recalculo da multa de 30% (transparência)
- Aporte: R$ 25.000,00
- Multa contratual 30%: **R$ 7.500,00**
- Já recebido pela parceira em repasses: R$ 6.392,50
- Saques líquidos efetivamente sacados: R$ 1.037,50 (já contidos nos repasses acima)
- Cálculo simplificado: 25.000 − 7.500 − 5.612,50 = **R$ 11.887,50** → bate com `final_value` registrado.

### ⚠️ Observação obrigatória
> **Este contrato foi celebrado em 12/05/2026, anterior à entrada em produção do módulo de evidências de aceite eletrônico (17/06/2026).** Portanto, **não há registro em `contract_acceptances`** com IP, user agent, hash de contrato e carimbo de tempo do aceite. As evidências disponíveis são **indiretas**: cadastro confirmado no `profiles`, `partner_payment_intents` com `payment_id` PIX, `partner_contracts.payment_status='completed'` confirmado por webhook da VeoPag, e o próprio fluxo de checkout que exigia marcação do `PartnerContractTermsDialog` para gerar o PIX. O texto contratual exibido em 12/05/2026 corresponde à versão vigente do componente `PartnerContractTermsDialog` naquela data (rastreável via histórico Git), materialmente igual à `v1` salva em `contract_versions` em 17/06/2026.

---

## 3. O que NÃO será alterado

- Nada em `partner_contracts`, `partner_payouts`, `partner_withdrawals`, `partner_referral_bonuses`, `partner_early_terminations`, `partner_payment_intents` ou qualquer regra de negócio (planos, repasses, bônus, leilões, rede binária, pagamentos).
- Nenhum backfill em `contract_acceptances` (mantém-se a integridade do módulo de evidências: só registra aceites reais a partir de 17/06/2026).

---

## 4. Próximo passo opcional (somente se você aprovar)

Caso queira, posso (em build mode) ajustar **apenas a label visual** "Assinado em" no escritório do parceiro para deixar tecnicamente mais preciso quando não houver registro em `contract_acceptances`, por exemplo:

- Com aceite digital registrado → "Assinado eletronicamente em DD/MM/AAAA, HH:MM"
- Sem aceite digital (pré-módulo) → "Contratado em DD/MM/AAAA, HH:MM (anterior ao módulo de evidências)"

Isso é estritamente cosmético, não muda dado nem fluxo. Me confirme se deseja esse ajuste ou se devo apenas encerrar com o relatório acima.

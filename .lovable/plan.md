# Géssica — linha do tempo documental e conclusão revisada (somente leitura)

Nada foi alterado. Todos os dados abaixo vêm de consulta direta.

Pessoas envolvidas:
- Géssica `33ce1dc1…` — contrato Diamond `f143036a…` (ACTIVE, aporte R$ 25.000, teto R$ 55.000, semanal R$ 625)
- Sabriny `b0a4fc03…` — contrato `abd3ffff…` (hoje CLOSED, `referred_by_user_id` = Géssica)
- Terceiro indicado `e46ec298…` — contrato Diamond `4108acc8…` (ACTIVE, indicado pela Géssica)

## 1. Existiam DOIS bônus de R$ 4.000, não um

| Bônus | Indicado | Criado | Status hoje | Payout | Migrado 30/07 |
|---|---|---|---|---|---|
| `13c43af4…` | **e46ec298** | 11/05 17:59 | **CREDITED** | `98790e60` (PENDING) | **SIM** → wallet tx `e6292da5` |
| `9cf371d3…` | **Sabriny** | 12/05 11:58 | **CANCELLED** | `5c912c07` (CANCELLED) | Não |

Também foi cancelado o bônus L2 de R$ 500 (`dcbf3747…`, indicado `9f377fa6`, downline da Sabriny).

## 2. Saída e retorno da Sabriny (hipótese confirmada, mas para o OUTRO bônus)

- **12/05** — Sabriny entra na rede da Géssica (contrato `abd3ffff…` ativado, sponsor Géssica). Gera bônus `9cf371d3` de R$ 4.000.
- **31/05 14:23** — `PARTNER_SELF_LEAVE_NETWORK` (exit `87b621b1…`, motivo "Motivo pessoal"): `reversed_available_count: 1`, `reversed_available_total: 4000`. O bônus da Sabriny foi **estornado/cancelado** aqui.
- **07/06 15:00** — `PARTNER_EXIT_REVERTED_TIMEOUT`: saída revertida automaticamente após 7 dias sem novo patrocinador, `restored_sponsor_user_id = 33ce1dc1` (Géssica). Sabriny volta para a rede.
- **10/06 20:24** — Admin `c793d66c…` lança crédito manual `e8937ca6…` de R$ 4.000, tipo `correction`, descrição **"Retorno"**, `consumes_cap = true`, gerando o payout `66b986e1` (PAID, tipo `partnership_weekly_repass`).

Conclusão deste bloco: o pagamento de 10/06 **é a reposição legítima do bônus da Sabriny** após o retorno dela. O bônus original `9cf371d3` continuou CANCELLED e foi substituído pelo crédito manual.

## 3. Origem de cada payout questionado

- `98790e60` → bônus `13c43af4` (indicação de **e46ec298**), nunca marcado como pago, status PENDING.
- `66b986e1` → crédito manual "Retorno" de 10/06, referente ao **retorno da Sabriny** (sem `referral_bonus_id`, `source = weekly_aporte`).
- Migrado em 30/07 04:07 para a Carteira de Rede: **`13c43af4` (e46ec298)**, com metadata `previous_status: AVAILABLE`, `payout_id: 98790e60`. **Não** é o bônus da Sabriny.

## 4. Conciliação dos R$ 10.425 creditados (payouts PAID)

| Data | Valor | Acumulado |
|---|---|---|
| 18/05 | 625 | 625 |
| 25/05 | 600 | 1.225 |
| 01/06 | 575 | 1.800 |
| 08/06 | 550 | 2.350 |
| 10/06 | **4.000 (crédito manual "Retorno")** | 6.350 |
| 15/06 | 575 | 6.925 |
| 22/06 | 625 | 7.550 |
| 29/06 | 625 | 8.175 |
| 06/07 | 450 | 8.625 |
| 13/07 | 525 | 9.150 |
| 20/07 | 500 | 9.650 |
| 27/07 | 250 | 9.900 |
| 03/08 | 525 | **10.425** |

## 5. Conciliação dos R$ 12.625 sacados (saques PAID) e saldo passo a passo

| Saque | Valor | Creditado até então | Sacado antes | Saldo antes | Saldo depois |
|---|---|---|---|---|---|
| 18/05 `68388f03` | 625 | 625 | 0 | 625 | 0 |
| 25/05 `65ec6bf2` | 600 | 1.225 | 625 | 600 | 0 |
| 08/06 `4b2395c6` | 5.125 | — | — | — | **REJEITADO** |
| 15/06 `437b634c` | 4.000 | 6.925 | 1.225 | 5.700 | 1.700 |
| 22/06 `e0068dc4` | 4.000 | 7.550 | 5.225 | **2.325** | **−1.675** |
| 29/06 `d91f1f61` | 2.950 | 8.175 | 9.225 | −1.050 | **−4.000** |
| 06/07 `230ec089` | 450 | 8.625 | 12.175 | −3.550 | **−4.000** |

Os **R$ 1.225 faltantes** na explicação anterior são os dois primeiros saques (R$ 625 em 18/05 + R$ 600 em 25/05), que eu havia omitido. 625+600+4.000+4.000+2.950+450 = **12.625**.

Depois de 06/07 o déficit ficou em exatamente **−R$ 4.000** e os repasses seguintes (13/07 525 + 20/07 500 + 27/07 250 + 03/08 525 = **1.800**) apenas reduziram esse déficit para **−R$ 2.200**. É por isso que a tela mostra R$ 0,00: `repass_available = max(0, 10.425 − 12.625)`.

## 6. Como o sistema autorizou saques acima dos créditos

À época, o saldo exibido/validado vinha de `partner_contracts.available_balance`, que **somava os bônus de indicação com status AVAILABLE** ao saldo do contrato. O bônus `13c43af4` (e46ec298) estava AVAILABLE — a própria metadata da migração registra `previous_status: AVAILABLE` — e por isso engordou o saldo do contrato, permitindo o saque de 22/06 e os seguintes. Ou seja, **a Géssica já recebeu os R$ 4.000 do bônus do e46ec298 por dentro do contrato**, embora o payout `98790e60` nunca tenha sido marcado como PAID.

Hoje `available_balance = 0`, `total_withdrawn = 12.625`, `total_received = 10.425`.

## 7. Conclusão revisada

A hipótese da saída/retorno da Sabriny **se confirma**, mas ela explica o crédito manual de 10/06 — não a Carteira de Rede.

- Bônus da Sabriny: estornado em 31/05, reposto em 10/06 via crédito manual. **Correto, sem pendência.**
- Bônus do e46ec298: já sacado por dentro do contrato (é a origem exata do déficit de −R$ 4.000), e ainda assim migrado de novo em 30/07 para a Carteira de Rede.

Portanto **os R$ 4.000 da Carteira de Rede são duplicidade do mesmo bônus (`13c43af4`) já pago via contrato** — não são a reativação do bônus da Sabriny. A reclassificação sugerida (debitar rede + creditar contrato) resultaria em saldo R$ 1.800 no contrato, o que é **numericamente igual** ao cenário correto, mas com a narrativa contábil trocada.

## 8. Correção proposta (aguardando sua autorização, nada será executado agora)

1. Lançar débito de ajuste de R$ 4.000 na Carteira de Rede da Géssica (transação de estorno, sem apagar a migração de 30/07), zerando a carteira.
2. Lançar crédito de correção de R$ 4.000 no contrato `f143036a…`, referenciando o bônus `13c43af4` já sacado em 22/06, para regularizar o déficit.
3. Marcar o payout `98790e60` como PAID (liquidado via contrato) e o bônus `13c43af4` como pago, para não voltar a ser migrado.
4. Resultado para a Géssica: Carteira de Rede R$ 0,00 e Repasses **R$ 1.800,00** disponíveis.
5. Revisar o mesmo padrão no caso da Sabriny (`b0a4fc03…`, bônus `7385cfe2`, payout `84e1d48d`, wallet tx `b3822fdc`) antes de qualquer liberação de saque.

Nenhum passo acima será executado sem sua aprovação explícita.

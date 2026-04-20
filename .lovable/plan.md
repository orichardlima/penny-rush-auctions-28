

## Como o João conseguiu R$ 980,28 de saldo disponível

### Sua dúvida (legítima)

> "Ele ganha até 2,5% por semana sobre o aporte de R$ 19.998 — então no máximo ~R$ 500/semana. Como tem R$ 980 disponíveis?"

A resposta: **R$ 980,28 não é o ganho de uma semana**. É o **saldo acumulado de 4 semanas de payouts**, menos o que ele já sacou. Está tudo dentro da regra.

### Composição exata do saldo do João

**Contrato:** Legend, 2 cotas, aporte R$ 19.998, weekly_cap **R$ 500/semana** (2,5% × 2 cotas), total_cap R$ 40.000.

#### 1) Total recebido em payouts semanais (4 semanas pagas)

| Semana | Período | Calculado | Pago | Cap aplicado? |
|---|---|---|---|---|
| 1 | 23–29/03 | R$ 251,97 | **R$ 176,38** | (parcial — aporte só dia 25/03) |
| 2 | 30/03–05/04 | R$ 499,95 | **R$ 499,95** | não (abaixo do cap) |
| 3 | 06–12/04 | R$ 479,95 | **R$ 479,95** | não (abaixo do cap) |
| 4 | 13–19/04 | R$ 500,00 | **R$ 500,00** | **sim** (bateu o teto de R$ 500) |
| | | **Total recebido** | **R$ 1.656,28** | |

Todos os 4 payouts estão com status `PAID`. Os percentuais semanais estão **dentro da regra** (≤ 2,5% × cotas = R$ 500/semana). Em nenhuma semana ele ultrapassou o teto.

#### 2) Saques já realizados/comprometidos

| Data | Valor | Status |
|---|---|---|
| 31/03 | R$ 176,00 | PAID |
| 06/04 (pago em 19/04) | R$ 500,00 | PAID |
| | **Total sacado** | **R$ 676,00** |

#### 3) Saldo disponível = Recebido − Sacado

```
R$ 1.656,28  (4 payouts pagos)
−  R$ 676,00  (2 saques já PAID)
─────────────
=  R$ 980,28  ← exatamente o valor solicitado no saque APPROVED
```

Bate centavo a centavo com a solicitação `252401ac-4719-4f49-9f2b-a99c70ba7364` (R$ 980,28 bruto, taxa R$ 49,01, líquido R$ 931,27).

### Conclusão

- **Não houve violação de regra.** O João recebeu, em 4 semanas, no máximo R$ 500/semana (teto correto para Legend × 2 cotas).
- O acúmulo de R$ 980 é simplesmente o saldo do que ele **deixou de sacar antes**: ele sacou só R$ 176 da 1ª semana e R$ 500 da 2ª, deixando o restante (R$ 0,38 + R$ 0,05 + R$ 479,95 + R$ 500,00) acumular no contrato.
- Ele **não tem** bônus binários, fast start ou referral creditados (verificado nas tabelas `binary_bonuses`, `fast_start_achievements`, `partner_referral_bonuses`). O ganho é 100% payouts semanais.

### O que isso revela sobre a UX do painel (oportunidade — não obrigatório)

Hoje, ao olhar um saque de R$ 980, o admin não tem como saber rapidamente *de onde* veio o saldo sem cruzar 3 tabelas manualmente, como fiz aqui. Posso (se você aprovar **em uma próxima conversa**) adicionar no modal de detalhes do saque uma seção **"Composição do saldo"** mostrando:

- Soma de payouts PAID até a data do saque
- Soma de saques PAID/APPROVED anteriores
- Saldo resultante (= valor solicitado)

Isso elimina dúvidas como esta no futuro, em 1 clique.

### Resumo

| Pergunta | Resposta |
|---|---|
| Ele ultrapassou o teto semanal? | **Não.** Máximo por semana foi R$ 500 (=2,5% × 2 cotas × R$ 9.999). |
| De onde vieram os R$ 980? | Acúmulo de **4 payouts semanais pagos** (R$ 1.656,28) menos **2 saques anteriores** (R$ 676,00). |
| O saque é legítimo? | **Sim.** Saldo bate exatamente. |
| Precisa alterar código/banco? | **Não.** Apenas esclarecimento. |


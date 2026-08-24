# Bônus de rede do Gustavo Felipe Freire Lima — situação e correção

## Resposta direta

O bônus de indicação fica disponível **7 dias após a geração** (carência). No caso do Gustavo (lorenaaquino1999@hotmail.com):

| Valor | Nível | Gerado em | Disponível em | Status hoje |
|---|---|---|---|---|
| R$ 4.000,00 | 1 | 14/08 | **21/08 (já venceu)** | PENDENTE (travado) |
| R$ 500,00 | 2 | 18/08 | 25/08 | Pendente |
| R$ 500,00 | 2 | 18/08 | 25/08 | Pendente |
| R$ 4.000,00 | 1 | 18/08 | 25/08 | Pendente |
| R$ 500,00 | 2 | 19/08 | 26/08 | Pendente |

Além disso ele já tem **R$ 1.000,00 disponíveis** na Carteira de Bônus de Rede (bônus de expansão creditado em 24/08) — esse valor já pode ser sacado.

## Problema encontrado (verificado)

A rotina automática que transforma bônus PENDENTE em disponível (`release-referral-bonuses`, agendada de hora em hora) está **falhando com "job startup timeout"**. O último sucesso foi em 16/06/2026; desde então são 1.670 execuções falhadas.

Consequência atual: **9 bônus já vencidos, somando R$ 15.464,68**, continuam presos como PENDENTE — entre eles os R$ 4.000,00 do Gustavo que deveriam ter sido liberados em 21/08.

## O que fazer

1. **Liberar imediatamente os bônus vencidos**: executar a rotina de liberação uma vez, creditando na carteira de rede todos os bônus com prazo já vencido (inclusive os R$ 4.000,00 do Gustavo). A rotina já é idempotente — não gera crédito duplicado.
2. **Corrigir o agendamento**: recriar o job de liberação de forma que não dependa da inicialização que está estourando o tempo (execução direta da função no cron, com janela distribuída), e adicionar o mesmo tratamento ao job `expire-suspended-bonuses`, que roda no mesmo horário.
3. **Rede de segurança**: liberar também sob demanda quando o parceiro abre a tela de saque/bônus, para que um novo problema no cron não trave o dinheiro do parceiro.
4. **Conferência final**: listar os bônus liberados e os saldos das carteiras afetadas para validação.

## Detalhes técnicos

- Funções envolvidas: `release_pending_referral_bonuses()` → `credit_referral_bonus_to_network_wallet()` (idempotente por `source_ref = referral_bonus:<id>`).
- Ajuste no `cron.schedule` dos jobs 50 e 52 (horários deslocados para evitar concorrência com os jobs de bots que ocupam o pool de workers a cada minuto).
- Nenhuma alteração em valores, percentuais, carência de 7 dias, tetos ou regras de saque.

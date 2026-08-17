# Semana Taxa Zero — Última Segunda do Mês

Faz sentido: como as solicitações de saque já acontecem às segundas, a "última segunda do mês" é uma data única, previsível e fácil de comunicar ("Segunda Taxa Zero").

## Como vai funcionar

- Na última segunda-feira de cada mês (horário de Brasília), toda solicitação de saque é registrada com taxa 0%.
- Nos demais dias, vale a taxa normal configurada em `withdrawal_fee_percentage`.
- Vale para saques de Parceiros e de Afiliados (as duas telas usam o mesmo cálculo de taxa).
- Só se aplica a solicitações feitas nesse dia — não altera saques já solicitados.

## Controle no admin

Nas Configurações do Sistema (bloco de saques):
- Interruptor "Segunda Taxa Zero (última segunda do mês)" — liga/desliga a promoção.
- Ao ligar, aparece a data da próxima segunda taxa zero para conferência.

## O que o usuário vê

- No dia: faixa verde "Hoje é Segunda Taxa Zero — sem taxa de saque" e o detalhamento mostra Taxa R$ 0,00.
- Fora do dia: aviso discreto "Próxima Segunda Taxa Zero: DD/MM" junto da taxa atual, para incentivar a espera.

## Detalhes técnicos

- Nova chave em `system_settings`: `withdrawal_zero_fee_last_monday` (boolean, padrão `false`) — inserida por migration; nenhuma tabela nova.
- `src/hooks/useWithdrawalSettings.ts`:
  - Ler a nova chave junto às demais.
  - Helpers `getNextZeroFeeDate()` e `isZeroFeeDay()` calculados em America/Sao_Paulo (última segunda = última ocorrência de dia 1 da semana no mês corrente).
  - `calculateFee` retorna `feePercentage: 0, feeAmount: 0, netAmount: amount` quando a flag está ativa e é o dia.
  - Expor `isZeroFeeDay` e `nextZeroFeeDate` no retorno do hook.
- Como `PartnerWithdrawalSection.tsx` e `AffiliateWithdrawalSection.tsx` já persistem `fee_percentage/fee_amount/net_amount` a partir de `calculateFee`, os registros gravados no banco já saem com taxa zero — sem mudança nos hooks de inserção.
- Ajuste apenas de exibição nessas duas telas: banner/aviso e uso de `feeInfo.feePercentage` (em vez de `wSettings.feePercentage`) nos rótulos de taxa.
- `src/components/SystemSettings.tsx`: novo switch salvando a chave.
- Nada muda na janela de dias/horários permitidos, valores mínimos, aprovação ou pagamento.

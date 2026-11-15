# Bônus de Equipe — Abraão Resende Silveira

## O que a investigação mostrou
- O cálculo e o pagamento estão corretos. Ele recebeu **R$ 560,00** da semana de 02/11, e esse valor já está na carteira de rede dele.
- Nas semanas de 19/10 e 26/10 o bônus foi R$ 0, e isso está certo: ele ainda não tinha pelo menos 2 equipes com pontos.
- A semana de 09/11 fecha na madrugada de 16/11. A previsão é de cerca de R$ 90.

## Por que o painel mostra R$ 0,00
O quadro "Bônus de Equipe" e a aba "Equipe (0)" na tela de detalhes do parceiro ainda leem o registro do antigo bônus binário. Esse bônus foi substituído pelo Programa de Expansão. O pagamento novo existe, mas essa tela não o mostra.

## Correção proposta (só na tela de detalhes do parceiro no admin)
1. Mudar o quadro "Bônus de Equipe" para somar os créditos do Bônus de Equipe do Programa de Expansão. No caso do Abraão, ele vai mostrar R$ 560,00 e 1 registro.
2. Mudar a aba "Equipe" para listar esses créditos, com semana, valor, status e data.
3. Nenhum valor, saldo ou cálculo muda. O resto da tela continua igual.

## Detalhes técnicos
- `src/components/Admin/PartnerDetailModal.tsx`: trocar a consulta a `binary_bonuses` por `partner_network_wallet_transactions` com `wallet_user_id = contract.user_id` e `bonus_type = 'expansion_bonus'`. A política de leitura já permite admin.
- Juntar `expansion_period_snapshots` pelo `source_id` para exibir o período.

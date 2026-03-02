
# Finalizar manualmente os 4 leilões ativos

## Situação atual

4 leilões estão "active" há dias porque o `bot_protection_loop` estava falhando. Agora que foi corrigido, precisamos finalizá-los manualmente via SQL.

## Dados dos vencedores

| Leilão | Winner ID | Winner Name |
|---|---|---|
| PlayStation 5 SLIM | `4a7d1978-dc04-417e-8c71-b7cb0a18ddc2` | Luciane Toledo - Juazeiro do Norte, CE (bot) |
| JBL BOOMBOX 3 | `70c5b3c6-a7b6-4f5c-b5e9-b362f3f50cde` | Luiz Claudio - Salvador, BA |
| iPhone 17 Pro Max | `cb85af36-0756-4ae3-9b58-5efc79ee1087` | Adailton Mascarenhas - Lauro de Freitas, BA |
| Fone JBL Tune 510BT | `cb85af36-0756-4ae3-9b58-5efc79ee1087` | Adailton Mascarenhas - Lauro de Freitas, BA |

## Plano

Executar 4 UPDATEs na tabela `auctions` usando a ferramenta de inserção/atualização de dados, setando:
- `status` = `'finished'`
- `winner_id` = ID do último lance (real para 3, bot para PS5 conforme aprovado)
- `winner_name` = nome formatado com cidade/estado
- `finished_at` = `now()`

Nenhuma alteração em código ou schema — apenas atualização de dados.

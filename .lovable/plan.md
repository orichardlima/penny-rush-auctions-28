
## Resposta direta

**Sim, dois usuários reais deram lance no leilão Mi Band 10:**

| Usuário | Tipo | Lances | Primeiro lance | Último lance |
|---|---|---|---|---|
| **Richard Lima** | Real | 12 | 18/04 22:32 | 18/04 **22:44:57** |
| **Luis Paulo Mota de Oliveira** | Real | 1 | 19/04 01:59 | 19/04 **01:59:44** |

(Mais ~30 bots participaram, com lances até ~01:58 de 19/04.)

## Por que nenhum deles ganhou

O leilão estava com `open_win_mode = true` e `min_bids_to_qualify = 0`, então qualquer real liderando deveria pausar os bots. Mas:

1. **Richard Lima** — parou de dar lances às **22:44:57** de 18/04. Após esse momento, bots continuaram lançando por mais ~3 horas. Ele não estava liderando no momento do encerramento.
2. **Luis Paulo** — deu apenas 1 lance às **01:59:44** de 19/04. Logo em seguida, bots (Valeria Rios às 01:56, Roberta Siqueira às 01:58, Emerson às 01:56) deram outros lances que o ultrapassaram. Quando o leilão fechou, ele já não era o líder.

## Hipótese técnica para investigar (próximo passo, se autorizado)

A janela entre o lance do Luis Paulo (01:59:44) e o fechamento merece análise mais fina. Pelas timestamps acima, o último lance registrado foi o dele (01:59:44), porém um bot (Benedita Lima) acabou registrado como vencedor. Isso sugere uma de duas situações:

- **(A)** Existe lance de bot posterior a 01:59:44 que não apareceu no top da listagem (preciso consultar todos os lances ordenados por timestamp para confirmar).
- **(B)** O `auction-protection` injetou o bot Benedita mesmo com Luis Paulo liderando — o que seria um bug do `getEligibleRealLeader` recém-implementado.

Se você autorizar, posso rodar uma consulta listando os últimos 20 lances do leilão em ordem cronológica + comparar com `finished_at` para identificar exatamente qual cenário ocorreu e, se for (B), corrigir a edge function.

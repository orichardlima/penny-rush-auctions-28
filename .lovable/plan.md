

## Plano: Duração aleatória real dentro de intervalo + finished_at natural

### Problema

Dois problemas combinados causam o comportamento mecânico:

1. **Duração fixa no Batch Generator**: O modo "Duração ativa" oferece apenas valores fixos (2h, 3h, 4h...) com um offset de ±15 minutos. Não existe opção de intervalo (ex: "entre 3h e 6h") onde cada leilão recebe uma duração genuinamente aleatória dentro da faixa.

2. **finished_at idêntico**: A `bot_protection_loop` (linha 57) e a edge function `sync-timers-and-protection` usam `v_current_time_br` (timestamp do cron) como `finished_at` para todos os leilões finalizados no mesmo ciclo, em vez de usar o `ends_at` real de cada leilão.

### Alterações

**1. BatchAuctionGenerator.tsx — Modo de duração por intervalo**

- Substituir o seletor de duração fixa por dois campos: **Duração mínima** e **Duração máxima** (ex: 3h e 6h)
- Cada leilão do lote recebe um `ends_at` calculado como `startsAt + random(min, max)` em minutos, gerando durações verdadeiramente variadas (ex: 3h12min, 5h47min, 4h03min...)
- Remover o offset de ±15min separado — a aleatoriedade do intervalo já cumpre esse papel
- Manter o modo "Horário fixo" inalterado (com seu offset de ±15min existente)

**2. bot_protection_loop (nova migration SQL)**

- Na condição de finalização por horário limite (linha 57), trocar:
  ```sql
  -- ANTES:
  finished_at = v_current_time_br
  -- DEPOIS:
  finished_at = v_auction.ends_at
  ```
- As demais condições (meta de receita, preço máximo, prejuízo) continuam usando `v_current_time_br`

**3. sync-timers-and-protection (edge function)**

- Mesma correção: na seção `HORÁRIO-LIMITE`, usar `auction.ends_at` como `finished_at` em vez de `currentTimeBr`

### Impacto

- Leilões criados em lote terão durações genuinamente diversas dentro do intervalo configurado
- Leilões finalizados por tempo exibirão horários de encerramento distintos e naturais
- Nenhuma alteração em tabelas do banco de dados — apenas lógica de cálculo e atualização
- O auto-replenish já possui lógica de intervalo min/max e não precisa de alteração

